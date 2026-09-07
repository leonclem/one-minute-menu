'use client'

/**
 * Full-size image preview for export tiles.
 * Workbench expand uses the live canvas overlay instead.
 */

import Image from 'next/image'
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
      className="studio-shell fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex h-[min(96dvh,100%)] w-full max-w-[96rem] flex-col overflow-hidden rounded-[16px] border border-white/10 bg-[#0c1416] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-sm font-bold text-white">{subtitle}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="studio-btn-ghost shrink-0"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div
          className={[
            'flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-4',
            transparent ? 'studio-checkerboard' : '',
          ].join(' ')}
        >
          <div className="relative h-full w-full">
            <Image
              src={imageUrl}
              alt={`${title} preview`}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
