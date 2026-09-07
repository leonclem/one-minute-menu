import { useEffect, useRef, useState } from 'react'

import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import { trackStudioEvent } from '@/lib/studio/analytics/studio-analytics'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import type { AccessMode } from '@/lib/studio/access/studio-access-mode'

export interface StudioFirstRunPanelProps {
  /** Opens the New dish modal. */
  onOpenFilePicker: () => void
  /** Persists the user's choice to hide this panel in the future. */
  onDismiss?: () => Promise<void> | void
  accessMode?: AccessMode
  accessReason?: StudioAccessReason
  isAdmin?: boolean
  /** Show “Don’t show this again” only after the account already has a dish. */
  canDismiss?: boolean
}

const WORKFLOW_STEPS = [
  {
    title: 'Name the dish, then upload a photo',
    description:
      'Upload a clear original camera photo with the dish filling most of the frame. Avoid screenshots and social media copies.',
  },
  {
    title: 'Choose controlled changes and generate',
    description: 'Use the controls to choose the changes you want to make, and execute.',
  },
  {
    title: 'Download or give feedback',
    description: 'Use the result, download it, or tell us what would make it better.',
  },
] as const

/**
 * Explains the first Studio workflow. Shown until the user dismisses it;
 * dismiss is offered only after they already have a dish.
 */
export function StudioFirstRunPanel({
  onOpenFilePicker,
  onDismiss,
  accessMode = 'admin-only',
  accessReason = 'granted_admin',
  isAdmin = false,
  canDismiss = false,
}: StudioFirstRunPanelProps) {
  const didTrackRef = useRef(false)
  const [dismissed, setDismissed] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [dismissalError, setDismissalError] = useState<string | null>(null)

  useEffect(() => {
    if (didTrackRef.current) return
    didTrackRef.current = true
    trackStudioEvent(ANALYTICS_EVENTS.STUDIO_ONBOARDING_VIEWED, {
      surface: 'first_run',
      access_mode: accessMode,
      access_reason: accessReason,
      is_admin: isAdmin,
      gallery_size: 0,
    })
  }, [accessMode, accessReason, isAdmin])

  const handleDismissChange = async (checked: boolean) => {
    if (!checked || isDismissing) return

    setDismissalError(null)
    setIsDismissing(true)
    try {
      await onDismiss?.()
      setDismissed(true)
    } catch {
      setDismissalError('We could not save this preference. Please try again.')
    } finally {
      setIsDismissing(false)
    }
  }

  if (dismissed) return null

  return (
    <section
      role="region"
      aria-labelledby="studio-first-run-heading"
      data-testid="studio-first-run-panel"
      className="rounded-[16px] border border-white/[0.1] bg-[#0f1c1f] p-6 md:p-8"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#5fd3da]">
          Photo Studio
        </p>
        <h2
          id="studio-first-run-heading"
          className="mt-2 text-xl font-extrabold tracking-[-0.03em] text-white sm:text-[1.35rem]"
        >
          🧙‍♂️ Bring one dish photo to life
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Make focused changes to a real dish photo without writing prompts.
        </p>
      </div>

      <ol
        aria-label="Photo Studio workflow"
        className="mt-6 grid list-none gap-3 pl-0 sm:grid-cols-2 lg:grid-cols-3"
      >
        {WORKFLOW_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-[14px] border border-white/[0.1] bg-white/[0.03] p-4"
          >
            <h3 className="text-sm font-bold leading-5 text-white">
              <span aria-hidden="true">{index + 1}. </span>
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-5 text-white/55">{step.description}</p>
          </li>
        ))}
      </ol>

      <div
        aria-labelledby="studio-first-run-credits-heading"
        className="mt-6 rounded-[11px] border border-[#f8bc02]/35 bg-[rgba(248,188,2,0.13)] p-4"
      >
        <p id="studio-first-run-credits-heading" className="text-sm font-bold text-[#f8bc02]">
          How credits work
        </p>
        <p className="mt-1 text-sm leading-5 text-[#f8bc02]/90">
          Uploading a photo and extracting dish details are free. A successful generation uses
          credits (where new accounts start with 10). If you need more credits, you can obtain them
          via the pricing page.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-start gap-3">
        <button type="button" onClick={onOpenFilePicker} className="studio-btn-primary">
          + New dish
        </button>
        {canDismiss ? (
          <label className="flex items-center gap-2 text-sm text-white/55">
            <input
              type="checkbox"
              checked={dismissed}
              disabled={isDismissing}
              onChange={(event) => void handleDismissChange(event.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-transparent text-[#01b3bf] focus:ring-[#01b3bf]/50"
            />
            Don&apos;t show this again
          </label>
        ) : null}
        {dismissalError ? (
          <p role="alert" className="text-sm text-[#ff8a80]">
            {dismissalError}
          </p>
        ) : null}
      </div>
    </section>
  )
}
