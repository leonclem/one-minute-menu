import { SupabaseClient } from '@supabase/supabase-js'
import { isCutoutFeatureEnabled } from './feature-flag'
import { resolvePublicImageUrl } from './local-image-proxy'
import type {
  BackgroundRemovalProvider,
  BackgroundRemovalError,
} from './types'
import type { CutoutStatus } from '@/types'
import { logger } from '@/lib/logger'

const BUCKET_NAME = 'ai-generated-images'

function normalizeStoragePublicUrl(publicUrl: string): string {
  const browserSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!browserSupabaseUrl) return publicUrl

  try {
    const browserUrl = new URL(browserSupabaseUrl)
    const storageUrl = new URL(publicUrl)
    const configuredInternalOrigins = [
      process.env.SUPABASE_INTERNAL_URL,
      process.env.WORKER_SUPABASE_URL,
    ]
      .map((value) => {
        try {
          return value ? new URL(value).origin : null
        } catch {
          return null
        }
      })
      .filter(Boolean)

    const isKnownInternalUrl =
      storageUrl.hostname === 'host.docker.internal' ||
      storageUrl.hostname === 'localhost' ||
      storageUrl.hostname === '127.0.0.1' ||
      configuredInternalOrigins.includes(storageUrl.origin)

    if (isKnownInternalUrl) {
      storageUrl.protocol = browserUrl.protocol
      storageUrl.host = browserUrl.host
    }

    return storageUrl.toString()
  } catch {
    return publicUrl
  }
}

/**
 * Core orchestrator for cut-out generation lifecycle.
 *
 * Manages requesting, processing, invalidating, and resolving cut-out images.
 * All DB errors are caught and logged — never propagated to crash the caller.
 */
export class CutoutGenerationService {
  constructor(
    private provider: BackgroundRemovalProvider,
    private supabase: SupabaseClient
  ) {}

  /**
   * Check if cut-out generation is enabled (env var + admin flag).
   */
  isEnabled(): boolean {
    return isCutoutFeatureEnabled()
  }

  /**
   * Request cut-out generation for an AI-generated image.
   * Creates a durable pending job record. Does NOT perform processing inline.
   * Returns the log entry ID so a background worker can pick it up.
   */
  async requestCutout(params: {
    imageId: string
    imageUrl: string
    userId: string
    menuId: string
    menuItemId: string
  }): Promise<{ logId: string }> {
    const { imageId, userId, menuId, menuItemId } = params

    // Insert a cutout_generation_logs entry with status 'pending'
    const { data: logData, error: logError } = await this.supabase
      .from('cutout_generation_logs')
      .insert({
        image_id: imageId,
        user_id: userId,
        menu_id: menuId,
        menu_item_id: menuItemId,
        source_image_type: 'ai_generated',
        provider_name: this.provider.name,
        status: 'pending',
      })
      .select('id')
      .single()

    if (logError || !logData) {
      logger.error('[CutoutService] Failed to insert cutout log entry', logError)
      throw new Error(`Failed to create cutout log: ${logError?.message ?? 'unknown error'}`)
    }

    const logId = logData.id as string

    // Update the ai_generated_images row to pending
    const { error: imageError } = await this.supabase
      .from('ai_generated_images')
      .update({
        cutout_status: 'pending' as CutoutStatus,
        cutout_requested_at: new Date().toISOString(),
        cutout_generation_log_id: logId,
      })
      .eq('id', imageId)

    if (imageError) {
      logger.error('[CutoutService] Failed to set image cutout_status to pending', imageError)
      throw new Error(`Failed to update image status: ${imageError.message}`)
    }

    return { logId }
  }

