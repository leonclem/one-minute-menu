'use client'

/**
 * Shared tap-to-expand preview used by the Workbench and export tiles.
 * Hover/focus shows an EXPAND overlay; click opens StudioImageLightbox.
 */

import Image from 'next/image'

const CHECKERBOARD =
  'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 12px 12px'

interface StudioExpandablePreviewProps {
  src: string
  /** Decorative when the button already names the image; otherwise a short description. */
  alt?: string
  expandLabel: string
  onExpand: () => void
  transparent?: boolean
  className?: string
  imageClassName?: string
  overlayClassName?: string
}

export function StudioExpandablePreview({
  src,
  alt = '',
  expandLabel,
  onExpand,
  transparent = false,
  className = '',
  imageClassName = 'h-full w-full object-contain',
  overlayClassName = '',
}: StudioExpandablePreviewProps) {
  return (
    <button
      type="button"
      aria-label={expandLabel}
      className={`group relative block w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary ${className}`.trim()}
      style={transparent ? { background: CHECKERBOARD } : undefined}
      onClick={onExpand}
    >
      <span className={`relative block ${imageClassName}`.trim()}>
        <Image src={src} alt={alt} fill sizes="(max-width: 1024px) 100vw, 1024px" className="object-contain" />
      </span>
      <span
        className={`pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/40 text-[11px] font-bold uppercase tracking-wide text-white group-hover:flex group-focus-visible:flex ${overlayClassName}`.trim()}
      >
        Expand
      </span>
    </button>
  )
}
