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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="studio-feedback-panel"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-ux-border/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ux-border/60 px-5 pb-3 pt-5">
          <div>
            <h2 id={headingId} className="text-base font-semibold text-ux-text">
              How did this result turn out?
            </h2>
            <p className="mt-1 text-sm text-ux-text-secondary">
              Your feedback helps us improve Photo Studio. All fields are optional, but choose at
              least one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={isDismissing || isSubmitting}
            aria-label="Dismiss feedback"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ux-text-secondary transition-colors hover:bg-ux-background-secondary hover:text-ux-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <fieldset className={error ? 'mt-4' : ''}>
            <legend className="text-sm font-medium text-ux-text">Rating</legend>
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
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-sm font-semibold text-gray-800 hover:border-ux-primary hover:bg-ux-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary/40 aria-checked:border-ux-primary aria-checked:bg-ux-primary aria-checked:text-white"
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-ux-text">What stood out?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEEDBACK_REASON_TAGS.map((tag) => {
                const selected = reasonTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleReason(tag)}
                    className="rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:border-ux-primary hover:bg-ux-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary/40 aria-pressed:border-ux-primary aria-pressed:bg-ux-primary/10 aria-pressed:text-ux-primary"
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
              className="block text-sm font-medium text-ux-text"
            >
              Tell us more <span className="font-normal text-ux-text-secondary">(optional)</span>
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
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-ux-primary focus:outline-none focus:ring-2 focus:ring-ux-primary/30"
            />
            <span
              id={counterId}
              role="status"
              aria-live="polite"
              className="mt-1 block text-right text-xs text-ux-text-secondary"
            >
              {comment.length} of {FEEDBACK_COMMENT_MAX} characters
            </span>
          </div>

          <div className="mt-5 border-t border-ux-border/60 pt-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void dismiss()}
                disabled={isDismissing || isSubmitting}
                className="rounded-md px-3 py-2 text-sm font-medium text-ux-text-secondary hover:bg-ux-background-secondary hover:text-ux-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDismissing ? 'Dismissing…' : 'Dismiss'}
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!hasSubmission || isDismissing}
                aria-describedby={!hasSubmission ? submitReasonId : undefined}
                aria-busy={isSubmitting}
                className="rounded-md bg-ux-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
            {!hasSubmission && (
              <span
                id={submitReasonId}
                role="status"
                aria-live="polite"
                className="mt-2 block text-center text-xs text-ux-text-secondary"
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
