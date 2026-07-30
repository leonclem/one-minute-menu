import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export type NormalisedFeedback = {
  studioImageId: string
  rating: number | null
  reasonTags: string[]
  comment: string | null
}

/** The complete feedback row returned after persistence. */
export type FeedbackRow = {
  user_id: string
  studio_image_id: string
  dish_id: string | null
  rating: number | null
  reason_tags: string[]
  comment: string | null
  created_at: string
  updated_at: string
}

/** The only columns supplied to the feedback write. */
export type FeedbackWriteRow = Omit<FeedbackRow, 'created_at'>

/** Pure: the exact allow-listed column set written to studio_image_feedback. */
export function buildFeedbackRow(input: {
  userId: string
  dishId: string | null
  value: NormalisedFeedback
  now: string
}): FeedbackWriteRow {
  return {
    user_id: input.userId,
    studio_image_id: input.value.studioImageId,
    dish_id: input.dishId,
    rating: input.value.rating,
    reason_tags: input.value.reasonTags,
    comment: input.value.comment,
    updated_at: input.now,
  }
}

/** Verify ownership without exposing any other studio image fields. */
export async function assertOwnsStudioImage(
  supabase: SupabaseClient,
  userId: string,
  studioImageId: string,
): Promise<{ owned: boolean; dishId: string | null }> {
  const { data, error } = await supabase
    .from('studio_images')
    .select('dish_id')
    .eq('id', studioImageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to verify studio image ownership: ${error.message}`)
  }

  if (!data) {
    return { owned: false, dishId: null }
  }

  return { owned: true, dishId: (data as { dish_id: string | null }).dish_id ?? null }
}

export async function upsertStudioImageFeedback(input: {
  userId: string
  dishId: string | null
  value: NormalisedFeedback
}): Promise<{ row: FeedbackRow; isUpdate: boolean }> {
  const now = new Date().toISOString()
  const rowToWrite = buildFeedbackRow({ ...input, now })
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_image_feedback')
    .upsert(rowToWrite, { onConflict: 'user_id,studio_image_id' })
    .select(
      'user_id, studio_image_id, dish_id, rating, reason_tags, comment, created_at, updated_at',
    )
    .single()

  if (error || !data) {
    throw new Error(`Failed to write studio feedback: ${error?.message ?? 'unknown error'}`)
  }

  const feedbackRow = data as FeedbackRow
  return {
    row: feedbackRow,
    isUpdate: feedbackRow.created_at !== feedbackRow.updated_at,
  }
}

/**
 * List the feedback fields exposed to administrators, newest submissions first.
 * This read path remains separate from the user feedback write path above.
 */
export async function listRecentStudioFeedback(limit?: number): Promise<AdminFeedbackRow[]> {
  const requestedLimit = limit === undefined || !Number.isFinite(limit) ? 50 : Math.trunc(limit)
  const boundedLimit = Math.min(Math.max(requestedLimit, 1), 100)
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_image_feedback')
    .select(
      'rating, reason_tags, comment, dish_id, studio_image_id, user_id, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(boundedLimit)

  if (error) {
    throw new Error(`Failed to list studio feedback: ${error.message}`)
  }

  return (data ?? []) as AdminFeedbackRow[]
}

export type AdminFeedbackRow = {
  rating: number | null
  reason_tags: string[]
  comment: string | null
  dish_id: string | null
  studio_image_id: string
  user_id: string
  created_at: string
  updated_at: string
}
