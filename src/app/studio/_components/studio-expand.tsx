'use client'

import { useRef, type ReactNode } from 'react'
import { Expand } from 'lucide-react'

import {
  DEFAULT_EXPAND_PRESET,
  EXPAND_CORNER_HANDLES,
  EXPAND_HELPER_TEXT,
  EXPAND_PRESETS,
  expandDestinationInset,
  expandDestinationScale,
  expandPhotoInset,
  expandPhotoScale,
  expandPresetDef,
  expandPresetFromPointer,
  type ExpandCornerHandle,
  type ExpandPresetId,
} from '@/lib/studio/expand'

export function StudioExpandLauncher({
  disabled = false,
  hint = '1 credit · zoom out',
  overlay = false,
  pressed = false,
  onOpen,
}: {
  disabled?: boolean
  hint?: string
  overlay?: boolean
  pressed?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      data-testid="studio-expand-launcher"
      aria-label="Expand scene"
      aria-pressed={pressed}
      disabled={disabled}
      className={['studio-tool-chip min-h-11', overlay && 'studio-tool-chip-overlay'].filter(Boolean).join(' ')}
      onClick={onOpen}
    >
      <span className="studio-tool-chip-label">
        <Expand className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        Expand
      </span>
      <span className="studio-tool-chip-hint">{hint}</span>
    </button>
  )
}

export function StudioExpandPanel({
  preset,
  busy = false,
  error = null,
  overlay = false,
  creditLabel,
  degradationCallout,
  onPresetChange,
  onApply,
  onCancel,
}: {
  preset: ExpandPresetId
  busy?: boolean
  error?: string | null
  overlay?: boolean
  creditLabel: string
  degradationCallout?: ReactNode
  onPresetChange: (preset: ExpandPresetId) => void
  onApply: () => void
  onCancel: () => void
}) {
  return (
    <div
      className={
        overlay
          ? 'studio-tool-dock space-y-2'
          : 'space-y-3 rounded-[11px] border border-white/[0.1] bg-[#0f1c1f] p-3'
      }
      data-testid="studio-expand-panel"
    >
      {overlay ? null : (
        <>
          <p className="text-sm font-semibold text-white">Expand</p>
          <p className="text-xs text-white/55">{EXPAND_HELPER_TEXT}</p>
        </>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="How much extra scene">
        {EXPAND_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={preset === item.id}
            disabled={busy}
            onClick={() => onPresetChange(item.id)}
            className={[
              'min-h-9 rounded-[7px] border px-2.5 py-1 text-xs font-semibold',
              preset === item.id
                ? 'border-[#01b3bf] bg-[#01b3bf] text-white'
                : 'border-white/[0.16] bg-transparent text-white/80 hover:border-[#01b3bf]/60',
              busy && 'cursor-not-allowed opacity-50',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>
      {degradationCallout}
      {error ? (
        <p role="alert" className="text-xs text-[#ff8a80]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="studio-expand-apply"
          className="studio-btn-primary min-h-11 px-3 py-2 text-sm disabled:bg-white/10 disabled:text-white/40"
          disabled={busy}
          aria-label={`Expand scene, ${creditLabel}`}
          onClick={onApply}
        >
          {busy ? 'Generating…' : `Expand · ${creditLabel}`}
        </button>
        <button
          type="button"
          className="studio-btn-ghost min-h-11 px-3 py-2 text-sm"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function handleStyle(handle: ExpandCornerHandle): string {
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
      return `${common} right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize`
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

export function StudioExpandOverlay({
  preset = DEFAULT_EXPAND_PRESET,
  onChange,
}: {
  preset: ExpandPresetId
  onChange: (preset: ExpandPresetId) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<{ pointerId: number } | null>(null)
  const padRatio = expandPresetDef(preset).padRatio
  const inset = expandDestinationInset(padRatio)
  const scale = expandDestinationScale(padRatio)

  const begin = (event: React.PointerEvent) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = { pointerId: event.pointerId }
    onChange(expandPresetFromPointer(clientToNormalized(event.clientX, event.clientY, bounds)))
  }

  const move = (event: React.PointerEvent) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    event.preventDefault()
    event.stopPropagation()
    onChange(expandPresetFromPointer(clientToNormalized(event.clientX, event.clientY, bounds)))
  }

  const end = (event: React.PointerEvent) => {
    if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null
  }

  return (
    <div
      ref={rootRef}
      data-testid="studio-expand-overlay"
      className="absolute inset-0 z-[1] touch-none"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        role="presentation"
        className="absolute box-border border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
        style={{
          left: `${inset * 100}%`,
          top: `${inset * 100}%`,
          width: `${scale * 100}%`,
          height: `${scale * 100}%`,
        }}
      >
        {EXPAND_CORNER_HANDLES.map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={`Resize expand ${handle}`}
            data-expand-handle={handle}
            className={handleStyle(handle)}
            onPointerDown={begin}
          />
        ))}
      </div>
    </div>
  )
}

export function expandPhotoFrameStyle(): { left: string; top: string; width: string; height: string } {
  const inset = expandPhotoInset()
  const scale = expandPhotoScale()
  return {
    left: `${inset * 100}%`,
    top: `${inset * 100}%`,
    width: `${scale * 100}%`,
    height: `${scale * 100}%`,
  }
}
