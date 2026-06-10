'use client'

/**
 * Lighting_Control — Two-state toggle for `scene_setup.lighting`
 *
 * Presents a toggle between `low-key` and `bright-and-airy`. Toggling always
 * switches to the other value; the parent computes the delta and dispatches
 * mutation.
 *
 * Controls are disabled until hydration completes (when `disabled` is true).
 *
 * Requirements: 1.5, 4.5, 4.7, 6.1, 6.2
 */

import { LIGHTING_VALUES, type LightingValue } from '@/lib/photo-control/minimal-schema'

const LIGHTING_LABELS: Record<LightingValue, string> = {
  'low-key': 'Low-Key',
  'bright-and-airy': 'Bright & Airy',
}

const LIGHTING_DESCRIPTIONS: Record<LightingValue, string> = {
  'low-key': 'Dramatic lighting, rich shadows',
  'bright-and-airy': 'Clean high-key diffused light',
}

export interface LightingControlProps {
  /** The currently selected lighting value. */
  value: LightingValue
  /** Called when the user selects a different lighting. */
  onChange: (value: LightingValue) => void
  /** When true, the buttons are disabled (before hydration or during mutation). */
  disabled?: boolean
}

export function Lighting_Control({ value, onChange, disabled = false }: LightingControlProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">Lighting</p>
      <div className="flex rounded-md border border-gray-300 overflow-hidden">
        {LIGHTING_VALUES.map((lighting, index) => {
          const isSelected = lighting === value
          const isFirst = index === 0

          return (
            <button
              key={lighting}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${LIGHTING_LABELS[lighting]}: ${LIGHTING_DESCRIPTIONS[lighting]}`}
              disabled={disabled}
              onClick={() => {
                if (!isSelected) {
                  onChange(lighting)
                }
              }}
              className={[
                'flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
                !isFirst && 'border-l border-gray-300',
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
                disabled && 'cursor-not-allowed opacity-50',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="block">{LIGHTING_LABELS[lighting]}</span>
              <span
                className={[
                  'block text-xs mt-0.5',
                  isSelected ? 'text-blue-100' : 'text-gray-500',
                ].join(' ')}
              >
                {LIGHTING_DESCRIPTIONS[lighting]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