  /**
   * Process the actual background removal (called by background worker).
   * Claims a pending job, calls the provider, stores the result,
   * and updates image record and log entry on completion.
   * Verifies source image is still current before storing result.
   */
  async processPendingCutout(logId: string): Promise<void> {
    // 1. Fetch the log entry to get context
    const { data: logEntry, error: fetchError } = await this.supabase
      .from('cutout_generation_logs')
      .select('*')
      .eq('id', logId)
      .single()

    if (fetchError || !logEntry) {
      logger.error('[CutoutService] Failed to fetch log entry', { logId, error: fetchError })
      return
    }

    const imageId = logEntry.image_id as string
    const startTime = Date.now()

    try {
      // 2. Fetch the source image to get the URL for the provider
      const { data: imageRow, error: imgFetchError } = await this.supabase
        .from('ai_generated_images')
        .select('id, original_url, cutout_generation_log_id')
        .eq('id', imageId)
        .single()

      if (imgFetchError || !imageRow) {
        logger.error('[CutoutService] Source image not found or deleted', { imageId })
        await this.failLog(logId, startTime, 'source_missing', 'SOURCE_DELETED', 'Source image no longer exists')
        return
      }

      // 3. Verify this log entry is still the current one for the image
      if (imageRow.cutout_generation_log_id !== logId) {
        logger.warn('[CutoutService] Stale cutout job — source image has a newer request', { logId, imageId })
        await this.failLog(logId, startTime, 'stale_request', 'STALE_COMPLETION', 'Source image has been replaced or re-requested')
        return
      }

      const sourceUrl = imageRow.original_url as string

      // 4. Call the provider (proxy localhost URLs in local dev)
      const { url: resolvedUrl, cleanup } = await resolvePublicImageUrl(sourceUrl)
      let result
      try {
        result = await this.provider.removeBackground(resolvedUrl)
      } finally {
        await cleanup()
      }

      // 5. Re-verify source image is still current AFTER provider call
      const { data: currentImage, error: reCheckError } = await this.supabase
        .from('ai_generated_images')
        .select('id, cutout_generation_log_id')
        .eq('id', imageId)
        .single()

      if (reCheckError || !currentImage) {
        logger.warn('[CutoutService] Source image deleted during processing', { logId, imageId })
        await this.failLog(logId, startTime, 'source_missing', 'SOURCE_DELETED', 'Source image deleted during processing')
        return
      }

      if (currentImage.cutout_generation_log_id !== logId) {
        logger.warn('[CutoutService] Source image replaced during processing — discarding result', { logId, imageId })
        await this.failLog(logId, startTime, 'stale_request', 'STALE_COMPLETION', 'Source image replaced during processing')
        return
      }

      // 6. Upload result PNG to Supabase Storage
      const storagePath = `cutouts/${imageId}/cutout.png`
      const cutoutUrl = await this.uploadCutout(storagePath, result.imageBuffer)

      const processingDurationMs = Date.now() - startTime

      // 7. Update ai_generated_images with cutout result
      const { error: updateError } = await this.supabase
        .from('ai_generated_images')
        .update({
          cutout_url: cutoutUrl,
          cutout_status: 'succeeded' as CutoutStatus,
          cutout_provider: this.provider.name,
          cutout_model_version: result.modelVersion,
          cutout_completed_at: new Date().toISOString(),
          cutout_failure_reason: null,
        })
        .eq('id', imageId)

      if (updateError) {
        logger.error('[CutoutService] Failed to update image with cutout result', updateError)
        await this.failLog(logId, startTime, 'db_error', 'DB_UPDATE_FAILED', `Failed to update image: ${updateError.message}`)
        return
      }

      // 8. Update log entry with success
      await this.supabase
        .from('cutout_generation_logs')
        .update({
          status: 'succeeded',
          processing_duration_ms: processingDurationMs,
          output_asset_created: true,
          provider_model_version: result.modelVersion,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId)

    } catch (err: unknown) {
      const duration = Date.now() - startTime
      const bgError = err as BackgroundRemovalError

      if (bgError && bgError.category) {
        // Provider threw a structured BackgroundRemovalError
        const status: 'failed' | 'timed_out' = bgError.category === 'timeout' ? 'timed_out' : 'failed'

        // Update image status
        try {
          await this.supabase
            .from('ai_generated_images')
            .update({
              cutout_status: status as CutoutStatus,
              cutout_completed_at: new Date().toISOString(),
              cutout_failure_reason: bgError.message,
            })
            .eq('id', imageId)
        } catch (dbErr) {
          logger.error('[CutoutService] Failed to update image status after provider error', dbErr)
        }

        // Update log entry
        try {
          await this.supabase
            .from('cutout_generation_logs')
            .update({
              status,
              processing_duration_ms: duration,
              output_asset_created: false,
              error_category: bgError.category,
              error_code: bgError.code,
              error_message: bgError.message,
              completed_at: new Date().toISOString(),
            })
            .eq('id', logId)
        } catch (dbErr) {
          logger.error('[CutoutService] Failed to update log after provider error', dbErr)
        }

        // Important: bubble up retryable provider errors so the worker-level
        // retry/backoff logic can actually run.
        if (bgError.category === 'rate_limited' || bgError.category === 'provider_unavailable' || bgError.category === 'timeout') {
          throw bgError
        }
      } else {
        // Unknown / unexpected error
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[CutoutService] Unexpected error during cutout processing', { logId, error: message })

        try {
          await this.supabase
            .from('ai_generated_images')
            .update({
              cutout_status: 'failed' as CutoutStatus,
              cutout_completed_at: new Date().toISOString(),
              cutout_failure_reason: message,
            })
            .eq('id', imageId)
        } catch (dbErr) {
          logger.error('[CutoutService] Failed to update image status after unexpected error', dbErr)
        }

        await this.failLog(logId, duration, 'unknown', 'UNEXPECTED_ERROR', message)
      }
    }
  }

  /**
   * Invalidate an existing cut-out (e.g., when source image changes).
   * Sets cutout_status back to 'not_requested' and clears all cutout fields.
   */
  async invalidateCutout(imageId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_generated_images')
        .update({
          cutout_status: 'not_requested' as CutoutStatus,
          cutout_url: null,
          cutout_provider: null,
          cutout_model_version: null,
          cutout_completed_at: null,
          cutout_failure_reason: null,
          cutout_generation_log_id: null,
        })
        .eq('id', imageId)

      if (error) {
        logger.error('[CutoutService] Failed to invalidate cutout', { imageId, error })
      }
    } catch (err) {
      logger.error('[CutoutService] Unexpected error invalidating cutout', { imageId, error: err })
    }
  }

