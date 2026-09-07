'use client'

import { useState } from 'react'
import { controlAssetSrc, type StudioVisualOption } from '@/lib/studio/control-options'

interface VisualOptionTilesProps<T extends string> {
  options: StudioVisualOption<T>[]
  value: T
  disabled?: boolean
  onChange: (value: T) => void
  ariaLabel: string
}

function TileImage({ basename, label }: { basename: string; label: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[10px] font-semibold uppercase tracking-wide text-white/40">
        {label}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={controlAssetSrc(basename)}
      alt=""
      className="h-12 w-16 shrink-0 rounded-md object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export function VisualOptionTiles<T extends string>({
  options,
  value,
  disabled = false,
  onChange,
  ariaLabel,
}: VisualOptionTilesProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-1 gap-2"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={[
              'studio-option-tile flex w-full items-center gap-3 rounded-[11px] border p-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40',
              selected
                ? 'border-[#01b3bf] bg-[#01b3bf]/10 ring-1 ring-[#01b3bf]'
                : 'border-white/[0.1] bg-white/[0.03] hover:border-white/[0.16]',
              disabled && 'cursor-not-allowed opacity-50',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <TileImage basename={option.assetBasename} label={option.label} />
            <span className="text-sm font-medium text-white">
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
