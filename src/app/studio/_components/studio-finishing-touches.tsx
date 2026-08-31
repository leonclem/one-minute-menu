'use client'

import type { FinishingTouchCatalogueItem } from '@/lib/studio/finishing-touches'

interface StudioFinishingTouchesControlProps {
  disabled?: boolean
  loading?: boolean
  error?: string | null
  stackLoaded: boolean
  selectedIds: string[]
  options: FinishingTouchCatalogueItem[]
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
  onRequestStack,
  onToggle,
}: StudioFinishingTouchesControlProps) {
  return (
    <div className="space-y-2" data-testid="studio-finishing-touches">
      <button
        type="button"
        data-testid="studio-finishing-touches-load"
        disabled={disabled || loading}
        onClick={onRequestStack}
        className={[
          'w-full rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm',
          'hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50',
          (disabled || loading) && 'cursor-not-allowed opacity-50',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {loading ? 'Choosing finishing touches…' : 'Add finishing touches'}
      </button>
      <p className="text-xs text-gray-500">
        Stages garnishes for Generate. Does not run until you hit Generate.
      </p>
      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {stackLoaded && options.length === 0 ? (
        <p className="text-xs text-gray-500">This dish already looks finished.</p>
      ) : null}
      {options.length > 0 ? (
        <div
          aria-label="Suggested finishing touches"
          className="flex flex-wrap gap-2"
        >
          {options.map((option) => {
            const selected = selectedIds.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${selected ? 'Remove' : 'Add'} ${option.name}`}
                disabled={disabled}
                onClick={() => onToggle(option.id)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ux-primary/40',
                  selected
                    ? 'border-ux-primary bg-ux-primary/10 text-gray-900 ring-1 ring-ux-primary'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-ux-primary/50',
                  disabled && 'cursor-not-allowed opacity-50',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="text-base font-bold leading-none text-ux-primary"
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
