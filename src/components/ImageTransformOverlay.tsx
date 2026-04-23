'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ImageTransform } from '@/types'
import type { ImageModeV2 } from '@/lib/templates/v2/engine-types-v2'

const DRAG_THRESHOLD_PX = 4
const MIN_SCALE_DEFAULT = 1.0
const MIN_SCALE_CUTOUT = 0.4
const MAX_SCALE = 4.0
const WHEEL_SCALE_STEP = 0.08
const DRAG_SENSITIVITY = 1.0
const CUTOUT_OVERFLOW_X_PCT = 30
const CUTOUT_OVERFLOW_TOP_PCT = 100

interface OverlayFrame {
  left: number
  top: number
  width: number
  height: number
  borderRadius?: number
}

interface ImageTransformOverlayProps {
  itemId: string
  imageMode?: ImageModeV2
  currentTransform: ImageTransform | undefined
  onChange: (itemId: string, transform: ImageTransform) => void
  frame?: OverlayFrame
  highlightFrame?: OverlayFrame
}

/**
 * Absolutely-positioned overlay that wraps an image tile in edit mode.
 * Handles drag-to-reposition and scroll-to-zoom.
 */
export function ImageTransformOverlay({
  itemId,
  imageMode,
  currentTransform,
  onChange,
  frame,
  highlightFrame,
}: ImageTransformOverlayProps) {
  const isCutout = imageMode === 'cutout'
  const minScale = isCutout ? MIN_SCALE_CUTOUT : MIN_SCALE_DEFAULT
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const cutoutGlowInsetX = `${(CUTOUT_OVERFLOW_X_PCT / (100 + CUTOUT_OVERFLOW_X_PCT * 2)) * 100}%`
  const cutoutGlowTop = `${(CUTOUT_OVERFLOW_TOP_PCT / (100 + CUTOUT_OVERFLOW_TOP_PCT)) * 100}%`
  const dragXSign = isCutout ? 1 : -1
  const dragYSign = isCutout ? 1 : -1
  const dragState = useRef<{
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
    isDragging: boolean
    thresholdCrossed: boolean
  } | null>(null)

  const touchState = useRef<{
    initialPinchDistance: number | null
    initialScale: number
  } | null>(null)

  const getTransform = useCallback((): ImageTransform => ({
    offsetX: currentTransform?.offsetX ?? 0,
    offsetY: currentTransform?.offsetY ?? 0,
    scale: currentTransform?.scale ?? 1.0,
  }), [currentTransform])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const t = getTransform()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: t.offsetX,
      startOffsetY: t.offsetY,
      isDragging: true,
      thresholdCrossed: false,
    }
  }, [getTransform])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current?.isDragging) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY

    if (!dragState.current.thresholdCrossed) {
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return
      dragState.current.thresholdCrossed = true
    }

    const containerEl = containerRef.current
    const containerRect = containerEl?.getBoundingClientRect()
    const containerW = containerRect?.width || 100
    const containerH = containerRect?.height || 100

    // Keep drag direction consistent with the preview: pulling downward should move
    // the visible subject downward, which requires inverting the stored object-position Y.
    const newOffsetX = dragState.current.startOffsetX + dragXSign * (dx / containerW) * 100 * DRAG_SENSITIVITY
    const newOffsetY = dragState.current.startOffsetY + dragYSign * (dy / containerH) * 100 * DRAG_SENSITIVITY

    const clampedX = Math.max(-50, Math.min(50, newOffsetX))
    const clampedY = Math.max(-50, Math.min(50, newOffsetY))

    const current = getTransform()
    onChange(itemId, { ...current, offsetX: clampedX, offsetY: clampedY })
  }, [dragXSign, dragYSign, getTransform, itemId, onChange])

  const handleMouseUp = useCallback(() => {
    dragState.current = null
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const t = getTransform()
    if (e.touches.length === 1) {
      // Single finger drag
      dragState.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startOffsetX: t.offsetX,
        startOffsetY: t.offsetY,
        isDragging: true,
        thresholdCrossed: false,
      }
      touchState.current = null
    } else if (e.touches.length === 2) {
      // Two finger pinch
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      touchState.current = {
        initialPinchDistance: distance,
        initialScale: t.scale,
      }
      dragState.current = null
    }
  }, [getTransform])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1 && dragState.current?.isDragging) {
      e.preventDefault() // Prevent scrolling while dragging
      const dx = e.touches[0].clientX - dragState.current.startX
      const dy = e.touches[0].clientY - dragState.current.startY

      if (!dragState.current.thresholdCrossed) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return
        dragState.current.thresholdCrossed = true
      }

      const containerEl = containerRef.current
      const containerRect = containerEl?.getBoundingClientRect()
      const containerW = containerRect?.width || 100
      const containerH = containerRect?.height || 100

      const newOffsetX = dragState.current.startOffsetX + dragXSign * (dx / containerW) * 100 * DRAG_SENSITIVITY
      const newOffsetY = dragState.current.startOffsetY + dragYSign * (dy / containerH) * 100 * DRAG_SENSITIVITY

      const clampedX = Math.max(-50, Math.min(50, newOffsetX))
      const clampedY = Math.max(-50, Math.min(50, newOffsetY))

      const current = getTransform()
      onChange(itemId, { ...current, offsetX: clampedX, offsetY: clampedY })
    } else if (e.touches.length === 2 && touchState.current?.initialPinchDistance) {
      e.preventDefault() // Prevent scrolling/zooming while pinching
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      const ratio = distance / touchState.current.initialPinchDistance
      const newScale = Math.max(minScale, Math.min(MAX_SCALE, touchState.current.initialScale * ratio))
      
      const current = getTransform()
      onChange(itemId, { ...current, scale: Math.round(newScale * 100) / 100 })
    }
  }, [dragXSign, dragYSign, getTransform, itemId, onChange, minScale])

  const handleTouchEnd = useCallback(() => {
    dragState.current = null
    touchState.current = null
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const current = getTransform()
    const delta = e.deltaY > 0 ? -WHEEL_SCALE_STEP : WHEEL_SCALE_STEP
    const newScale = Math.max(minScale, Math.min(MAX_SCALE, current.scale + delta))
    onChange(itemId, { ...current, scale: Math.round(newScale * 100) / 100 })
  }, [getTransform, itemId, onChange, minScale])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleWheel, handleMouseMove, handleMouseUp, handleTouchStart, handleTouchMove, handleTouchEnd])

  const glowBorder = isHovered ? '2px solid #14b8a6' : '2px solid transparent'
  const glowShadow = isHovered ? '0 0 0 2px rgba(20,184,166,0.4), inset 0 0 0 1px rgba(20,184,166,0.2)' : undefined

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        ...(frame ? {
          left: frame.left,
          top: frame.top,
          width: frame.width,
          height: frame.height,
          borderRadius: frame.borderRadius,
        } : isCutout ? {
          left: `-${CUTOUT_OVERFLOW_X_PCT}%`,
          right: `-${CUTOUT_OVERFLOW_X_PCT}%`,
          top: `-${CUTOUT_OVERFLOW_TOP_PCT}%`,
          bottom: 0,
        } : {
          inset: 0,
        }),
        cursor: dragState.current?.thresholdCrossed ? 'grabbing' : 'grab',
        zIndex: 20,
        borderRadius: frame?.borderRadius ?? (isCutout ? 0 : 'inherit'),
        boxSizing: 'border-box',
        ...(isCutout ? {} : {
          border: glowBorder,
          boxShadow: glowShadow,
        }),
        transition: 'border-color 0.15s, box-shadow 0.15s',
        pointerEvents: 'all',
        userSelect: 'none',
      }}
      title="Drag to reposition · Scroll to zoom"
    >
      {/* For cutout, glow is on an inner div. When frame is tile-sized, glow fills the overlay. */}
      {isCutout && (
        <div
          style={{
            position: 'absolute',
            ...(highlightFrame ? {
              left: highlightFrame.left,
              top: highlightFrame.top,
              width: highlightFrame.width,
              height: highlightFrame.height,
              borderRadius: highlightFrame.borderRadius ?? 8,
            } : frame ? {
              inset: 0,
              borderRadius: frame.borderRadius ?? 8,
            } : {
              left: cutoutGlowInsetX,
              right: cutoutGlowInsetX,
              top: cutoutGlowTop,
              bottom: 0,
              borderRadius: 8,
            }),
            boxSizing: 'border-box',
            border: glowBorder,
            boxShadow: glowShadow,
            transition: 'border-color 0.15s, box-shadow 0.15s',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
