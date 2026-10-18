'use client'

import { useEffect, useState } from 'react'
import { CakeSlice, Droplets, Leaf, Utensils, type LucideIcon } from 'lucide-react'

import type { FinishingTouchFamily } from '@/lib/studio/finishing-touches'
import {
  PROP_SUGGESTION_LIMIT,
  STUDIO_PROP_GROUP_LABELS,
  STUDIO_PROP_GROUP_ORDER,
  propMatchesAudience,
  propsForAudience,
  propsFromIds,
  type StudioProp,
  type StudioPropGroup,
} from '@/lib/studio/props'

const GROUP_ICONS: Record<StudioPropGroup, LucideIcon> = {
  cutlery: Utensils,
  baking: CakeSlice,
  service: Droplets,
  ingredients: Leaf,
}

interface StudioPropsControlProps {
  disabled?: boolean
  selectedIds: string[]
  rankedIds?: string[]
  audience?: FinishingTouchFamily
  onToggle: (id: string) => void
}

export function StudioPropsControl({
  disabled = false,
  selectedIds,
  rankedIds = [],
  audience = 'savory',
  onToggle,
}: StudioPropsControlProps) {
  const [browseOpen, setBrowseOpen] = useState(false)
  const ranked = propsFromIds(rankedIds)
    .filter((prop) => propMatchesAudience(prop, audience))
    .slice(0, PROP_SUGGESTION_LIMIT)
  const visibleIds = new Set(ranked.map((prop) => prop.id))
  const selectedOutsideRank = propsFromIds(selectedIds).filter(
    (prop) => !visibleIds.has(prop.id),
  )
  const chips = [...ranked, ...selectedOutsideRank]
  const hasSuggestions = ranked.length > 0

  return (
    <div className="space-y-2" data-testid="studio-props">
      <p className="text-xs leading-5 text-white/45">
        {hasSuggestions
          ? 'Suggested for this dish. Show more lists every prop. Each choice uses a fixed description, with no reference photo.'
          : 'Stages props for Generate. Browse the full list, or add finishing touches for a short suggestion.'}
      </p>
      {chips.length > 0 ? (
        <div aria-label="Props" className="flex flex-wrap gap-2">
          {chips.map((prop) => (
            <PropChip
              key={prop.id}
              prop={prop}
              selected={selectedIds.includes(prop.id)}
              disabled={disabled}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="text-xs font-medium text-[#5fd3da] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40"
        aria-haspopup="dialog"
        onClick={() => setBrowseOpen(true)}
      >
        {hasSuggestions ? 'Show more' : 'Browse props'}
      </button>
      <PropsBrowseModal
        open={browseOpen}
        disabled={disabled}
        selectedIds={selectedIds}
        audience={audience}
        onToggle={onToggle}
        onClose={() => setBrowseOpen(false)}
      />
    </div>
  )
}

function PropsBrowseModal({
  open,
  disabled,
  selectedIds,
  audience,
  onToggle,
  onClose,
}: {
  open: boolean
  disabled: boolean
  selectedIds: string[]
  audience: FinishingTouchFamily
  onToggle: (id: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-props-browse-title"
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[#0f1c1f] shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h3 id="studio-props-browse-title" className="text-base font-bold text-white">
            Props
          </h3>
          <button
            type="button"
            className="text-sm font-semibold text-white/55 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {STUDIO_PROP_GROUP_ORDER.map((group) => {
            const props = propsForAudience(audience).filter((prop) => prop.group === group)
            if (props.length === 0) return null
            const Icon = GROUP_ICONS[group]
            return (
              <section key={group} aria-label={STUDIO_PROP_GROUP_LABELS[group]}>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
                  <Icon className="h-3.5 w-3.5 text-[#5fd3da]" aria-hidden="true" />
                  {STUDIO_PROP_GROUP_LABELS[group]}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {props.map((prop) => (
                    <PropChip
                      key={prop.id}
                      prop={prop}
                      selected={selectedIds.includes(prop.id)}
                      disabled={disabled}
                      onToggle={onToggle}
                      labelledOnly
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PropChip({
  prop,
  selected,
  disabled,
  onToggle,
  labelledOnly = false,
}: {
  prop: StudioProp
  selected: boolean
  disabled: boolean
  onToggle: (id: string) => void
  labelledOnly?: boolean
}) {
  return (
    <button
      type="button"
      data-testid={labelledOnly ? undefined : `studio-prop-${prop.id}`}
      aria-pressed={selected}
      aria-label={`${selected ? 'Remove' : 'Add'} ${prop.label}`}
      disabled={disabled}
      title={prop.description}
      onClick={() => onToggle(prop.id)}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40',
        selected
          ? 'border-[#01b3bf] bg-[#01b3bf]/15 text-white ring-1 ring-[#01b3bf]'
          : 'border-white/[0.16] bg-white/[0.04] text-white/80 hover:border-[#01b3bf]/50',
        disabled && 'cursor-not-allowed opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true" className="text-base font-bold leading-none text-[#5fd3da]">
        {selected ? '✓' : '+'}
      </span>
      <span>{prop.label}</span>
    </button>
  )
}
