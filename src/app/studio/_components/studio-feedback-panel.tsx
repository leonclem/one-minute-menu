'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import {
  trackStudioEvent,
  trackStudioFeedbackConversion,
} from '@/lib/studio/analytics/studio-analytics'
import {
  FEEDBACK_REASON_TAGS,
  FEEDBACK_COMMENT_MAX,
  type FeedbackReasonTag,
} from '@/lib/studio/feedback/feedback-validation'

const RATING_VALUES = [1, 2, 3, 4, 5] as const

type PromptState = 'checking' | 'open' | 'completed'

const REASON_LABELS: Record<FeedbackReasonTag, string> = {
  identity_changed: 'The dish lost identity',
  style_missed: "The output didn't match what I asked for",
  unwanted_prop: 'There was an unwanted addition',
  obviously_fake: 'It looks obviously fake',
  useful_result: 'This result is useful',
}

const VALIDATION_MESSAGES: Record<string, string> = {
  FEEDBACK_IMAGE_ID_REQUIRED: 'Choose a generated image before sending feedback.',
  FEEDBACK_RATING_OUT_OF_RANGE: 'Choose a rating from 1 to 5.',
  FEEDBACK_UNKNOWN_REASON_TAG: 'Choose only the available feedback reasons.',
  FEEDBACK_COMMENT_TOO_LONG: 'Your comment is too long. Keep it to 1,000 characters or fewer.',
  FEEDBACK_EMPTY: 'Add a rating, choose a reason, or write a comment before submitting.',
}

export interface StudioFeedbackPanelProps {
  studioImageId: string
  initialRating?: number | null
  initialReasonTags?: FeedbackReasonTag[]
  initialComment?: string
  onDismiss?: () => void
  onComplete?: () => void
}

type FeedbackResponse = {
  feedback?: unknown
  isUpdate?: boolean
}

function customerSafeError(code: unknown): string {
  if (typeof code === 'string' && VALIDATION_MESSAGES[code]) {
    return VALIDATION_MESSAGES[code]
  }
  return 'We could not save your feedback. Check your entries and try again.'
}

function areReasonTagsEqual(current: FeedbackReasonTag[], next: FeedbackReasonTag[]): boolean {
  return current.length === next.length && current.every((tag, index) => tag === next[index])
}

