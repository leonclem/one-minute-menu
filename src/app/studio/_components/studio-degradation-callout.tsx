'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

import type { DegradationTone, DegradationWarningCopy } from '@/lib/studio/degradation'
import { studioShotTreeHref } from '@/lib/studio/library-query'

const TONE_CLASS: Record<'dark' | 'light', Record<DegradationTone, string>> = {
  dark: {
    muted: 'text-white/50',
    warm: 'text-[#f0d48a]',
    gold: 'text-[#f8bc02]',
  },
  light: {
    muted: 'text-gray-600',
    warm: 'text-amber-800',
    gold: 'text-amber-950',
  },
}

/**
 * Dismiss lasts for the current shot and generation depth. Changing either
 * shows the note again, including when the same shot is selected once more.
 */
export function useDegradationDismiss(shotId: string | null, nextGen: number | null) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [shotId, nextGen])

  const dismiss = useCallback(() => setDismissed(true), [])

  return { dismissed, dismiss }
}

export function StudioDegradationCallout({
  dishId,
  warning,
  onDismiss,
  surface = 'dark',
  announce = false,
}: {
  dishId: string
  warning: DegradationWarningCopy
  onDismiss: () => void
  surface?: 'dark' | 'light'
  /** Live region. Leave off when another copy of this note is already on screen. */
  announce?: boolean
}) {
  const Tag = announce ? 'aside' : 'div'

  return (
    <Tag
      role={announce ? 'status' : undefined}
      data-testid="studio-degradation-callout"
      data-next-gen={warning.nextGen}
      data-tone={warning.tone}
      data-surface={surface}
      className={`flex items-start gap-2 text-xs leading-5 ${TONE_CLASS[surface][warning.tone]}`}
    >
      <p className="min-w-0 flex-1">
        {warning.line}{' '}
        <Link
          href={studioShotTreeHref(dishId)}
          className={
            surface === 'light'
              ? 'font-semibold text-gray-900 underline underline-offset-2 hover:text-gray-700'
              : 'studio-link font-semibold'
          }
        >
          {warning.cta}
        </Link>
      </p>
      <button
        type="button"
        aria-label="Dismiss generation warning"
        data-testid="studio-degradation-callout-dismiss"
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        onClick={onDismiss}
      >
        <X className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
      </button>
    </Tag>
  )
}
