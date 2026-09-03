'use client'

import { useRef } from 'react'

import {
  CROP_ASPECT_PRESETS,
  LOW_RES_NOTICE_TEXT,
  applyCropPointer,
  cropFloorHint,
  isLowResImage,
  type CropAspectPreset,
  type CropHandle,
  type NaturalImageSize,
  type NormalizedCropRect,
} from '@/lib/studio/crop'

export function StudioCropLauncher({
  disabled = false,
  onOpen,
}: {
  disabled?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      data-testid="studio-crop-launcher"
      aria-label="Crop image"
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-ux-primary bg-white px-3 py-2 text-sm font-semibold text-ux-primary shadow-sm hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onOpen}
    >
      Crop
    </button>
  )
}

export function StudioLowResNotice({ natural }: { natural: NaturalImageSize | null }) {
  if (!natural || !isLowResImage(natural)) return null
  return (
    <p
      role="status"
      data-testid="studio-low-res-notice"
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
    >
      {LOW_RES_NOTICE_TEXT}
    </p>
  )
}

export function StudioCropPanel({
  preset,
  natural,
  crop,
  busy = false,
  error = null,
  onPresetChange,
  onApply,
  onCancel,
}: {
  preset: CropAspectPreset
  natural: NaturalImageSize | null
  crop: NormalizedCropRect
  busy?: boolean
  error?: string | null
  onPresetChange: (preset: CropAspectPreset) => void
  onApply: () => void
  onCancel: () => void
}) {
  const floorHint = natural ? cropFloorHint(crop, natural) : null

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3" data-testid="studio-crop-panel">
      <p className="text-sm font-semibold text-gray-900">Crop</p>
      <p className="text-xs text-gray-600">
        Drag the photo behind the window. Apply creates a new version. This does not use credits.
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Crop aspect ratio">
        {CROP_ASPECT_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={preset === item.id}
            disabled={busy}
            onClick={() => onPresetChange(item.id)}
            className={[
              'min-h-9 rounded-md border px-2.5 py-1 text-xs font-semibold',
              preset === item.id
                ? 'border-ux-primary bg-ux-primary text-white'
                : 'border-gray-300 bg-white text-gray-800 hover:border-ux-primary/60',
              busy && 'cursor-not-allowed opacity-50',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>
      {floorHint ? (
        <p role="status" className="text-xs text-amber-900">
          {floorHint}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-800">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="studio-crop-apply"
          className="min-h-11 rounded-md bg-ux-primary px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          disabled={busy}
          onClick={onApply}
        >
          {busy ? 'Cropping…' : 'Apply crop'}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

const CORNER_HANDLES: CropHandle[] = ['nw', 'ne', 'sw', 'se']
const FREE_HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function cropResizeHandles(pixelAspect: number | null): CropHandle[] {
  return pixelAspect === null ? FREE_HANDLES : CORNER_HANDLES
}

function handleStyle(handle: CropHandle): string {
  // min-h-0 / min-w-0 opt out of the global 44px button touch minimum.
  const common =
    'absolute z-[2] box-border h-3 w-3 min-h-0 min-w-0 p-0 leading-none rounded-sm border-2 border-white bg-ux-primary shadow'
  switch (handle) {
    case 'nw':
      return `${common} left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize`
    case 'ne':
      return `${common} right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize`
    case 'sw':
      return `${common} bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize`
    case 'se':
      return `${common} bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize`
    case 'n':
      return `${common} left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize`
    case 's':
      return `${common} bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize`
    case 'w':
      return `${common} left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize`
    case 'e':
      return `${common} right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize`
    default:
      return common
  }
}

function clientToNormalized(
  clientX: number,
  clientY: number,
  bounds: DOMRect,
): { x: number; y: number } {
  return {
    x: bounds.width <= 0 ? 0 : (clientX - bounds.left) / bounds.width,
    y: bounds.height <= 0 ? 0 : (clientY - bounds.top) / bounds.height,
  }
}

export function StudioCropOverlay({
  crop,
  natural,
  pixelAspect,
  onChange,
}: {
  crop: NormalizedCropRect
  natural: NaturalImageSize
  pixelAspect: number | null
  onChange: (next: NormalizedCropRect) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{
    pointerId: number
    handle: CropHandle
    startRect: NormalizedCropRect
    startPoint: { x: number; y: number }
  } | null>(null)

  const begin = (event: React.PointerEvent, handle: CropHandle) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = {
      pointerId: event.pointerId,
      handle,
      startRect: crop,
      startPoint: clientToNormalized(event.clientX, event.clientY, bounds),
    }
  }

  const move = (event: React.PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    event.preventDefault()
    event.stopPropagation()
    onChange(
      applyCropPointer({
        startRect: gesture.startRect,
        handle: gesture.handle,
        startPoint: gesture.startPoint,
        point: clientToNormalized(event.clientX, event.clientY, bounds),
        natural,
        pixelAspect,
      }),
    )
  }

  const end = (event: React.PointerEvent) => {
    if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null
  }

  return (
    <div
      ref={rootRef}
      data-testid="studio-crop-overlay"
      className="absolute inset-0 z-[1] touch-none"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        role="presentation"
        className="absolute box-border cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
        }}
        onPointerDown={(event) => begin(event, 'move')}
      >
        {cropResizeHandles(pixelAspect).map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={`Resize crop ${handle}`}
            data-crop-handle={handle}
            className={handleStyle(handle)}
            onPointerDown={(event) => begin(event, handle)}
          />
        ))}
      </div>
    </div>
  )
}
