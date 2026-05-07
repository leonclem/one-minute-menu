import { createWorkerSupabaseClient } from '@/lib/supabase-worker'
import { getBackgroundRemovalProvider } from './provider-factory'
import { CutoutGenerationService } from './cutout-service'
import { logger } from '@/lib/logger'

/** Default per-job timeout in milliseconds. */
const DEFAULT_JOB_TIMEOUT_MS = 60_000

/** Maximum retries per job for transient errors. */
const MAX_RETRIES = 4

/** Categories of errors worth retrying. */
const RETRYABLE_CATEGORIES = new Set(['rate_limited', 'provider_unavailable', 'timeout'])

/** Inter-job delay in ms to avoid hammering the provider (2 seconds for ~30 req/min pace). */
const INTER_JOB_DELAY_MS = 2000

export interface WorkerResult {
  processed: number
  succeeded: number
  failed: number
}

/**
 * Process all pending cutout jobs.
 *
 * 1. Atomically claims pending rows (`pending` → `processing`) to prevent
 *    duplicate processing when multiple invocations overlap.
 * 2. Processes each claimed job via CutoutGenerationService.
 * 3. Failed / timed-out jobs stay in their terminal state — they are never
 *    set back to `pending`, preventing infinite retry loops.
 *
 * @param jobTimeoutMs  Per-job timeout (default 60 s).
 */
export async function processPendingCutouts(
  jobTimeoutMs: number = DEFAULT_JOB_TIMEOUT_MS
): Promise<WorkerResult> {
  // Use the worker Supabase client so Docker/internal URL resolution works.
  const supabase = createWorkerSupabaseClient()
  const provider = getBackgroundRemovalProvider()
  const service = new CutoutGenerationService(provider, supabase)

  const result: WorkerResult = { processed: 0, succeeded: 0, failed: 0 }

  // ── 1. Claim pending jobs atomically ────────────────────────────────
  // Uses RPC to run:
  //   UPDATE ai_generated_images
  //   SET cutout_status = 'processing'
  //   WHERE cutout_status = 'pending'
  //   RETURNING *
  // If no RPC exists yet, fall back to a two-step select-then-update.
  const { data: pendingJobs, error: claimError } = await supabase
    .from('ai_generated_images')
    .update({ cutout_status: 'processing' })
    .eq('cutout_status', 'pending')
    .select('id, cutout_generation_log_id')

  if (claimError) {
    logger.error('[CutoutWorker] Failed to claim pending jobs', claimError)
    return result
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    return result
  }

  logger.info(`[CutoutWorker] Claimed ${pendingJobs.length} pending job(s)`)

  // ── 2. Process each claimed job ─────────────────────────────────────
  for (let i = 0; i < pendingJobs.length; i++) {
    const job = pendingJobs[i]
    const logId = job.cutout_generation_log_id as string | null
    const imageId = job.id as string
    result.processed++

    // Small delay between jobs to avoid rate-limiting from the provider
    if (i > 0) {
      await sleep(INTER_JOB_DELAY_MS)
    }

    if (!logId) {
      logger.error('[CutoutWorker] Claimed job has no log ID — marking failed', { imageId })
      await markImageFailed(supabase, imageId, 'No cutout_generation_log_id on claimed image')
      result.failed++
      continue
    }

    try {
      await withRetry(
        () => withTimeout(service.processPendingCutout(logId), jobTimeoutMs),
        MAX_RETRIES,
        { logId, imageId }
      )
      // processPendingCutout handles provider errors internally and may persist
      // a terminal failure status without throwing. Verify final status before
      // counting this job as succeeded to keep worker metrics truthful.
      const { data: finalImage, error: finalStatusErr } = await supabase
        .from('ai_generated_images')
        .select('cutout_status, cutout_failure_reason')
        .eq('id', imageId)
        .single()

      if (finalStatusErr || !finalImage) {
        result.failed++
        logger.error('[CutoutWorker] Could not verify final job status after processing', {
          logId,
          imageId,
          error: finalStatusErr,
        })
      } else if (finalImage.cutout_status === 'succeeded') {
        result.succeeded++
      } else {
        result.failed++
        logger.warn('[CutoutWorker] Job completed with terminal non-success status', {
          logId,
          imageId,
          status: finalImage.cutout_status,
          reason: finalImage.cutout_failure_reason ?? null,
        })
      }
    } catch (err: unknown) {
      result.failed++
      const isTimeout = err instanceof TimeoutError

      const status = isTimeout ? 'timed_out' : 'failed'
      const reason = isTimeout
        ? `Job timed out after ${jobTimeoutMs}ms`
        : err instanceof Error
          ? err.message
          : (err && typeof err === 'object' && 'message' in err)
            ? String((err as { message: unknown }).message)
            : JSON.stringify(err)

      logger.error(`[CutoutWorker] Job ${status}`, { logId, imageId, reason })

      // If the error is a BackgroundRemovalError, the service already persisted
      // the correct status/reason to both ai_generated_images and the log entry.
      // Only write from the worker for non-provider errors (timeouts, unexpected).
      const isProviderError = !isTimeout && err && typeof err === 'object' && 'category' in err
      if (!isProviderError) {
        // Update image status to terminal state
        await markImageFailed(supabase, imageId, reason, status)

        // Update log entry
        try {
          await supabase
            .from('cutout_generation_logs')
            .update({
              status,
              error_category: isTimeout ? 'timeout' : 'unknown',
              error_code: isTimeout ? 'WORKER_TIMEOUT' : 'WORKER_ERROR',
              error_message: reason,
              completed_at: new Date().toISOString(),
            })
            .eq('id', logId)
        } catch (logErr) {
          logger.error('[CutoutWorker] Failed to update log after job failure', { logId, error: logErr })
        }
      }
    }
  }

  logger.info('[CutoutWorker] Batch complete', result)
  return result
}


// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Determine if an error is transient and worth retrying.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof TimeoutError) return true
  if (err && typeof err === 'object' && 'category' in err) {
    return RETRYABLE_CATEGORIES.has((err as { category: string }).category)
  }
  return false
}

/**
 * Retry a function up to `maxRetries` times with exponential backoff,
 * but only for transient/retryable errors.
 * Uses the retry_after hint from rate limit responses if available.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  context: { logId: string; imageId: string }
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries && isRetryable(err)) {
        // Use retry_after hint from rate limit response if available
        let delayMs: number
        if (err && typeof err === 'object' && 'retryAfter' in err) {
          const retryAfterSeconds = (err as { retryAfter?: number }).retryAfter
          if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
            // Convert to ms and add 10% buffer
            delayMs = Math.ceil(retryAfterSeconds * 1000 * 1.1)
          } else {
            // Fall back to exponential backoff (2s, 4s, 8s, 16s)
            delayMs = 2000 * Math.pow(2, attempt)
          }
        } else {
          // Standard exponential backoff (2s, 4s, 8s, 16s)
          delayMs = 2000 * Math.pow(2, attempt)
        }
        logger.warn(`[CutoutWorker] Retryable error on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delayMs}ms`, {
          ...context,
          error: err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : String(err),
        })
        await sleep(delayMs)
      } else {
        throw err
      }
    }
  }
  throw lastError // unreachable, but satisfies TS
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

/**
 * Race a promise against a timeout. Rejects with TimeoutError if the
 * timeout fires first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    promise
      .then((val) => { clearTimeout(timer); resolve(val) })
      .catch((err) => { clearTimeout(timer); reject(err) })
  })
}

/**
 * Set an image's cutout_status to a terminal failure state.
 */
async function markImageFailed(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  imageId: string,
  reason: string,
  status: 'failed' | 'timed_out' = 'failed'
): Promise<void> {
  try {
    await supabase
      .from('ai_generated_images')
      .update({
        cutout_status: status,
        cutout_completed_at: new Date().toISOString(),
        cutout_failure_reason: reason,
      })
      .eq('id', imageId)
  } catch (err) {
    logger.error('[CutoutWorker] Failed to mark image as failed', { imageId, error: err })
  }
}

/**
 * Reset failed/timed-out cutout jobs back to 'pending' so the worker can
 * re-process them on the next invocation.
 *
 * Optionally scoped to a single menu via `menuId`.
 * Returns the number of rows reset.
 */
export async function retryFailedCutouts(menuId?: string): Promise<number> {
  // Use the worker client so this works in Docker/Railway too.
  const supabase = createWorkerSupabaseClient()

  // The above won't work for menu-level scoping since menu_item_id != menuId.
  // We need to join through cutout_generation_logs. Simpler approach: use the
  // log table to find image IDs for this menu, then reset those.
  if (menuId) {
    const { data: logs } = await supabase
      .from('cutout_generation_logs')
      .select('image_id')
      .eq('menu_id', menuId)

    if (!logs || logs.length === 0) return 0

    const imageIds = logs.map(l => l.image_id).filter(Boolean) as string[]
    const { data: reset } = await supabase
      .from('ai_generated_images')
      .update({
        cutout_status: 'pending',
        cutout_failure_reason: null,
        cutout_completed_at: null,
      })
      .in('id', imageIds)
      .in('cutout_status', ['failed', 'timed_out'])
      .select('id')

    const count = reset?.length ?? 0
    if (count > 0) {
      // Also reset the corresponding log entries
      await supabase
        .from('cutout_generation_logs')
        .update({ status: 'pending', error_category: null, error_code: null, error_message: null, completed_at: null })
        .in('image_id', reset!.map(r => r.id))
        .in('status', ['failed', 'timed_out'])
    }
    logger.info(`[CutoutWorker] Reset ${count} failed cutout(s) for menu ${menuId}`)
    return count
  }

  // Global reset (no menu filter)
  const { data: reset } = await supabase
    .from('ai_generated_images')
    .update({
      cutout_status: 'pending',
      cutout_failure_reason: null,
      cutout_completed_at: null,
    })
    .in('cutout_status', ['failed', 'timed_out'])
    .not('cutout_generation_log_id', 'is', null)
    .select('id')

  const count = reset?.length ?? 0
  if (count > 0) {
    await supabase
      .from('cutout_generation_logs')
      .update({ status: 'pending', error_category: null, error_code: null, error_message: null, completed_at: null })
      .in('image_id', reset!.map(r => r.id))
      .in('status', ['failed', 'timed_out'])
  }
  logger.info(`[CutoutWorker] Reset ${count} failed cutout(s) globally`)
  return count
}
