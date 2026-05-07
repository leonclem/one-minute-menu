/**
 * Shared helpers for enqueueing image_generation_jobs (queued, quota, release).
 * Used by POST /api/generate-image and POST /api/image-generation/batches.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { quotaOperations } from '@/lib/quota-management'
import type { NanoBananaParams, UserPlan } from '@/types'

const SUBSCRIBER_PLANS: UserPlan[] = ['grid_plus', 'grid_plus_premium', 'premium', 'enterprise']

export function parseReferenceImagesForEnqueue(
  referenceImages?: Array<{ dataUrl: string; comment?: string; role?: string; name?: string }>
): NanoBananaParams['reference_images'] {
  if (!Array.isArray(referenceImages) || referenceImages.length === 0) return undefined

  const parsed: NonNullable<NanoBananaParams['reference_images']> = []
  for (let i = 0; i < referenceImages.length; i++) {
    if (i >= 3) break

    const ref = referenceImages[i]
    const dataUrl = (ref.dataUrl || '').trim()
    const match = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,/)
    if (!match) continue

    const data = dataUrl.substring(match[0].length).replace(/[\r\n\s]/g, '')
    if (!data) continue

    parsed.push({
      mimeType: match[1] as any,
      data,
      role: ref.role || 'other',
      comment: ref.comment,
    })
  }

  return parsed.length > 0 ? parsed : undefined
}

export function getImageGenerationQueuePriority(plan: UserPlan): number {
  return SUBSCRIBER_PLANS.includes(plan) ? 100 : 10
}

/** Row shape for insert into image_generation_jobs before worker claim. */
export type QueuedImageGenerationJobInsert = {
  user_id: string
  menu_id: string
  menu_item_id: string
  batch_id: string | null
  status: 'queued'
  prompt: string
  negative_prompt: string | null
  api_params: Record<string, unknown>
  number_of_variations: number
  estimated_cost: number | null
  priority: number
  available_at: string | null
}

export type InsertedQueuedJobRow = {
  id: string
  batch_id: string | null
  menu_id: string
  menu_item_id: string
  status: string
  created_at: string
}

/**
 * Inserts queued jobs, consumes quota for total variation units, then sets available_at so workers can claim.
 * On quota failure, marks inserted jobs failed and rethrows.
 */
export async function insertQueuedImageJobsConsumeQuotaAndRelease(
  supabase: SupabaseClient,
  params: {
    userId: string
    jobs: QueuedImageGenerationJobInsert[]
    totalVariationUnits: number
  }
): Promise<{ insertedJobs: InsertedQueuedJobRow[]; quotaAfter: Awaited<ReturnType<typeof quotaOperations.consumeQuota>> }> {
  const { userId, jobs, totalVariationUnits } = params
  if (jobs.length === 0) {
    throw new Error('insertQueuedImageJobsConsumeQuotaAndRelease: no jobs')
  }

  const { data: insertedJobs, error: insertJobsError } = await supabase
    .from('image_generation_jobs')
    .insert(jobs)
    .select('id, batch_id, menu_id, menu_item_id, status, created_at')

  if (insertJobsError || !insertedJobs?.length) {
    logger.error('[enqueue-helpers] Failed to insert queued image jobs:', insertJobsError)
    throw new Error(insertJobsError?.message || 'JOB_INSERT_FAILED')
  }

  const insertedJobIds = insertedJobs.map((job: any) => job.id as string)

  try {
    const quotaAfter = await quotaOperations.consumeQuota(userId, totalVariationUnits)
    const { error: releaseJobsError } = await supabase
      .from('image_generation_jobs')
      .update({ available_at: new Date().toISOString() })
      .in('id', insertedJobIds)

    if (releaseJobsError) {
      logger.error('[enqueue-helpers] Failed to release queued jobs:', releaseJobsError)
      throw new Error(releaseJobsError.message || 'JOB_RELEASE_FAILED')
    }

    return { insertedJobs: insertedJobs as InsertedQueuedJobRow[], quotaAfter }
  } catch (quotaError) {
    if (insertedJobIds.length > 0) {
      await supabase
        .from('image_generation_jobs')
        .update({
          status: 'failed',
          error_message: quotaError instanceof Error ? quotaError.message : 'Insufficient quota',
          error_code: 'QUOTA_EXCEEDED',
          completed_at: new Date().toISOString(),
        })
        .in('id', insertedJobIds)
    }
    throw quotaError
  }
}
