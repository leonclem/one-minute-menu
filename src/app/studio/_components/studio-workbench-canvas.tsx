'use client'

/**
 * Workbench canvas: always fits the full image, then zoom / pan / reset.
 * Expand stays a toolbar action so dragging is not captured by a full-image click.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'

import {
  clampPan,
  clampZoom,
  computeFitScale,
  imageBox,
  WORKBENCH_FIT_CAMERA,
  WORKBENCH_ZOOM_STEP,
  type WorkbenchCamera,
  zoomAroundPoint,
} from '@/lib/studio/workbench-viewport'

const CHECKERBOARD =
  'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 12px 12px'

/** Overlay controls opt out of the global 44px touch min so the cluster can share one height. */
const TOOLBAR_CONTROL =
  'box-border h-8 min-h-0 min-w-0 p-0 leading-none text-gray-700'

interface StudioWorkbenchCanvasProps {
  src: string
  alt?: string
  expandLabel: string
  onExpand: () => void
  transparent?: boolean
}

export function StudioWorkbenchCanvas({
  src,
  alt = '',
  expandLabel,
  onExpand,
  transparent = false,
}: StudioWorkbenchCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; camera: WorkbenchCamera } | null>(
    null,
  )
  const cameraRef = useRef<WorkbenchCamera>(WORKBENCH_FIT_CAMERA)
  const layoutRef = useRef({
    imageWidth: 0,
    imageHeight: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    fitScale: 1,
  })
  const [camera, setCamera] = useState<WorkbenchCamera>(WORKBENCH_FIT_CAMERA)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  const commitCamera = useCallback((next: WorkbenchCamera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  const fitScale = computeFitScale(
    imageSize.width,
    imageSize.height,
    viewportSize.width,
    viewportSize.height,
  )
  layoutRef.current = {
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    fitScale,
  }

  useEffect(() => {
    cameraRef.current = WORKBENCH_FIT_CAMERA
    setCamera(WORKBENCH_FIT_CAMERA)

    let cancelled = false
    const probe = new Image()
    const apply = () => {
      if (cancelled || probe.naturalWidth <= 0) return
      const width = probe.naturalWidth
      const height = probe.naturalHeight
      setImageSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    }
    probe.onload = apply
    probe.src = src
    if (probe.complete) apply()
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    const update = () => {
      const width = el.clientWidth
      const height = el.clientHeight
      setViewportSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      )
    }
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    const onWheel = (event: WheelEvent) => {
      const layout = layoutRef.current
      if (layout.imageWidth <= 0) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = event.deltaY > 0 ? 1 / WORKBENCH_ZOOM_STEP : WORKBENCH_ZOOM_STEP
      commitCamera(
        zoomAroundPoint(
          cameraRef.current,
          cameraRef.current.zoom * factor,
          event.clientX - rect.left,
          event.clientY - rect.top,
          layout.imageWidth,
          layout.imageHeight,
          layout.viewportWidth,
          layout.viewportHeight,
          layout.fitScale,
        ),
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [commitCamera])

  const box =
    imageSize.width > 0 && viewportSize.width > 0
      ? imageBox(
          camera,
          imageSize.width,
          imageSize.height,
          viewportSize.width,
          viewportSize.height,
          fitScale,
        )
      : null

  const applyZoom = (nextZoom: number, pointX: number, pointY: number) => {
    if (imageSize.width <= 0) return
    commitCamera(
      zoomAroundPoint(
        cameraRef.current,
        nextZoom,
        pointX,
        pointY,
        imageSize.width,
        imageSize.height,
        viewportSize.width,
        viewportSize.height,
        fitScale,
      ),
    )
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || cameraRef.current.zoom <= 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: cameraRef.current,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const scale = fitScale * drag.camera.zoom
    commitCamera({
      zoom: drag.camera.zoom,
      ...clampPan(
        drag.camera.panX + (event.clientX - drag.x),
        drag.camera.panY + (event.clientY - drag.y),
        imageSize.width,
        imageSize.height,
        viewportSize.width,
        viewportSize.height,
        scale,
      ),
    })
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const zoomFromCenter = (nextZoom: number) => {
    applyZoom(nextZoom, viewportSize.width / 2, viewportSize.height / 2)
  }

  const atFit = camera.zoom <= 1.01
  const zoomLabel = `${Math.round(camera.zoom * 100)}%`

  return (
    <div className="absolute inset-0">
      <div
        ref={viewportRef}
        tabIndex={0}
        className={[
          'absolute inset-0 overflow-hidden touch-none outline-none',
          camera.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        ].join(' ')}
        style={transparent ? { background: CHECKERBOARD } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => commitCamera(WORKBENCH_FIT_CAMERA)}
        onKeyDown={(event) => {
          if (event.key === '+' || event.key === '=') {
            event.preventDefault()
            zoomFromCenter(clampZoom(camera.zoom * WORKBENCH_ZOOM_STEP))
          } else if (event.key === '-' || event.key === '_') {
            event.preventDefault()
            zoomFromCenter(clampZoom(camera.zoom / WORKBENCH_ZOOM_STEP))
          } else if (event.key === '0') {
            event.preventDefault()
            commitCamera(WORKBENCH_FIT_CAMERA)
          }
        }}
      >
        {box ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} draggable={false} className="h-full w-full object-contain" />
        )}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1">
        <div className="pointer-events-auto flex h-8 overflow-hidden rounded-md border border-black/10 bg-white/95 shadow-sm">
          <button
            type="button"
            className={`${TOOLBAR_CONTROL} inline-flex w-8 items-center justify-center hover:bg-gray-100`}
            aria-label="Zoom out"
            onClick={() => zoomFromCenter(clampZoom(camera.zoom / WORKBENCH_ZOOM_STEP))}
          >
            <Minus className="block h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
          </button>
          <span
            className="inline-flex h-8 min-w-[2.75rem] items-center justify-center border-x border-black/10 px-2 text-center text-xs font-semibold leading-none tabular-nums text-gray-700"
            aria-live="polite"
            aria-label={`Zoom ${zoomLabel}`}
          >
            {zoomLabel}
          </span>
          <button
            type="button"
            className={`${TOOLBAR_CONTROL} inline-flex w-8 items-center justify-center hover:bg-gray-100`}
            aria-label="Zoom in"
            onClick={() => zoomFromCenter(clampZoom(camera.zoom * WORKBENCH_ZOOM_STEP))}
          >
            <Plus className="block h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
          </button>
        </div>
        <button
          type="button"
          className={`${TOOLBAR_CONTROL} pointer-events-auto inline-flex items-center justify-center rounded-md border border-black/10 bg-white/95 px-2.5 text-xs font-semibold shadow-sm hover:bg-gray-100 disabled:cursor-default disabled:text-gray-400 disabled:hover:bg-white/95`}
          aria-label="Reset zoom"
          title="Reset zoom"
          disabled={atFit}
          onClick={() => commitCamera(WORKBENCH_FIT_CAMERA)}
        >
          Reset
        </button>
        <button
          type="button"
          className={`${TOOLBAR_CONTROL} pointer-events-auto inline-flex w-8 items-center justify-center rounded-md border border-black/10 bg-white/95 shadow-sm hover:bg-gray-100`}
          aria-label={expandLabel}
          title={expandLabel}
          onClick={onExpand}
        >
          <Maximize2 className="block h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  )
}
