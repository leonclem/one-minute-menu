'use client'

import Image from 'next/image'

import { chronologicalShots, shotShortLabel, shotTitle } from '@/lib/studio/lineage'
import type { StudioImageRecord } from '@/lib/studio/types'

interface StudioShotFilmstripProps {
  images: readonly StudioImageRecord[]
  selectedId: string | null
  disabled?: boolean
  onSelect: (image: StudioImageRecord) => void
  onDelete: (image: StudioImageRecord) => void
}

export function StudioShotFilmstrip({
  images,
  selectedId,
  disabled = false,
  onSelect,
  onDelete,
}: StudioShotFilmstripProps) {
  const shots = chronologicalShots(images)

  if (shots.length === 0) {
    return (
      <p className="text-sm text-white/40" data-testid="studio-gallery-empty">
        Shots appear here after you upload and generate.
      </p>
    )
  }

  return (
    <ul className="studio-filmstrip" data-testid="studio-gallery">
      {shots.map((item) => {
        const selected = item.id === selectedId
        const shortLabel = shotShortLabel(item, shots)
        const title = shotTitle(item, shots)
        return (
          <li key={item.id} className="group relative shrink-0">
            <button
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={title}
              className={[
                'block min-h-0 min-w-0 w-20 overflow-hidden rounded-[9px] border-2 p-0 leading-none transition-colors',
                selected ? 'border-[#01b3bf]' : 'border-transparent hover:border-white/25',
                disabled && 'opacity-60',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(item)}
            >
              <Image
                src={item.public_url}
                alt=""
                width={80}
                height={80}
                sizes="80px"
                className="aspect-square w-full bg-black/20 object-cover"
              />
              <span className="block truncate bg-black/30 px-1 py-0.5 text-center text-[10px] font-bold text-white/70">
                {shortLabel}
              </span>
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Delete ${title}`}
              title={`Delete ${title}`}
              className="absolute right-1 top-1 inline-flex h-5 w-5 min-h-0 min-w-0 items-center justify-center rounded p-0 leading-none bg-black/55 text-[#ff8a80] shadow-sm transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
              onClick={() => onDelete(item)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 fill-none stroke-current stroke-[2.25]"
              >
                <path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" />
              </svg>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
