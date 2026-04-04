'use client'

import { Sun, Monitor, Moon } from 'lucide-react'

interface LightingSelectorProps {
  selected: 'natural' | 'studio' | 'moody'
  onChange: (lighting: 'natural' | 'studio' | 'moody') => void
  disabled?: boolean
}

export default function LightingSelector({ selected, onChange, disabled }: LightingSelectorProps) {
  const options = [
    { id: 'natural', label: 'Natural', icon: Sun },
    { id: 'studio', label: 'Studio', icon: Monitor },
    { id: 'moody', label: 'Moody', icon: Moon }
  ] as const

  return (
    <section>
      <h3 className="text-sm font-bold text-secondary-900 uppercase tracking-wider mb-4">2. Choose Lighting</h3>
      <div className="flex flex-wrap gap-3">
        {options.map((light) => (
          <button
            key={light.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(light.id)}
            className={`flex items-center gap-3 px-5 py-3 rounded-full border-2 transition-all font-bold text-sm ${
              selected === light.id 
                ? 'border-[#01B3BF] bg-[#01B3BF] text-white' 
                : 'border-secondary-100 text-secondary-600 hover:border-secondary-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <light.icon className="w-4 h-4" />
            {light.label}
          </button>
        ))}
      </div>
    </section>
  )
}
