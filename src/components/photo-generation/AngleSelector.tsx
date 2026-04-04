'use client'

import { Camera, Zap } from 'lucide-react'

interface AngleSelectorProps {
  selected: 'overhead' | '45' | 'front'
  onChange: (angle: 'overhead' | '45' | 'front') => void
  disabled?: boolean
}

export default function AngleSelector({ selected, onChange, disabled }: AngleSelectorProps) {
  const angles = [
    { id: 'overhead', label: 'Overhead', desc: 'Flat lay' },
    { id: '45', label: '45° Angle', desc: 'Natural' },
    { id: 'front', label: 'Front', desc: 'Eye-level' }
  ] as const

  return (
    <section>
      <h3 className="text-sm font-bold text-secondary-900 uppercase tracking-wider mb-4">1. Choose Angle</h3>
      <div className="grid grid-cols-3 gap-4">
        {angles.map((angle) => (
          <button
            key={angle.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(angle.id)}
            className={`relative p-4 rounded-2xl border-2 transition-all text-center group ${
              selected === angle.id 
                ? 'border-[#01B3BF] bg-[#01B3BF]/5' 
                : 'border-secondary-100 hover:border-secondary-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center transition-colors ${
              selected === angle.id ? 'bg-[#01B3BF] text-white' : 'bg-secondary-50 text-secondary-400 group-hover:bg-secondary-100'
            }`}>
              <Camera className="w-6 h-6" />
            </div>
            <div className="font-bold text-sm text-secondary-900">{angle.label}</div>
            <div className="text-[10px] text-secondary-400 uppercase font-medium mt-1">{angle.desc}</div>
            {selected === angle.id && (
              <div className="absolute -top-2 -right-2 bg-[#01B3BF] text-white rounded-full p-1 shadow-sm">
                <Zap className="w-3 h-3 fill-current" />
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
