'use client'

import { STUDIO_PROPS } from '@/lib/studio/props'

interface StudioPropsControlProps {
  disabled?: boolean
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function StudioPropsControl({
  disabled = false,
  selectedIds,
  onToggle,
}: StudioPropsControlProps) {
  return (
    <div className="space-y-2" data-testid="studio-props">
      <p className="text-xs leading-5 text-white/45">
        Stages props for Generate. Each choice uses a fixed description, with no reference photo.
        Select more than one if you want them in the same shot.
      </p>
      <div aria-label="Props" className="flex flex-wrap gap-2">
        {STUDIO_PROPS.map((prop) => {
          const selected = selectedIds.includes(prop.id)
          return (
            <button
              key={prop.id}
              type="button"
              data-testid={`studio-prop-${prop.id}`}
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
        })}
      </div>
    </div>
  )
}
