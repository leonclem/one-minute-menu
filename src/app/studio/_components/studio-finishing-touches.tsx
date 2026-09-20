'use client'

import {
  MAX_FINISHING_TOUCH_LEVEL,
  type FinishingTouchCatalogueItem,
} from '@/lib/studio/finishing-touches'

interface StudioFinishingTouchesControlProps {
  disabled?: boolean
  loading?: boolean
  error?: string | null
  stackLoaded: boolean
  selectedIds: string[]
  options: FinishingTouchCatalogueItem[]
  maxSelected?: number
  onRequestStack: () => void
  onToggle: (id: string) => void
}

export function StudioFinishingTouchesControl({
  disabled = false,
  loading = false,
  error = null,
  stackLoaded,
  selectedIds,
  options,
  maxSelected = MAX_FINISHING_TOUCH_LEVEL,
  onRequestStack,
  onToggle,
}: StudioFinishingTouchesControlProps) {
  const atSelectionCap = selectedIds.length >= maxSelected
  const helperCopy =
    options.length > maxSelected
      ? `Pick up to ${maxSelected} for Generate. Does not run until you hit Generate.`
      : 'Stages garnishes for Generate. Does not run until you hit Generate.'
  return (
    <div className="space-y-2" data-testid="studio-finishing-touches">
      <button
        type="button"
        data-testid="studio-finishing-touches-load"
        disabled={disabled || loading}
        onClick={onRequestStack}
        className={[
          'w-full rounded-[9px] bg-[#f8bc02] px-3 py-1.5 text-sm font-semibold text-[#03272a] shadow-sm',
          'hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#f8bc02]/50',
          (disabled || loading) && 'cursor-not-allowed opacity-50',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {loading ? 'Choosing finishing touches…' : 'Add finishing touches'}
      </button>
      <p className="text-xs text-white/40">
        {helperCopy}
      </p>
      {error ? (
        <p className="text-xs text-[#ff8a80]" role="alert">
          {error}
        </p>
      ) : null}
      {stackLoaded && options.length === 0 ? (
        <p className="text-xs text-white/40">This dish already looks finished.</p>
      ) : null}
      {options.length > 0 ? (
        <div
          aria-label="Suggested finishing touches"
          className="flex flex-wrap gap-2"
        >
          {options.map((option) => {
            const selected = selectedIds.includes(option.id)
            const chipDisabled = disabled || (!selected && atSelectionCap)
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${selected ? 'Remove' : 'Add'} ${option.name}`}
                disabled={chipDisabled}
                onClick={() => onToggle(option.id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40',
                  selected
                    ? 'border-[#01b3bf] bg-[#01b3bf]/15 text-white ring-1 ring-[#01b3bf]'
                    : 'border-white/[0.16] bg-white/[0.04] text-white/80 hover:border-[#01b3bf]/50',
                  chipDisabled && 'cursor-not-allowed opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="text-base font-bold leading-none text-[#5fd3da]"
                >
                  {selected ? '✓' : '+'}
                </span>
                <span>{option.name}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
