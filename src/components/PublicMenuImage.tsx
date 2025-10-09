'use client'

import { useEffect, useState } from 'react'

interface PublicMenuImageProps {
  url: string
  alt: string
  size?: 'sm' | 'md'
}

export default function PublicMenuImage({ url, alt, size = 'md' }: PublicMenuImageProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [translateX, setTranslateX] = useState(0)
  const [translateY, setTranslateY] = useState(0)
  const [pinchStartDistance, setPinchStartDistance] = useState<number | null>(null)
  const [pinchStartScale, setPinchStartScale] = useState(1)
  const [panLastX, setPanLastX] = useState<number | null>(null)
  const [panLastY, setPanLastY] = useState<number | null>(null)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null)
  const [swipeDeltaY, setSwipeDeltaY] = useState(0)

  const isWebp = (u?: string) => !!u && /\.webp($|\?)/i.test(u)

  const dim = size === 'sm' ? { w: 48, h: 48, cls: 'h-12 w-12' } : { w: 64, h: 64, cls: 'h-16 w-16' }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      // Reset transforms when closing
      setScale(1)
      setTranslateX(0)
      setTranslateY(0)
      setPinchStartDistance(null)
      setPanLastX(null)
      setPanLastY(null)
      setSwipeStartX(null)
      setSwipeStartY(null)
      setSwipeDeltaY(0)
    }
  }, [isOpen])

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
  type TouchPoint = { clientX: number; clientY: number }
  const distance = (a: TouchPoint, b: TouchPoint) => {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.hypot(dx, dy)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1])
      setPinchStartDistance(d)
      setPinchStartScale(scale)
    } else if (e.touches.length === 1) {
      const t = e.touches[0]
      setPanLastX(t.clientX)
      setPanLastY(t.clientY)
      setSwipeStartX(t.clientX)
      setSwipeStartY(t.clientY)
      setSwipeDeltaY(0)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    // Prevent background scroll while interacting
    e.preventDefault()
    if (e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1])
      if (pinchStartDistance) {
        const factor = d / pinchStartDistance
        const next = clamp(pinchStartScale * factor, 1, 4)
        setScale(next)
      }
    } else if (e.touches.length === 1) {
      const t = e.touches[0]
      // Pan when zoomed
      if (scale > 1 && panLastX !== null && panLastY !== null) {
        const dx = t.clientX - panLastX
        const dy = t.clientY - panLastY
        setTranslateX(prev => prev + dx)
        setTranslateY(prev => prev + dy)
        setPanLastX(t.clientX)
        setPanLastY(t.clientY)
      }
      // Track swipe-to-dismiss when not zoomed
      if (scale <= 1.05 && swipeStartY !== null && swipeStartX !== null) {
        setSwipeDeltaY(t.clientY - swipeStartY)
      }
    }
  }

  const onTouchEnd = () => {
    // Close on vertical swipe if not zoomed
    if (scale <= 1.05 && Math.abs(swipeDeltaY) > 90) {
      setIsOpen(false)
      return
    }
    // Snap back translate when at base scale
    if (scale === 1) {
      setTranslateX(0)
      setTranslateY(0)
    }
    // Reset pinch baseline if fingers lifted
    setPinchStartDistance(null)
    setPanLastX(null)
    setPanLastY(null)
    setSwipeStartX(null)
    setSwipeStartY(null)
    setSwipeDeltaY(0)
  }

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

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Image preview: ${alt}`}
        >
          <div
            className="relative max-w-screen-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute -top-2 -right-2 rounded-full bg-white/90 text-secondary-700 shadow p-1 hover:bg-white"
              aria-label="Close image preview"
              autoFocus
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div
              className="relative overflow-hidden touch-none select-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <picture>
                {isWebp(url) && (
                  <source type="image/webp" srcSet={url} />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={alt}
                  className="w-full h-auto rounded shadow-xl bg-white"
                  style={{ transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})` }}
                />
              </picture>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


