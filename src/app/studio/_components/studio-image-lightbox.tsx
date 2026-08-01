'use client'

/**
 * Expanded view for a Studio export variant. Click a tile preview to open it
 * at full size without leaving the editor.
 */

import { useCallback, useEffect, useRef } from 'react'

interface StudioImageLightboxProps {
  open: boolean
  imageUrl: string | null
  title: string
  subtitle?: string
  /** Checkerboard behind transparent PNGs so alpha reads as transparency. */
  transparent?: boolean
  onClose: () => void
}

const CHECKERBOARD =
  'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 20px 20px'

export function StudioImageLightbox({
  open,
  imageUrl,
  title,
  subtitle,
  transparent = false,
  onClose,
}: StudioImageLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, open])

  if (!open || !imageUrl) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden border border-white/10 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b bg-neutral-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div
          className="flex flex-1 items-center justify-center overflow-auto p-4"
          style={transparent ? { background: CHECKERBOARD } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${title} export preview`}
            className="max-h-[70vh] w-auto max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  )
}
