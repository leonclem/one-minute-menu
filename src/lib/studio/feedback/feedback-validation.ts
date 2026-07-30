/** Pure validation and normalization for Studio image feedback submissions. */

export const FEEDBACK_REASON_TAGS = [
  'identity_changed',
  'style_missed',
  'unwanted_prop',
  'useful_result',
] as const

export type FeedbackReasonTag = (typeof FEEDBACK_REASON_TAGS)[number]

export const FEEDBACK_COMMENT_MAX = 1000

export type FeedbackSubmission = {
  studioImageId: string
  rating?: number | null
  reasonTags?: string[]
  comment?: string | null
}

export type FeedbackValidationError =
  | 'FEEDBACK_IMAGE_ID_REQUIRED'
  | 'FEEDBACK_RATING_OUT_OF_RANGE'
  | 'FEEDBACK_UNKNOWN_REASON_TAG'
  | 'FEEDBACK_COMMENT_TOO_LONG'
  | 'FEEDBACK_EMPTY'

export type NormalisedFeedback = {
  studioImageId: string
  rating: number | null
  reasonTags: FeedbackReasonTag[]
  comment: string | null
}

export type FeedbackValidationResult =
  | { ok: true; value: NormalisedFeedback }
  | { ok: false; code: FeedbackValidationError }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/** Validate and normalize feedback without performing I/O or throwing for ordinary unknown input. */
export function validateFeedbackSubmission(input: unknown): FeedbackValidationResult {
  const body = (input ?? {}) as Partial<FeedbackSubmission>

  if (!isUuid(body.studioImageId)) {
    return { ok: false, code: 'FEEDBACK_IMAGE_ID_REQUIRED' }
  }

  let rating: number | null = null
  if (body.rating !== undefined && body.rating !== null) {
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      return { ok: false, code: 'FEEDBACK_RATING_OUT_OF_RANGE' }
    }
    rating = body.rating
  }

  const rawTags = body.reasonTags ?? []
  if (!Array.isArray(rawTags)) {
    return { ok: false, code: 'FEEDBACK_UNKNOWN_REASON_TAG' }
  }
  for (const tag of rawTags) {
    if (!FEEDBACK_REASON_TAGS.includes(tag as FeedbackReasonTag)) {
      return { ok: false, code: 'FEEDBACK_UNKNOWN_REASON_TAG' }
    }
  }
  const reasonTags = Array.from(new Set(rawTags)) as FeedbackReasonTag[]

  let comment: string | null = null
  if (typeof body.comment === 'string') {
    const trimmed = body.comment.trim()
    if (trimmed.length > FEEDBACK_COMMENT_MAX) {
      return { ok: false, code: 'FEEDBACK_COMMENT_TOO_LONG' }
    }
    comment = trimmed.length > 0 ? trimmed : null
  } else if (body.comment !== undefined && body.comment !== null) {
    return { ok: false, code: 'FEEDBACK_COMMENT_TOO_LONG' }
  }

  if (rating === null && reasonTags.length === 0 && comment === null) {
    return { ok: false, code: 'FEEDBACK_EMPTY' }
  }

  return {
    ok: true,
    value: { studioImageId: body.studioImageId, rating, reasonTags, comment },
  }
}