export function StudioFeedbackPanel({
  studioImageId,
  initialRating = null,
  initialReasonTags = [],
  initialComment = '',
  onDismiss,
  onComplete,
}: StudioFeedbackPanelProps) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [reasonTags, setReasonTags] = useState<FeedbackReasonTag[]>(initialReasonTags)
  const [comment, setComment] = useState(initialComment.slice(0, FEEDBACK_COMMENT_MAX))
  const [error, setError] = useState<string | null>(null)
  const [promptState, setPromptState] = useState<PromptState>('checking')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const ratingRefs = useRef<Array<HTMLButtonElement | null>>([])
  const initialReasonTagsKey = JSON.stringify(initialReasonTags)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const nextRating = initialRating ?? null
    const nextReasonTags = (JSON.parse(initialReasonTagsKey) as FeedbackReasonTag[]).filter((tag) =>
      FEEDBACK_REASON_TAGS.includes(tag)
    )
    const nextComment = initialComment.slice(0, FEEDBACK_COMMENT_MAX)
    let cancelled = false

    setRating((current) => (current === nextRating ? current : nextRating))
    setReasonTags((current) =>
      areReasonTagsEqual(current, nextReasonTags) ? current : nextReasonTags
    )
    setComment((current) => (current === nextComment ? current : nextComment))
    setError(null)
    setPromptState('checking')

    void fetch(`/api/studio/feedback?studioImageId=${encodeURIComponent(studioImageId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load feedback prompt state')
        return response.json() as Promise<{ completed?: boolean }>
      })
      .then((payload) => {
        if (!cancelled) setPromptState(payload.completed === true ? 'completed' : 'open')
      })
      .catch(() => {
        // Feedback remains available if the status lookup is temporarily unavailable.
        if (!cancelled) setPromptState('open')
      })

    return () => {
      cancelled = true
    }
  }, [initialComment, initialRating, initialReasonTagsKey, studioImageId])

  const hasSubmission = useMemo(
    () => rating !== null || reasonTags.length > 0 || comment.trim().length > 0,
    [comment, rating, reasonTags.length]
  )

  const toggleReason = (tag: FeedbackReasonTag) => {
    setError(null)
    setReasonTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    )
  }

  const selectRating = (nextRating: number) => {
    setError(null)
    setRating(nextRating)
  }

  const handleRatingKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentRating: number
  ) => {
    const currentIndex = currentRating - 1
    let nextIndex: number | null = null

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % RATING_VALUES.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + RATING_VALUES.length) % RATING_VALUES.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = RATING_VALUES.length - 1
    }

    if (nextIndex === null) return
    event.preventDefault()
    const nextRating = RATING_VALUES[nextIndex]
    selectRating(nextRating)
    ratingRefs.current[nextIndex]?.focus()
  }

  const complete = () => {
    setPromptState('completed')
    onComplete?.()
  }

  const dismiss = async () => {
    if (isDismissing || isSubmitting) return

    setError(null)
    setIsDismissing(true)
    try {
      const response = await fetch('/api/studio/feedback/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioImageId }),
      })
      if (!response.ok) {
        throw new Error('Unable to save feedback dismissal')
      }

      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_FEEDBACK_DISMISSED, {
        surface: 'feedback_modal',
      })
      complete()
      onDismiss?.()
    } catch {
      setError('We could not save this dismissal. Please try again.')
    } finally {
      setIsDismissing(false)
    }
  }

  const submit = async () => {
    if (!hasSubmission || isSubmitting || isDismissing) return

    setError(null)
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/studio/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studioImageId,
          rating,
          reasonTags,
          comment: comment.trim() || null,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as FeedbackResponse & {
        code?: string
      }

      if (!response.ok) {
        if (response.status === 400) setError(customerSafeError(payload.code))
        else setError('We could not save your feedback. Please try again.')
        return
      }

      const isUpdate = payload.isUpdate === true
      const feedbackProperties = {
        rating,
        reason_tag_count: reasonTags.length,
        has_comment: comment.trim().length > 0,
        is_update: isUpdate,
      }
      trackStudioEvent(ANALYTICS_EVENTS.STUDIO_FEEDBACK_SUBMITTED, feedbackProperties)
      trackStudioFeedbackConversion(feedbackProperties)
      complete()
    } catch {
      setError('We could not save your feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isMounted || promptState !== 'open') return null

  const submitReasonId = 'studio-feedback-submit-reason'
  const counterId = 'studio-feedback-comment-counter'
  const headingId = 'studio-feedback-heading'

  return createPortal(
    <div className="studio-shell fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="studio-feedback-panel"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[16px] border border-white/10 bg-[#0f1c1f] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 pb-3 pt-5">
          <div>
            <h2 id={headingId} className="text-base font-bold text-white">
              How did this result turn out?
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Your feedback helps us improve Photo Studio. All fields are optional, but choose at
              least one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={isDismissing || isSubmitting}
            aria-label="Dismiss feedback"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01b3bf]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div
              role="alert"
              className="rounded-[9px] border border-[#ff8a80]/40 bg-[rgba(255,138,128,0.12)] p-3 text-sm text-[#ff8a80]"
            >
              {error}
            </div>
          )}

          <fieldset className={error ? 'mt-4' : ''}>
            <legend className="text-sm font-semibold text-white">Rating</legend>
            <div
              role="radiogroup"
              aria-label="Rate this generated image from 1 to 5"
              className="mt-2 flex gap-2"
            >
              {RATING_VALUES.map((value, index) => (
                <button
                  key={value}
                  ref={(element) => {
                    ratingRefs.current[index] = element
                  }}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`Rate ${value} of 5`}
                  tabIndex={rating === null ? (value === 1 ? 0 : -1) : rating === value ? 0 : -1}
                  onClick={() => selectRating(value)}
                  onKeyDown={(event) => handleRatingKeyDown(event, value)}
                  className="flex h-10 w-10 min-h-0 min-w-10 items-center justify-center rounded-[9px] border border-white/16 text-sm font-bold text-white/80 hover:border-[#01b3bf] hover:bg-[rgba(1,179,191,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01b3bf]/40 aria-checked:border-[#01b3bf] aria-checked:bg-[#01b3bf] aria-checked:text-[#0c1416]"
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-sm font-semibold text-white">What stood out?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK_REASON_TAGS.map((tag) => {
                const selected = reasonTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleReason(tag)}
                    className="rounded-full border border-white/16 px-3 py-2 text-sm text-white/80 hover:border-[#01b3bf] hover:bg-[rgba(1,179,191,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01b3bf]/40 aria-pressed:border-[#01b3bf] aria-pressed:bg-[rgba(1,179,191,0.14)] aria-pressed:text-[#5fd3da]"
                  >
                    {REASON_LABELS[tag]}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="mt-4">
            <label
              htmlFor="studio-feedback-comment"
              className="block text-sm font-semibold text-white"
            >
              Tell us more <span className="font-medium text-white/45">(optional)</span>
            </label>
            <textarea
              id="studio-feedback-comment"
              value={comment}
              maxLength={FEEDBACK_COMMENT_MAX}
              aria-describedby={counterId}
              onChange={(event) => {
                setError(null)
                setComment(event.target.value)
              }}
              rows={4}
              className="mt-2 block w-full rounded-[9px] border border-white/16 bg-black/20 px-3 py-2 text-sm text-[#eef4f4] placeholder:text-white/30 focus:border-[#01b3bf] focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/30"
            />
            <span
              id={counterId}
              role="status"
              aria-live="polite"
              className="mt-1 block text-right text-xs text-white/45"
            >
              {comment.length} of {FEEDBACK_COMMENT_MAX} characters
            </span>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void dismiss()}
                disabled={isDismissing || isSubmitting}
                className="rounded-[9px] px-3 py-2 text-sm font-semibold text-white/55 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01b3bf]/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDismissing ? 'Dismissing…' : 'Dismiss'}
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!hasSubmission || isDismissing}
                aria-describedby={!hasSubmission ? submitReasonId : undefined}
                aria-busy={isSubmitting}
                className="studio-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
            {!hasSubmission && (
              <span
                id={submitReasonId}
                role="status"
                aria-live="polite"
                className="mt-2 block text-center text-xs text-white/45"
              >
                Choose a rating, reason, or comment to enable submission.
              </span>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
