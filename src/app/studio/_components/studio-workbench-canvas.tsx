'use client'

/**
 * Workbench canvas: always fits the full image, then zoom / pan / reset.
 * Expand stays a toolbar action so dragging is not captured by a full-image click.
 */

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from 'react'
import { Maximize2, Minimize2, Minus, Plus } from 'lucide-react'

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
import {
  addCompletedStrokeAtomic,
  type SelectionRejectReason,
  type SelectionState,
} from '@/lib/studio/object-edit/selection'
import {
  viewportToNormalized,
  type NaturalImageSize,
} from '@/lib/studio/object-edit/coordinate-transform'
import type { NormalizedPoint } from '@/lib/studio/object-edit/contracts'
import { StudioSelectionOverlay } from './studio-object-edit'
import { StudioCropOverlay } from './studio-crop'
import { StudioExpandOverlay, expandPhotoFrameStyle } from './studio-expand'
import { CROP_UNKNOWN_PIXEL_SIZE, type NormalizedCropRect } from '@/lib/studio/crop'
import { EXPAND_MAX_PAD_RATIO, expandPresetDef, type ExpandLayoutId, type ExpandPresetId } from '@/lib/studio/expand'

/** Overlay controls opt out of the global 44px touch min so the cluster can share one height. */
const TOOLBAR_CONTROL =
  'box-border h-11 min-h-11 min-w-11 p-0 leading-none text-white/80'

/**
 * Upper bound on transiently tracked pointer samples for one gesture. High
 * report-rate pointers can emit tens of thousands of samples during a long
 * drag, which is wasted work and a spread-argument hazard downstream.
 */
const MAX_TRACKED_SELECTION_SAMPLES = 4096

type SelectionSample = { x: number; y: number }
type NativePointerEventWithCoalescedEvents = globalThis.PointerEvent & {
  getCoalescedEvents?: () => globalThis.PointerEvent[]
}

function pointerSamples(event: PointerEvent<HTMLDivElement>): SelectionSample[] {
  const nativeEvent = event.nativeEvent as NativePointerEventWithCoalescedEvents
  // Some browsers expose getCoalescedEvents() on down/up but return no samples.
  // The dispatched native event is always the authoritative current position.
  return [...(nativeEvent.getCoalescedEvents?.() ?? []), nativeEvent].map(
    ({ clientX: x, clientY: y }) => ({ x, y }),
  )
}

/**
 * Coalesced samples routinely repeat the dispatched position, so consecutive
 * duplicates are dropped. A single-point sample list is what marks a tap, and
 * that is only reachable when pointer-down dedupes as well.
 */
function appendUniqueSamples(target: SelectionSample[], samples: readonly SelectionSample[]) {
  if (target.length >= MAX_TRACKED_SELECTION_SAMPLES) return
  for (const sample of samples) {
    const last = target[target.length - 1]
    if (!last || last.x !== sample.x || last.y !== sample.y) target.push(sample)
    if (target.length >= MAX_TRACKED_SELECTION_SAMPLES) return
  }
}

function uniqueSamples(samples: readonly SelectionSample[]): SelectionSample[] {
  const collected: SelectionSample[] = []
  appendUniqueSamples(collected, samples)
  return collected
}

/**
 * The release position decides tap classification and terminates the retained
 * path, so it replaces the trailing sample when the tracking cap is already met
 * rather than being discarded.
 */
function appendReleaseSamples(target: SelectionSample[], samples: readonly SelectionSample[]) {
  appendUniqueSamples(target, samples)
  const release = samples[samples.length - 1]
  const last = target[target.length - 1]
  if (!release || !last) return
  if (last.x !== release.x || last.y !== release.y) target[target.length - 1] = release
}

interface StudioWorkbenchCanvasProps {
  src: string
  alt?: string
  expandLabel: string
  onExpand: () => void
  expanded?: boolean
  transparent?: boolean
  selectionMode?: boolean
  selection?: SelectionState
  naturalSize?: NaturalImageSize
  onSelectionChange?: (selection: SelectionState) => void
  onSelectionRejected?: (reason: SelectionRejectReason) => void
  onNaturalSizeChange?: (size: NaturalImageSize) => void
  cropMode?: boolean
  cropRect?: NormalizedCropRect | null
  cropPixelAspect?: number | null
  cropNaturalSize?: NaturalImageSize | null
  onCropRectChange?: (rect: NormalizedCropRect) => void
  sceneExpandMode?: boolean
  expandPreset?: ExpandPresetId
  expandLayout?: ExpandLayoutId
  onExpandGestureChange?: (next: { preset: ExpandPresetId; layout: ExpandLayoutId }) => void
}

