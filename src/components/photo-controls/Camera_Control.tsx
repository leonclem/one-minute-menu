'use client'

/**
 * Camera_Control — Segmented selector for `scene_setup.angle`
 *
 * Presents the four allowed angle values as a segmented button group with
 * exactly one value selected at a time. Selecting the current value is a no-op
 * (the parent will compute an empty delta and skip mutation dispatch).
 *
 * Controls are disabled until hydration completes (when `disabled` is true).
 *
 * Requirements: 1.5, 4.5, 4.7, 5.1, 5.2
 */

import { ANGLE_VALUES, type AngleValue } from '@/lib/photo-control/minimal-schema'

/** Human-readable labels for each angle value. */
const ANGLE_LABELS: Record<AngleValue, string> = {
  'top-down': 'Top-Down',
  '45-degree': '45°',
  'eye-level': 'Eye-Level',
  'macro-close-up': 'Macro Close-Up',
}

export interface CameraControlProps {
  /** The currently selected angle value. */
  value: AngleValue
  /** Called when the user selects a different angle. */
  onChange: (value: AngleValue) => void
  /** When true, all buttons are disabled (before hydration or during mutation). */
  disabled?: boolean
}

export function Camera_Control({ value, onChange, disabled = false }: CameraControlProps) {
  return (
    <div role="group" aria-label="Camera angle">
      <p className="mb-2 text-sm font-medium text-gray-700">Camera Angle</p>
      <div className="flex rounded-md border border-gray-300 overflow-hidden">
        {ANGLE_VALUES.map((angle, index) => {
          const isSelected = angle === value
          const isFirst = index === 0

          return (
            <button
              key={angle}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={ANGLE_LABELS[angle]}
              disabled={disabled}
              onClick={() => onChange(angle)}
              className={[
                'flex-1 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
                !isFirst && 'border-l border-gray-300',
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
                disabled && 'cursor-not-allowed opacity-50',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {ANGLE_LABELS[angle]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
