'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ZoomableImageModalProps {
  isOpen: boolean
  onClose: () => void
  url: string
  alt: string
}

export default function ZoomableImageModal({ isOpen, onClose, url, alt }: ZoomableImageModalProps) {
  const [scale, setScale] = useState(1)
  const [translateX, setTranslateX] = useState(0)
  const [translateY, setTranslateY] = useState(0)
  
  // Refs for drag state to ensure 60fps performance and no closure staleness
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0
  })
  const containerRef = useRef<HTMLDivElement>(null)

  // Touch state
  const [pinchStartDistance, setPinchStartDistance] = useState<number | null>(null)
  const [pinchStartScale, setPinchStartScale] = useState(1)
  const [panLastX, setPanLastX] = useState<number | null>(null)
  const [panLastY, setPanLastY] = useState<number | null>(null)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null)
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null)
  const [swipeDeltaY, setSwipeDeltaY] = useState(0)

  const isWebp = (u?: string) => !!u && /\.webp($|\?)/i.test(u)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    
    // Lock body scroll
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, onClose])

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
      dragRef.current = { isDragging: false, startX: 0, startY: 0, lastX: 0, lastY: 0 }
    }
  }, [isOpen])

  // Attach non-passive wheel listener to prevent body scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container || !isOpen) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      
      const delta = -Math.sign(e.deltaY) * 0.5
      setScale(s => {
        const next = Math.max(1, Math.min(4, s + delta))
        return next
      })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [isOpen])
  
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
  type Point = { clientX: number; clientY: number }
  
  const distance = (a: Point, b: Point) => {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.hypot(dx, dy)
  }

  // Touch Handlers
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
      onClose()
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

  // Mouse Handlers for Desktop
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    e.preventDefault()
    
    if (scale > 1) {
      // Start dragging
      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        lastX: translateX,
        lastY: translateY
      }
    } else {
      // Just click for zoom toggle later?
      // For now, do nothing special, but preventing default is good.
    }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current.isDragging) {
      e.preventDefault()
      const deltaX = e.clientX - dragRef.current.startX
      const deltaY = e.clientY - dragRef.current.startY
      setTranslateX(dragRef.current.lastX + deltaX)
      setTranslateY(dragRef.current.lastY + deltaY)
    }
  }

  const onMouseUp = (e: React.MouseEvent) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false
    } else {
      // If it was a click without drag, and scale is 1, maybe zoom in?
      // Or if scale > 1, zoom out?
      // Let's implement simple tap-to-zoom for convenience
      if (e.clientX === dragRef.current.startX && e.clientY === dragRef.current.startY) {
         // It was a click
         if (scale === 1) {
           setScale(2)
         } else {
            // Optional: Reset on click? Or maybe just let them use close button.
            // For now, keep it simple.
         }
      }
    }
    
    // Snap back if at base scale
    if (scale === 1) {
        setTranslateX(0)
        setTranslateY(0)
    }
  }
  
  // Handle mouse leave as mouse up
  const onMouseLeave = onMouseUp

  if (!isOpen) return null

  // Use portal to render modal at body level to avoid positioning issues
  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview: ${alt}`}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center touch-none select-none overflow-hidden px-4 sm:px-8"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/* Close button fixed at top right of screen */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[10000] rounded-full bg-white text-gray-900 p-3 shadow-2xl hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-white/50 transition-all"
          aria-label="Close image preview"
          title="Close (Esc)"
        >
          <svg
            className="h-6 w-6 sm:h-7 sm:w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <picture>
          {isWebp(url) && (
            <source type="image/webp" srcSet={url} />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className={`max-w-full max-h-[80vh] w-auto h-auto object-contain transition-transform duration-75 ${
              dragRef.current.isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'
            }`}
            style={{
              transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
              // Use faster transition during drag/pinch for responsiveness, smoother for snaps
              transition: dragRef.current.isDragging || pinchStartDistance ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)'
            }}
            draggable={false}
          />
        </picture>
        
        {/* Zoom hints / controls */}
        {scale > 1 && (
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full pointer-events-none">
               {Math.round(scale * 100)}%
           </div>
        )}
      </div>
    </div>
  )

  // Render to document body using portal
  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
