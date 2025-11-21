'use client'

import { useState } from 'react'
import ZoomableImageModal from './ZoomableImageModal'

interface PublicMenuImageProps {
  url: string
  alt: string
  size?: 'sm' | 'md'
}

export default function PublicMenuImage({ url, alt, size = 'md' }: PublicMenuImageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isWebp = (u?: string) => !!u && /\.webp($|\?)/i.test(u)
  const dim = size === 'sm' ? { w: 48, h: 48, cls: 'h-12 w-12' } : { w: 64, h: 64, cls: 'h-16 w-16' }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="block rounded border focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-zoom-in"
        aria-label={`View larger image for ${alt}`}
        title="View larger"
      >
        <picture>
          {isWebp(url) && (
            <source type="image/webp" srcSet={url} />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            loading="lazy"
            decoding="async"
            width={dim.w}
            height={dim.h}
            className={`${dim.cls} rounded object-cover bg-gray-100`}
          />
        </picture>
      </button>

      <ZoomableImageModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        url={url}
        alt={alt}
      />
    </>
  )
}