  /**
   * Resolve the best image URL for rendering.
   *
   * Two modes:
   *
   * 1. **Explicit cutout mode** (`itemUsesCutout = true`):
   *    - Returns `cutoutUrl` when `cutoutStatus === 'succeeded'` and `cutoutUrl` is non-null.
   *    - Returns `null` when the cutout is not available (any other status or null URL).
   *      `null` signals a blank placeholder — the user explicitly chose cutout style so
   *      falling back to the original would be misleading.
   *
   * 2. **Silent-upgrade mode** (`itemUsesCutout` absent/false — existing behaviour):
   *    - Returns `cutoutUrl` when `featureEnabled`, `templateSupportsCutouts`,
   *      `cutoutStatus === 'succeeded'`, and `cutoutUrl` is non-null.
   *    - Otherwise returns `originalUrl`. Never returns null.
   *
   * Pure function — no side effects, no async, never throws.
   */
  static resolveImageUrl(params: {
    originalUrl: string
    cutoutUrl: string | null
    cutoutStatus: CutoutStatus
    templateSupportsCutouts: boolean
    featureEnabled: boolean
    itemUsesCutout?: boolean
  }): string | null {
    // ── Explicit cutout mode ─────────────────────────────────────────────
    if (params.itemUsesCutout === true) {
      if (params.cutoutStatus === 'succeeded' && params.cutoutUrl) {
        return params.cutoutUrl
      }
      // Cutout not available — return null (blank placeholder, not original)
      return null
    }

    // ── Silent-upgrade mode (original behaviour) ─────────────────────────
    if (
      params.featureEnabled &&
      params.templateSupportsCutouts &&
      params.cutoutStatus === 'succeeded' &&
      params.cutoutUrl
    ) {
      return params.cutoutUrl
    }
    return params.originalUrl
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Upload a cut-out PNG to Supabase Storage and return the public URL.
   * Follows the same pattern as ImageProcessingService.uploadToStorage().
   */
  private async uploadCutout(path: string, buffer: Buffer): Promise<string> {
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, {
        contentType: 'image/png',
        cacheControl: '31536000', // 1 year cache on the object itself
        upsert: true,
      })

    if (error) {
      throw new Error(`Failed to upload cutout: ${error.message}`)
    }

    const { data: urlData } = this.supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path)

    // Append a cache-busting version so browsers/CDNs always fetch the
    // latest file when the cutout is regenerated (same path, new content).
    const version = Date.now()
    return `${normalizeStoragePublicUrl(urlData.publicUrl)}?v=${version}`
  }

  /**
   * Helper to mark a log entry as failed with error details.
   */
  private async failLog(
    logId: string,
    startTimeOrDuration: number,
    errorCategory: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    // If startTimeOrDuration is large (> 1_000_000_000), treat as a start timestamp
    const duration =
      startTimeOrDuration > 1_000_000_000
        ? Date.now() - startTimeOrDuration
        : startTimeOrDuration

    try {
      await this.supabase
        .from('cutout_generation_logs')
        .update({
          status: 'failed',
          processing_duration_ms: duration,
          output_asset_created: false,
          error_category: errorCategory,
          error_code: errorCode,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId)
    } catch (err) {
      logger.error('[CutoutService] Failed to update log entry', { logId, error: err })
    }
  }
}
