'use client'

import { useEffect, useState } from 'react'

import {
  DEFAULT_FINISHING_TOUCH_AMOUNT,
  FINISHING_TOUCH_AMOUNT_ORDER,
  MAX_FINISHING_TOUCH_LEVEL,
  stackFromIds,
  type FinishingTouchAmount,
  type FinishingTouchCatalogueItem,
  type FinishingTouchFamily,
} from '@/lib/studio/finishing-touches'

import { StudioFinishingTouchesBrowse } from './studio-finishing-touches-browse'

const SUGGESTION_PAGE_SIZE = 4

const AMOUNT_LABELS: Record<FinishingTouchAmount, string> = {
  small: 'Small',
  medium: 'Medium',
  high: 'High',
}

const AMOUNT_INDEX: Record<FinishingTouchAmount, number> = {
  small: 0,
  medium: 1,
  high: 2,
}

interface StudioFinishingTouchesControlProps {
  disabled?: boolean
  loading?: boolean
  error?: string | null
  stackLoaded: boolean
  selectedIds: string[]
  options: FinishingTouchCatalogueItem[]
  maxSelected?: number
  amount?: FinishingTouchAmount
  /** Null hides Browse until a family is known. Omitted stays on the savoury list. */
  audience?: FinishingTouchFamily | null
  onRequestStack: () => void
  onToggle: (id: string) => void
  onAmountChange?: (amount: FinishingTouchAmount) => void
}

export function StudioFinishingTouchesControl({
  disabled = false,
  loading = false,
  error = null,
  stackLoaded,
  selectedIds,
  options,
  maxSelected = MAX_FINISHING_TOUCH_LEVEL,
  amount = DEFAULT_FINISHING_TOUCH_AMOUNT,
  audience = 'savory',
  onRequestStack,
  onToggle,
  onAmountChange,
}: StudioFinishingTouchesControlProps) {
  const atSelectionCap = selectedIds.length >= maxSelected
  const optionKey = options.map((option) => option.id).join('|')
  const [visibleCount, setVisibleCount] = useState(SUGGESTION_PAGE_SIZE)
  const [browseOpen, setBrowseOpen] = useState(false)
  useEffect(() => {
    setVisibleCount(SUGGESTION_PAGE_SIZE)
  }, [optionKey])
  const visibleOptions = options.slice(0, visibleCount)
  const visibleIds = new Set(visibleOptions.map((option) => option.id))
  const selectedHidden = stackFromIds(selectedIds).filter((item) => !visibleIds.has(item.id))
  const hiddenCount = options.length - visibleOptions.length
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
      <p className="text-xs text-white/40">{helperCopy}</p>
      {stackLoaded ? (
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={FINISHING_TOUCH_AMOUNT_ORDER.length - 1}
            step={1}
            value={AMOUNT_INDEX[amount]}
            aria-label="Garnish amount"
            aria-valuetext={AMOUNT_LABELS[amount]}
            disabled={disabled}
            data-testid="studio-finishing-amount"
            onChange={(event) => {
              const next = FINISHING_TOUCH_AMOUNT_ORDER[Number(event.target.value)]
              if (next) onAmountChange?.(next)
            }}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#01b3bf] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex justify-between text-[11px] font-semibold">
            {FINISHING_TOUCH_AMOUNT_ORDER.map((value) => (
              <span
                key={value}
                className={amount === value ? 'text-white' : 'text-white/35'}
              >
                {AMOUNT_LABELS[value]}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-[#ff8a80]" role="alert">
          {error}
        </p>
      ) : null}
      {stackLoaded && options.length === 0 && selectedHidden.length === 0 ? (
        <p className="text-xs text-white/40">This dish already looks finished.</p>
      ) : null}
      {visibleOptions.length > 0 || selectedHidden.length > 0 ? (
        <div aria-label="Suggested finishing touches" className="flex flex-wrap gap-2">
          {visibleOptions.map((option) => (
            <SuggestionChip
              key={option.id}
              item={option}
              selected={selectedIds.includes(option.id)}
              disabled={disabled || (!selectedIds.includes(option.id) && atSelectionCap)}
              onToggle={onToggle}
            />
          ))}
          {selectedHidden.map((option) => (
            <SuggestionChip
              key={option.id}
              item={option}
              selected
              disabled={disabled}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col items-start gap-2">
        {hiddenCount > 0 ? (
          <button
            type="button"
            className="text-xs font-medium text-[#5fd3da] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40"
            onClick={() => setVisibleCount((count) => count + SUGGESTION_PAGE_SIZE)}
          >
            {`Show ${Math.min(SUGGESTION_PAGE_SIZE, hiddenCount)} more`}
          </button>
        ) : null}
        {audience != null ? (
          <button
            type="button"
            className="text-xs font-medium text-[#5fd3da] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40"
            aria-haspopup="dialog"
            onClick={() => setBrowseOpen(true)}
          >
            Browse garnishes
          </button>
        ) : null}
      </div>
      {audience != null ? (
        <StudioFinishingTouchesBrowse
          open={browseOpen}
          disabled={disabled}
          atSelectionCap={atSelectionCap}
          audience={audience}
          selectedIds={selectedIds}
          onToggle={onToggle}
          onClose={() => setBrowseOpen(false)}
        />
      ) : null}
    </div>
  )
}

function SuggestionChip({
  item,
  selected,
  disabled,
  onToggle,
}: {
  item: FinishingTouchCatalogueItem
  selected: boolean
  disabled: boolean
  onToggle: (id: string) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? 'Remove' : 'Add'} ${item.name}`}
      disabled={disabled}
      onClick={() => onToggle(item.id)}
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
      <span>{item.name}</span>
    </button>
  )
}
