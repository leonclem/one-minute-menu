'use client'

import { useEffect } from 'react'

interface MenuImageModalProps {
  imageUrl: string
  itemName: string
  isOpen: boolean
  onClose: () => void
}

/**
 * MenuImageModal displays a full-size food image in a modal overlay.
 * Used when users click on camera icons in template-rendered menus.
 * 
 * Features:
 * - Full-size image display with proper aspect ratio
 * - Item name as caption
 * - Close button and click-outside-to-close
 * - Keyboard navigation (Escape to close)
 * - Accessible with proper ARIA labels
 */
export function MenuImageModal({
  imageUrl,
  itemName,
  isOpen,
  onClose
}: MenuImageModalProps) {
  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const isWebp = (url: string) => /\.webp($|\?)/i.test(url)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div
        className="relative max-w-4xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 rounded-full bg-white/90 text-secondary-700 shadow-lg p-2 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          aria-label="Close image preview"
          autoFocus
        >
          <svg 
            className="h-6 w-6" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Image container */}
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <picture>
            {isWebp(imageUrl) && (
              <source type="image/webp" srcSet={imageUrl} />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={itemName}
              className="w-full h-auto max-h-[80vh] object-contain bg-gray-50"
              loading="eager"
            />
          </picture>

          {/* Caption */}
          <div className="px-6 py-4 bg-white border-t border-gray-200">
            <h2 
              id="modal-title" 
              className="text-lg font-medium text-secondary-900 text-center"
            >
              {itemName}
            </h2>
            <p id="modal-description" className="sr-only">
              Full size image of {itemName}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
