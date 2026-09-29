'use client'

import { Focus } from 'lucide-react'

import type { NormalizedPoint } from '@/lib/studio/object-edit/contracts'
import { keepOutlinePoints } from '@/lib/studio/object-edit/keep-region'

export interface StudioKeepLauncherProps {
  disabled?: boolean
  hint?: string
  overlay?: boolean
  pressed?: boolean
  onOpen: () => void
}

export function StudioKeepLauncher({
  disabled = false,
  hint = '1 credit · clear the rest',
  overlay = false,
  pressed = false,
  onOpen,
}: StudioKeepLauncherProps) {
  return (
    <button
      type="button"
      data-testid="studio-keep-launcher"
      aria-label="Keep this"
      aria-pressed={pressed}
      disabled={disabled}
      className={['studio-tool-chip min-h-11', overlay && 'studio-tool-chip-overlay'].filter(Boolean).join(' ')}
      onClick={onOpen}
    >
      <span className="studio-tool-chip-label">
        <Focus className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        Keep this
      </span>
      <span className="studio-tool-chip-hint">{hint}</span>
    </button>
  )
}

function outlineCommands(points: readonly NormalizedPoint[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

/** Darkens and stripes everything outside the outline the user wants to keep. */
export function KeepExteriorShade({ points }: { points: readonly NormalizedPoint[] }) {
  const outline = keepOutlinePoints(points)
  if (!outline) return null
  const frame = `M 0 0 H 1 V 1 H 0 Z ${outlineCommands(outline)} Z`
  return (
    <>
      <defs>
        <pattern
          id="studio-keep-stripes"
          width="0.045"
          height="0.045"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(32)"
        >
          <line x1="0" y1="0" x2="0" y2="0.045" stroke="rgba(255,255,255,0.7)" strokeWidth="0.012" />
        </pattern>
      </defs>
      <path d={frame} fill="rgba(6, 12, 16, 0.5)" fillRule="evenodd" />
      <path d={frame} fill="url(#studio-keep-stripes)" fillRule="evenodd" data-testid="studio-keep-shade" />
    </>
  )
}
