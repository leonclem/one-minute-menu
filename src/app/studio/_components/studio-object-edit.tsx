import { useMemo } from 'react'

import type { AnnotationStroke, NormalizedPoint } from '@/lib/studio/object-edit/contracts'
import type { SelectionState } from '@/lib/studio/object-edit/selection'

export interface StudioObjectEditLauncherProps {
  disabled?: boolean
  onOpen: () => void
}

export function StudioObjectEditLauncher({
  disabled = false,
  onOpen,
}: StudioObjectEditLauncherProps) {
  return (
    <button
      type="button"
      data-testid="studio-object-edit-launcher"
      aria-label="Edit image"
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center rounded-md border border-ux-primary bg-white px-3 py-2 text-sm font-semibold text-ux-primary shadow-sm hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onOpen}
    >
      Edit image
    </button>
  )
}

export interface StudioObjectEditControlsProps {
  canGenerate: boolean
  busy?: boolean
  creditLabel: string
  onUndo: () => void
  onClear: () => void
  onGenerate: () => void
  onCancel: () => void
  onClose: () => void
}

export function StudioObjectEditControls({
  canGenerate,
  busy = false,
  creditLabel,
  onUndo,
  onClear,
  onGenerate,
  onCancel,
  onClose,
}: StudioObjectEditControlsProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="studio-object-edit-controls">
      <button
        type="button"
        className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={onClear}
      >
        Clear
      </button>
      <button
        type="button"
        className="min-h-11 rounded-md bg-ux-primary px-3 py-2 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        aria-label={`Remove selected object, ${creditLabel}`}
        disabled={!canGenerate || busy}
        onClick={onGenerate}
      >
        {busy ? 'Preparing…' : `Remove · ${creditLabel}`}
      </button>
      <button
        type="button"
        className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        aria-label="Close image editing"
        className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        onClick={onClose}
      >
        Close
      </button>
    </div>
  )
}

export function StudioObjectEditStatus({
  selection,
  rejection,
}: {
  selection: SelectionState
  rejection?: string | null
}) {
  const count = selection.strokes.length
  const focusGuidance = count >= 6
    ? 'Keep the annotation focused on one object. Use Undo or Clear before adding unrelated marks.'
    : null
  const status = count > 0 ? 'Selection added' : 'Tap or draw over one object.'

  return (
    <div className="space-y-1 text-sm text-gray-700" data-testid="studio-object-edit-status">
      <p role="status" aria-live="polite">
        {status} {count > 0 ? `(${count}/8 marks)` : ''}
      </p>
      {focusGuidance && <p className="text-amber-800">{focusGuidance}</p>}
      {count >= 8 && <p className="text-amber-800">The maximum number of marks is reached. Use Undo or Clear.</p>}
      {rejection && <p role="alert" className="text-red-800">{rejection}</p>}
    </div>
  )
}

export interface StudioSelectionOverlayProps {
  selection: SelectionState
  previewPoints?: readonly NormalizedPoint[]
}

function pathPoints(stroke: AnnotationStroke): readonly NormalizedPoint[] | null {
  return stroke.kind === 'path' ? stroke.points : null
}

function strokePath(points: readonly NormalizedPoint[]): string | null {
  if (points.length < 2) return null
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

/**
 * `vector-effect: non-scaling-stroke` makes `stroke-width` a screen-space CSS
 * pixel length instead of a user-space length, so these MUST be pixel values.
 * Normalized widths (for example 0.018) resolve to a sub-pixel hairline and are
 * effectively invisible. Screen-space width also keeps the stroke undistorted
 * under the `preserveAspectRatio="none"` viewBox below.
 */
const SELECTION_STROKE_OUTLINE_PX = 10
const SELECTION_STROKE_CORE_PX = 5

function SelectionPath({ points, preview = false }: { points: readonly NormalizedPoint[]; preview?: boolean }) {
  const path = strokePath(points)
  if (!path) return null
  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="#111827"
        strokeWidth={SELECTION_STROKE_OUTLINE_PX}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={preview ? 0.75 : 1}
      />
      <path
        d={path}
        fill="none"
        stroke="#00d9ff"
        strokeWidth={SELECTION_STROKE_CORE_PX}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={preview ? 0.9 : 1}
      />
    </>
  )
}

function SelectionMarker({ point, preview = false }: { point: NormalizedPoint; preview?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-1/2"
      data-testid={preview ? 'studio-selection-preview-marker' : 'studio-selection-marker'}
      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, opacity: preview ? 0.8 : 1 }}
    >
      <svg className="h-11 w-11 drop-shadow-sm" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="13" fill="none" stroke="#111827" strokeWidth="4" />
        <circle cx="22" cy="22" r="9" fill="none" stroke="#00d9ff" strokeWidth="2" />
        <path d="M 3 22 H 41 M 22 3 V 41" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
        <path d="M 6 22 H 38 M 22 6 V 38" stroke="#00d9ff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function StudioSelectionOverlay({ selection, previewPoints = [] }: StudioSelectionOverlayProps) {
  const acceptedPaths = useMemo(
    () => selection.strokes.flatMap((stroke, strokeIndex) => {
      const points = pathPoints(stroke)
      return points ? [<SelectionPath key={`path-${strokeIndex}`} points={points} />] : []
    }),
    [selection.strokes],
  )
  const taps = useMemo(
    () => selection.strokes.flatMap((stroke) => (stroke.kind === 'tap' ? stroke.points : [])),
    [selection.strokes],
  )
  const previewPath = strokePath(previewPoints)

  if (acceptedPaths.length === 0 && taps.length === 0 && !previewPath && previewPoints.length === 0) return null
  return (
    <div aria-hidden="true" data-testid="studio-selection-overlay" className="pointer-events-none absolute inset-0 z-[1]">
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none">
        {acceptedPaths}
        {previewPath && <SelectionPath points={previewPoints} preview />}
      </svg>
      {taps.map((point, index) => <SelectionMarker key={`tap-${index}`} point={point} />)}
      {previewPoints.length === 1 && <SelectionMarker point={previewPoints[0]} preview />}
    </div>
  )
}

export interface StudioObjectEditPanelProps extends StudioObjectEditControlsProps {
  selection: SelectionState
  rejection?: string | null
}

export function StudioObjectEditPanel({
  selection,
  rejection,
  ...controls
}: StudioObjectEditPanelProps) {
  return (
    <section
      aria-label="Edit image"
      data-testid="studio-object-edit-panel"
      className="space-y-3 rounded-lg border border-ux-primary/30 bg-teal-50/90 p-3 shadow-sm"
    >
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-ux-text-secondary">Edit image</h2>
        <p className="mt-1 text-sm text-gray-700">Remove one object by tapping or drawing over it.</p>
      </div>
      <StudioObjectEditStatus selection={selection} rejection={rejection} />
      <StudioObjectEditControls {...controls} />
    </section>
  )
}
