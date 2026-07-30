import { useEffect, useRef } from 'react'
import Link from 'next/link'

import { ANALYTICS_EVENTS } from '@/lib/posthog/events'
import { trackStudioEvent } from '@/lib/studio/analytics/studio-analytics'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import type { AccessMode } from '@/lib/studio/access/studio-access-mode'

export interface StudioFirstRunPanelProps {
  /** Opens the hidden file input owned by the Studio editor. */
  onOpenFilePicker: () => void
  accessMode?: AccessMode
  accessReason?: StudioAccessReason
  isAdmin?: boolean
}

const WORKFLOW_STEPS = [
  {
    title: 'Upload a real dish photo',
    description: 'Start with a clear photo of the dish you want to improve.',
  },
  {
    title: 'Choose controlled changes',
    description: 'Use the Studio controls to choose the changes you want to make.',
  },
  {
    title: 'Generate a version',
    description: 'Create a new version while keeping the dish identity in view.',
  },
  {
    title: 'Download or give feedback',
    description: 'Use the result, download it, or tell us what would make it better.',
  },
] as const

/**
 * Explains the first Studio workflow before a user has uploaded an image.
 * The editor owns the file input; this panel only requests that it open.
 */
export function StudioFirstRunPanel({
  onOpenFilePicker,
  accessMode = 'admin-only',
  accessReason = 'granted_admin',
  isAdmin = false,
}: StudioFirstRunPanelProps) {
  const didTrackRef = useRef(false)

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

  return (
    <section
      role="region"
      aria-labelledby="studio-first-run-heading"
      className="rounded-xl border border-gray-200 bg-white/90 p-6 shadow-sm md:p-8"
    >
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-ux-primary">
          Photo Studio
        </p>
        <h2 id="studio-first-run-heading" className="mt-2 text-2xl font-bold text-gray-900">
          Bring one dish photo to life
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Make focused changes to a real dish photo without writing prompts.
        </p>
      </div>

      <ol
        aria-label="Photo Studio workflow"
        className="mt-6 grid list-decimal gap-4 pl-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        {WORKFLOW_STEPS.map((step) => (
          <li
            key={step.title}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <h3 className="text-sm font-semibold leading-5 text-gray-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-5 text-gray-600">{step.description}</p>
          </li>
        ))}
      </ol>

      <div
        aria-labelledby="studio-first-run-credits-heading"
        className="mt-6 rounded-lg border border-teal-100 bg-teal-50/70 p-4"
      >
        <h3 id="studio-first-run-credits-heading" className="text-sm font-semibold text-teal-950">
          Private-beta credits
        </h3>
        <p className="mt-1 text-sm leading-5 text-teal-900">
          Uploading a photo and extracting its dish details are free. A successful generation
          debits credits from your private-beta balance.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
        <button
          type="button"
          onClick={onOpenFilePicker}
          className="rounded-md bg-ux-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ux-primary/40 focus:ring-offset-2"
        >
          Upload a dish photo
        </button>
        <p className="text-sm text-gray-600">
          Need help getting started?{' '}
          <Link
            href="/support"
            className="font-semibold text-ux-primary underline underline-offset-2 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ux-primary/40 focus:ring-offset-2"
          >
            Contact support
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
