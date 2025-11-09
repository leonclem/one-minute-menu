'use client'

import React from 'react'

interface MenuThumbnailBadgeProps {
  imageUrl?: string | null
  position?: 'left' | 'right'
}

/**
 * Small angled thumbnail used as a subtle, persistent visual reference
 * to the currently processed menu image. Hidden on small screens.
 */
export function MenuThumbnailBadge({ imageUrl, position = 'right' }: MenuThumbnailBadgeProps) {
  if (!imageUrl) return null

  const sideClass = position === 'left' ? 'left-0' : 'right-0'
  const rotateClass = position === 'left' ? '-rotate-6 origin-bottom-left' : 'rotate-6 origin-bottom-right'

  return (
    <div className={`hidden md:block pointer-events-none absolute ${sideClass} bottom-0 -z-10`} aria-hidden>
      <div className={`${rotateClass} rounded-md shadow-lg ring-1 ring-black/10 overflow-hidden bg-white/80`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Selected menu" className="block w-24 h-28 md:w-28 md:h-32 object-cover opacity-60" />
      </div>
    </div>
  )
}


