'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

import {
  DEGRADATION_COMPACT_HINT,
  type DegradationWarningCopy,
} from '@/lib/studio/degradation'
import { studioShotTreeHref } from '@/lib/studio/library-query'

export function StudioDegradationCallout({
  dishId,
  warning,
  compact = false,
  dismissible = false,
  iconTrigger = false,
  dismissKey,
}: {
  dishId: string
  warning: DegradationWarningCopy
  compact?: boolean
  dismissible?: boolean
  iconTrigger?: boolean
  dismissKey?: string
}) {
  const [dismissed, setDismissed] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  useEffect(() => {
    setDismissed(false)
    setInfoOpen(false)
  }, [dismissKey, warning.nextGen])

  if (dismissed) return null

  if (iconTrigger) {
    return (
      <div className="relative inline-flex" data-testid="studio-degradation-callout" data-next-gen={warning.nextGen}>
        <button
          type="button"
          aria-expanded={infoOpen}
          aria-controls="studio-degradation-info-panel"
          aria-label={`${warning.title}. ${DEGRADATION_COMPACT_HINT}`}
          data-testid="studio-degradation-info"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#f8bc02]/50 bg-[rgba(248,188,2,0.16)] text-sm font-bold leading-none text-[#f8bc02]"
          onClick={() => setInfoOpen((open) => !open)}
        >
          i
        </button>
        {infoOpen ? (
          <div
            id="studio-degradation-info-panel"
            role="dialog"
            aria-label={warning.title}
            className="studio-callout-warn absolute bottom-full left-0 z-30 mb-2 w-64 p-3"
          >
            <p className="text-xs font-bold text-[#f8bc02]">{warning.title}</p>
            <p className="mt-1 text-xs leading-5 text-[#f8bc02]/90">{DEGRADATION_COMPACT_HINT}</p>
            <Link href={studioShotTreeHref(dishId)} className="studio-link mt-2 inline-block text-xs font-semibold">
              {warning.cta}
            </Link>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="studio-degradation-callout"
      data-next-gen={warning.nextGen}
      className={compact ? 'studio-callout-warn studio-callout-warn-compact' : 'studio-callout-warn'}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={compact ? 'text-xs font-bold text-[#f8bc02]' : 'text-sm font-bold text-[#f8bc02]'}>
            {warning.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#f8bc02]/90">
            {compact ? DEGRADATION_COMPACT_HINT : warning.body}
          </p>
          <Link
            href={studioShotTreeHref(dishId)}
            className={
              compact
                ? 'studio-link mt-1 inline-block text-xs font-semibold'
                : 'studio-callout-warn-cta mt-2.5'
            }
          >
            {warning.cta}
          </Link>
        </div>
        {dismissible ? (
          <button
            type="button"
            aria-label="Dismiss generation warning"
            data-testid="studio-degradation-callout-dismiss"
            className="shrink-0 rounded p-0.5 text-[#f8bc02]/70 hover:text-[#f8bc02]"
            onClick={() => setDismissed(true)}
          >
            <X className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
          </button>
        ) : null}
      </div>
    </aside>
  )
}