export function StudioWorkbenchCanvas({
  src,
  alt = '',
  expandLabel,
  onExpand,
  expanded = false,
  selectionMode = false,
  selection,
  naturalSize,
  onSelectionChange,
  onSelectionRejected,
  onNaturalSizeChange,
  cropMode = false,
  cropRect = null,
  cropPixelAspect = null,
  cropNaturalSize = null,
  onCropRectChange,
  sceneExpandMode = false,
  expandPreset,
  expandLayout,
  onExpandGestureChange,
}: StudioWorkbenchCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; camera: WorkbenchCamera } | null>(
    null,
  )
  const selectionRef = useRef<{ pointerId: number; samples: { x: number; y: number }[] } | null>(null)
  const touchPointersRef = useRef<Set<number>>(new Set())
  const pinchRef = useRef(false)
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
  const [selectionPreview, setSelectionPreview] = useState<NormalizedPoint[]>([])

  const commitCamera = useCallback((next: WorkbenchCamera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  const fitImageWidth = sceneExpandMode
    ? imageSize.width * (1 + 2 * EXPAND_MAX_PAD_RATIO)
    : imageSize.width
  const fitImageHeight = sceneExpandMode
    ? imageSize.height * (1 + 2 * EXPAND_MAX_PAD_RATIO)
    : imageSize.height
  const fitScale = computeFitScale(
    fitImageWidth,
    fitImageHeight,
    viewportSize.width,
    viewportSize.height,
  )
  layoutRef.current = {
    imageWidth: fitImageWidth,
    imageHeight: fitImageHeight,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    fitScale,
  }

  useEffect(() => {
    cameraRef.current = WORKBENCH_FIT_CAMERA
    setCamera(WORKBENCH_FIT_CAMERA)
    selectionRef.current = null
    setSelectionPreview([])
    touchPointersRef.current.clear()
    pinchRef.current = false
  }, [src])

  useEffect(() => {
    if (sceneExpandMode) commitCamera(WORKBENCH_FIT_CAMERA)
  }, [commitCamera, sceneExpandMode])

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalHeight: height, naturalWidth: width } = event.currentTarget
    if (width <= 0 || height <= 0) return
    const nextSize = { width, height }
    setImageSize((previous) =>
      previous.width === width && previous.height === height ? previous : nextSize,
    )
    // Preview pixel size (Next/Image AVIF/WebP). Object-edit strokes use this
    // display space. Crop floors must use studio_images.width/height instead.
    onNaturalSizeChange?.(nextSize)
  }

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
      if (cropMode || sceneExpandMode) return
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
  }, [commitCamera, cropMode, sceneExpandMode])

  const box =
    imageSize.width > 0 && viewportSize.width > 0
      ? imageBox(
          camera,
          fitImageWidth,
          fitImageHeight,
          viewportSize.width,
          viewportSize.height,
          fitScale,
        )
      : null

  const applyZoom = (nextZoom: number, pointX: number, pointY: number) => {
    if (imageSize.width <= 0 || cropMode || sceneExpandMode) return
    commitCamera(
      zoomAroundPoint(
        cameraRef.current,
        nextZoom,
        pointX,
        pointY,
        fitImageWidth,
        fitImageHeight,
        viewportSize.width,
        viewportSize.height,
        fitScale,
      ),
    )
  }

  const displayedBounds = () => {
    if (!box || !viewportRef.current) return null
    const rect = viewportRef.current.getBoundingClientRect()
    return {
      left: rect.left + box.left,
      top: rect.top + box.top,
      width: box.width,
      height: box.height,
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      if (touchPointersRef.current.size > 0) {
        touchPointersRef.current.add(event.pointerId)
        selectionRef.current = null
        setSelectionPreview([])
        dragRef.current = null
        pinchRef.current = true
        return
      }
      touchPointersRef.current.add(event.pointerId)
    }

    if (pinchRef.current) return

    if (cropMode || sceneExpandMode) {
      return
    }

    if (
      selectionMode &&
      box &&
      naturalSize &&
      naturalSize.width > 0 &&
      naturalSize.height > 0 &&
      onSelectionChange
    ) {
      const bounds = displayedBounds()
      if (!bounds) return
      const inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.left + bounds.width &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.top + bounds.height
      if (!inside || (event.pointerType !== 'touch' && event.button !== 0)) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const samples = uniqueSamples(pointerSamples(event))
      selectionRef.current = { pointerId: event.pointerId, samples }
      setSelectionPreview(samples.map((sample) => viewportToNormalized(sample, bounds)))
      return
    }

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
    const activeSelection = selectionRef.current
    if (activeSelection && activeSelection.pointerId === event.pointerId) {
      event.preventDefault()
      appendUniqueSamples(activeSelection.samples, pointerSamples(event))
      const bounds = displayedBounds()
      if (bounds) {
        setSelectionPreview(activeSelection.samples.map((sample) => viewportToNormalized(sample, bounds)))
      }
      return
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || pinchRef.current) return
    const scale = fitScale * drag.camera.zoom
    commitCamera({
      zoom: drag.camera.zoom,
      ...clampPan(
        drag.camera.panX + (event.clientX - drag.x),
        drag.camera.panY + (event.clientY - drag.y),
        fitImageWidth,
        fitImageHeight,
        viewportSize.width,
        viewportSize.height,
        scale,
      ),
    })
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const activeSelection = selectionRef.current
    if (activeSelection && activeSelection.pointerId === event.pointerId) {
      event.preventDefault()
      appendReleaseSamples(activeSelection.samples, pointerSamples(event))
      selectionRef.current = null
      setSelectionPreview([])
      const bounds = displayedBounds()
      if (bounds && naturalSize && selection && onSelectionChange) {
        const result = addCompletedStrokeAtomic(selection, activeSelection.samples, bounds, naturalSize)
        if (result.accepted) onSelectionChange(result.selection)
        else if (result.reason) onSelectionRejected?.(result.reason)
      }
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
    if (event.pointerType === 'touch') {
      touchPointersRef.current.delete(event.pointerId)
      if (touchPointersRef.current.size === 0) pinchRef.current = false
    }
  }

  const cancelInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (selectionRef.current && selectionRef.current.pointerId === event.pointerId) {
      selectionRef.current = null
      setSelectionPreview([])
    }
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    if (event.pointerType === 'touch') {
      touchPointersRef.current.delete(event.pointerId)
      // A cancelled touch must not resume the discarded gesture, so the lock
      // stays on until every active pointer lifts. Without the release below the
      // lock was permanent and every later tap or drag was ignored.
      pinchRef.current = touchPointersRef.current.size > 0
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
          'studio-checkerboard absolute inset-0 overflow-hidden outline-none',
          selectionMode && !cropMode && !sceneExpandMode
            ? 'cursor-crosshair touch-none'
            : cropMode || sceneExpandMode
              ? 'cursor-default touch-none'
              : camera.zoom > 1
              ? 'cursor-grab touch-pan-y active:cursor-grabbing'
              : 'cursor-default touch-pan-y',
        ].join(' ')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={cancelInteraction}
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
          <div
            className="absolute"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          >
            <div
              className="absolute"
              style={
                sceneExpandMode
                  ? expandPhotoFrameStyle(
                      expandLayout,
                      expandPreset ? expandPresetDef(expandPreset).padRatio : undefined,
                    )
                  : { left: 0, top: 0, width: '100%', height: '100%' }
              }
            >
              <Image
                src={src}
                alt={alt}
                fill
                draggable={false}
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="select-none object-contain"
                onLoad={handleImageLoad}
              />
            </div>
            {selectionMode && !cropMode && !sceneExpandMode && selection && (
              <StudioSelectionOverlay selection={selection} previewPoints={selectionPreview} />
            )}
            {cropMode && cropRect && onCropRectChange && (
              <StudioCropOverlay
                crop={cropRect}
                natural={
                  cropNaturalSize && cropNaturalSize.width > 0 && cropNaturalSize.height > 0
                    ? cropNaturalSize
                    : CROP_UNKNOWN_PIXEL_SIZE
                }
                pixelAspect={cropPixelAspect}
                onChange={onCropRectChange}
              />
            )}
            {sceneExpandMode && expandPreset && onExpandGestureChange ? (
              <StudioExpandOverlay
                preset={expandPreset}
                onChange={onExpandGestureChange}
              />
            ) : null}
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            draggable={false}
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="select-none object-contain"
            onLoad={handleImageLoad}
          />
        )}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-1">
        <div className="studio-overlay-pill pointer-events-auto flex h-11 overflow-hidden rounded-full">
          <button
            type="button"
            className={`${TOOLBAR_CONTROL} inline-flex w-8 items-center justify-center hover:bg-white/[0.06]`}
            aria-label="Zoom out"
            onClick={() => zoomFromCenter(clampZoom(camera.zoom / WORKBENCH_ZOOM_STEP))}
          >
            <Minus className="block h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
          </button>
          <span
            className="inline-flex h-11 min-w-[2.75rem] items-center justify-center border-x border-white/[0.14] px-2 text-center text-xs font-semibold leading-none tabular-nums text-white/80"
            aria-live="polite"
            aria-label={`Zoom ${zoomLabel}`}
          >
            {zoomLabel}
          </span>
          <button
            type="button"
            className={`${TOOLBAR_CONTROL} inline-flex w-8 items-center justify-center hover:bg-white/[0.06]`}
            aria-label="Zoom in"
            onClick={() => zoomFromCenter(clampZoom(camera.zoom * WORKBENCH_ZOOM_STEP))}
          >
            <Plus className="block h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
          </button>
        </div>
        <button
          type="button"
          className={`${TOOLBAR_CONTROL} studio-overlay-pill pointer-events-auto inline-flex items-center justify-center rounded-full px-2.5 text-xs font-semibold`}
          aria-label="Reset zoom"
          title="Reset zoom"
          disabled={atFit}
          onClick={() => commitCamera(WORKBENCH_FIT_CAMERA)}
        >
          Reset
        </button>
        <button
          type="button"
          className={`${TOOLBAR_CONTROL} studio-overlay-pill pointer-events-auto inline-flex w-8 items-center justify-center rounded-full`}
          aria-label={expandLabel}
          title={expandLabel}
          onClick={onExpand}
        >
          {expanded ? (
            <Minimize2 className="block h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
          ) : (
            <Maximize2 className="block h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.25} />
          )}
        </button>
      </div>
    </div>
  )
}
