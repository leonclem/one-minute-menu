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
      <div className="flex h-16 w-full items-center justify-center rounded-md bg-gradient-to-br from-gray-100 to-gray-200 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={controlAssetSrc(basename)}
      alt=""
      className="h-16 w-full rounded-md object-cover"
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
      className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-0.5"
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
              'rounded-md border p-1.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ux-primary/40',
              selected
                ? 'border-ux-primary bg-ux-primary/5 ring-1 ring-ux-primary'
                : 'border-gray-200 bg-white hover:border-gray-300',
              disabled && 'cursor-not-allowed opacity-50',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <TileImage basename={option.assetBasename} label={option.label} />
            <span className="mt-1.5 block text-center text-xs font-medium text-gray-800">
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
