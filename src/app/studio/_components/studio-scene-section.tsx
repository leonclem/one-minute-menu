import type { ReactNode } from 'react'

import type { EditorState } from '@/lib/photo-control/minimal-schema'
import type { StudioVisualOption } from '@/lib/studio/control-options'
import { STUDIO_QUICK_LOOKS } from '@/lib/studio/quick-looks'

export function optionLabel(
  options: StudioVisualOption<string>[],
  value: string | null | undefined,
): string {
  if (!value) return 'None'
  return options.find((option) => option.value === value)?.label ?? value
}

export function matchingQuickLookName(
  editorState: EditorState,
  backdropHidden: boolean,
): string {
  const lighting = editorState.schema.scene_setup.lighting
  const surface = editorState.schema.canvas.surface_style ?? ''
  const backdrop = editorState.schema.canvas.background_style ?? ''
  const match = STUDIO_QUICK_LOOKS.find((look) => {
    if (look.lighting !== lighting || look.surface !== surface) return false
    return backdropHidden || look.backdrop === backdrop
  })
  return match?.name ?? 'Custom'
}

export function plateSummary(
  garnishes: string[],
  sides: string[],
  finishingCount: number,
): string {
  const names = [...garnishes, ...sides]
  if (finishingCount > 0) {
    return names.length > 0
      ? `${names.length} on plate · ${finishingCount} staged`
      : `${finishingCount} staged`
  }
  if (names.length === 0) return 'None detected'
  if (names.length <= 2) return names.join(', ')
  return `${names.length} items`
}

function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 8 8" className="h-2 w-2 shrink-0 text-white/45" aria-hidden>
      {open ? <path fill="currentColor" d="M0 2.2h8L4 7.2z" /> : <path fill="currentColor" d="M2.2 0v8l5-4z" />}
    </svg>
  )
}

export function SceneSection({
  id,
  title,
  selectedLabel,
  pending,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  selectedLabel: string
  pending?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-b border-white/[0.07]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        data-testid={`studio-scene-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className="flex w-full items-center gap-2 py-2.5 text-left"
        onClick={onToggle}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-white/55">{title}</span>
        <SectionChevron open={open} />
        <span
          className={[
            'ml-auto truncate pl-3 text-xs',
            pending ? 'font-semibold text-[#01b3bf]' : 'text-white/40',
          ].join(' ')}
          data-testid={`${id}-value`}
          aria-label={pending ? `${selectedLabel}, pending edits` : undefined}
        >
          {selectedLabel}
        </span>
      </button>
      {open ? (
        <div id={id} className="pb-3">
          {children}
        </div>
      ) : null}
    </div>
  )
}
