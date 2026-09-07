'use client'

import Link from 'next/link'

import type { DegradationWarningCopy } from '@/lib/studio/degradation'
import { studioShotTreeHref } from '@/lib/studio/library-query'

export function StudioDegradationCallout({
  dishId,
  warning,
}: {
  dishId: string
  warning: DegradationWarningCopy
}) {
  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="studio-degradation-callout"
      data-next-gen={warning.nextGen}
      className="studio-callout-warn"
    >
      <p className="text-sm font-bold text-[#f8bc02]">{warning.title}</p>
      <p className="mt-1 text-xs leading-5 text-[#f8bc02]/90">{warning.body}</p>
      <Link href={studioShotTreeHref(dishId)} className="studio-callout-warn-cta mt-2.5">
        {warning.cta}
      </Link>
    </aside>
  )
}
