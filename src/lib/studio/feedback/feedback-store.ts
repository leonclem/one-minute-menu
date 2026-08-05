import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export type NormalisedFeedback = {
  studioImageId: string
  rating: number | null
  reasonTags: string[]
  comment: string | null
}

export type RequestedModifications = {
  change_summary: string[]
  target_editor_state?: Record<string, unknown>
}

/** The complete feedback row returned after persistence. */
export type FeedbackRow = {
  user_id: string
  studio_image_id: string
  dish_id: string | null
  source_image_id: string | null
  requested_modifications: RequestedModifications
  rating: number | null
  reason_tags: string[]
  comment: string | null
  created_at: string
  updated_at: string
}

/** The only columns supplied to the feedback write. */
export type FeedbackWriteRow = Omit<FeedbackRow, 'created_at'>

function requestedModificationsFromMetadata(metadata: unknown): RequestedModifications {
  const record =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  const changeSummary = Array.isArray(record.changeSummary)
    ? record.changeSummary.filter((item): item is string => typeof item === 'string')
    : []
  const editorState = record.editorState
  const targetEditorState =
    editorState && typeof editorState === 'object' && !Array.isArray(editorState)
      ? (editorState as Record<string, unknown>)
      : undefined

  return {
    change_summary: changeSummary,
    ...(targetEditorState ? { target_editor_state: targetEditorState } : {}),
  }
}

/** Pure: the exact allow-listed column set written to studio_image_feedback. */
export function buildFeedbackRow(input: {
  userId: string
  dishId: string | null
  sourceImageId: string | null
  requestedModifications: RequestedModifications
  value: NormalisedFeedback
  now: string
}): FeedbackWriteRow {
  return {
    user_id: input.userId,
    studio_image_id: input.value.studioImageId,
    dish_id: input.dishId,
    source_image_id: input.sourceImageId,
    requested_modifications: input.requestedModifications,
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
  studioImageId: string
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

/** Read immutable feedback context from the persisted generated-image record. */
async function getFeedbackTraceabilityContext(
  userId: string,
  studioImageId: string
): Promise<{ sourceImageId: string | null; requestedModifications: RequestedModifications }> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_images')
    .select('source_image_id, metadata')
    .eq('id', studioImageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(
      `Failed to load generated image context: ${error?.message ?? 'image not found'}`
    )
  }

  const image = data as { source_image_id: string | null; metadata: unknown }
  return {
    sourceImageId: image.source_image_id ?? null,
    requestedModifications: requestedModificationsFromMetadata(image.metadata),
  }
}

export async function upsertStudioImageFeedback(input: {
  userId: string
  dishId: string | null
  value: NormalisedFeedback
}): Promise<{ row: FeedbackRow; isUpdate: boolean }> {
  const [traceability, now] = await Promise.all([
    getFeedbackTraceabilityContext(input.userId, input.value.studioImageId),
    Promise.resolve(new Date().toISOString()),
  ])
  const rowToWrite = buildFeedbackRow({ ...input, ...traceability, now })
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_image_feedback')
    .upsert(rowToWrite, { onConflict: 'user_id,studio_image_id' })
    .select(
      'user_id, studio_image_id, dish_id, source_image_id, requested_modifications, rating, reason_tags, comment, created_at, updated_at'
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

/** True when the user has already submitted or permanently dismissed this prompt. */
export async function isStudioImageFeedbackPromptCompleted(input: {
  userId: string
  studioImageId: string
}): Promise<boolean> {
  const supabase = createAdminSupabaseClient()
  const [feedbackResult, dismissalResult] = await Promise.all([
    supabase
      .from('studio_image_feedback')
      .select('studio_image_id')
      .eq('user_id', input.userId)
      .eq('studio_image_id', input.studioImageId)
      .maybeSingle(),
    supabase
      .from('studio_image_feedback_dismissals')
      .select('studio_image_id')
      .eq('user_id', input.userId)
      .eq('studio_image_id', input.studioImageId)
      .maybeSingle(),
  ])

  if (feedbackResult.error || dismissalResult.error) {
    throw new Error(
      `Failed to load Studio feedback prompt state: ${feedbackResult.error?.message ?? dismissalResult.error?.message}`
    )
  }

  return Boolean(feedbackResult.data || dismissalResult.data)
}

/** Persist an explicit, per-image opt-out so the feedback modal does not return. */
export async function dismissStudioImageFeedbackPrompt(input: {
  userId: string
  studioImageId: string
}): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('studio_image_feedback_dismissals').upsert(
    {
      user_id: input.userId,
      studio_image_id: input.studioImageId,
      dismissed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,studio_image_id' }
  )

  if (error) {
    throw new Error(`Failed to dismiss Studio feedback prompt: ${error.message}`)
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
      'rating, reason_tags, comment, dish_id, studio_image_id, source_image_id, requested_modifications, user_id, created_at, updated_at'
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
  source_image_id: string | null
  requested_modifications: RequestedModifications
  user_id: string
  created_at: string
  updated_at: string
}
