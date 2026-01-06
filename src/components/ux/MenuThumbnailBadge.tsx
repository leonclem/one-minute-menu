'use client'

import React from 'react'

interface MenuThumbnailBadgeProps {
  imageUrl?: string | null
  position?: 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Small angled thumbnail used as a subtle visual reference.
 * Can be used as a persistent background element (default) or an inline thumbnail (when size is provided).
 */
export function MenuThumbnailBadge({ imageUrl, position = 'right', size }: MenuThumbnailBadgeProps) {
  if (!imageUrl) return null

  // Inline mode if size is provided
  if (size) {
    const sizeClasses = {
      sm: 'w-12 h-14',
      md: 'w-20 h-24',
      lg: 'w-32 h-40'
    }
    
    return (
      <div className={`shrink-0 rounded-lg shadow-md ring-1 ring-black/10 overflow-hidden bg-white rotate-2`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className={`block ${sizeClasses[size]} object-cover`}
          loading="lazy"
        />
      </div>
    )
  }

  const sideClass = position === 'left' ? 'left-0' : 'right-0'
  const rotateClass = position === 'left' ? '-rotate-6 origin-bottom-left' : 'rotate-6 origin-bottom-right'

  return (
    <div className={`hidden md:block pointer-events-none absolute ${sideClass} bottom-0 -z-10`} aria-hidden>
      <div className={`${rotateClass} rounded-md shadow-lg ring-1 ring-black/10 overflow-hidden bg-white/80`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="block w-24 h-28 md:w-28 md:h-32 object-cover opacity-60"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  )
}


