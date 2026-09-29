import { useMemo, type ReactNode } from 'react'
import { Eraser } from 'lucide-react'

import type { AnnotationStroke, NormalizedPoint } from '@/lib/studio/object-edit/contracts'
import { keepOutlineFromSelection, keepOutlinePoints } from '@/lib/studio/object-edit/keep-region'
import type { SelectionState } from '@/lib/studio/object-edit/selection'

import { KeepExteriorShade } from './studio-keep-this'

export interface StudioObjectEditLauncherProps {
  disabled?: boolean
  hint?: string
  overlay?: boolean
  pressed?: boolean
  onOpen: () => void
}

export function StudioObjectEditLauncher({
  disabled = false,
  hint = '1 credit · re-renders',
  overlay = false,
  pressed = false,
  onOpen,
}: StudioObjectEditLauncherProps) {
  return (
    <button
      type="button"
      data-testid="studio-object-edit-launcher"
      aria-label="Remove object"
      aria-pressed={pressed}
      disabled={disabled}
      className={['studio-tool-chip min-h-11', overlay && 'studio-tool-chip-overlay'].filter(Boolean).join(' ')}
      onClick={onOpen}
    >
      <span className="studio-tool-chip-label">
        <Eraser className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        Remove
      </span>
      <span className="studio-tool-chip-hint">{hint}</span>
    </button>
  )
}

export interface StudioObjectEditControlsProps {
  canGenerate: boolean
  busy?: boolean
  creditLabel: string
  operation?: 'remove' | 'keep'
  showClose?: boolean
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
  operation = 'remove',
  showClose = true,
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
        className="studio-btn-ghost min-h-11 px-3 py-2 text-sm"
        disabled={busy}
        onClick={onUndo}
      >
        Undo
      </button>
      <button
        type="button"
        className="studio-btn-ghost min-h-11 px-3 py-2 text-sm"
        disabled={busy}
        onClick={onClear}
      >
        Clear
      </button>
      <button
        type="button"
        className="studio-btn-primary min-h-11 px-3 py-2 text-sm disabled:bg-white/10 disabled:text-white/40"
        aria-label={operation === 'keep' ? `Clear the rest, ${creditLabel}` : `Remove selected object, ${creditLabel}`}
        disabled={!canGenerate || busy}
        onClick={onGenerate}
      >
        {busy ? 'Preparing…' : operation === 'keep' ? `Clear the rest · ${creditLabel}` : `Remove · ${creditLabel}`}
      </button>
      <button
        type="button"
        className="studio-btn-ghost min-h-11 px-3 py-2 text-sm"
        disabled={busy}
        onClick={onCancel}
      >
        Cancel
      </button>
      {showClose ? (
        <button
          type="button"
          aria-label="Close image editing"
          className="studio-btn-ghost min-h-11 px-3 py-2 text-sm"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      ) : null}
    </div>
  )
}

export function StudioObjectEditStatus({
  selection,
  rejection,
  operation = 'remove',
}: {
  selection: SelectionState
  rejection?: string | null
  operation?: 'remove' | 'keep'
}) {
  const outlined = operation === 'keep' && keepOutlineFromSelection(selection) !== null
  const count = selection.strokes.length
  const status =
    operation === 'keep'
      ? outlined
        ? 'Outline added'
        : 'Draw around what should stay.'
      : count > 0
        ? 'Selection added'
        : 'Tap or draw over one object.'
  const guidance =
    operation === 'keep'
      ? outlined
        ? 'A new outline replaces this one.'
        : null
      : count > 0
        ? 'A new mark replaces this one.'
        : null

  return (
    <div className="space-y-1 text-sm text-white/70" data-testid="studio-object-edit-status">
      <p role="status" aria-live="polite">
        {status}
      </p>
      {guidance ? <p>{guidance}</p> : null}
      {rejection && <p role="alert" className="text-[#ff8a80]">{rejection}</p>}
    </div>
  )
}

export interface StudioSelectionOverlayProps {
  selection: SelectionState
  previewPoints?: readonly NormalizedPoint[]
  shadeExterior?: boolean
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

export function StudioSelectionOverlay({
  selection,
  previewPoints = [],
  shadeExterior = false,
}: StudioSelectionOverlayProps) {
  const acceptedPaths = useMemo(
    () => selection.strokes.flatMap((stroke, strokeIndex) => {
      const points = pathPoints(stroke)
      if (!points) return []
      const drawn = shadeExterior ? (keepOutlinePoints(points) ?? points) : points
      return [<SelectionPath key={`path-${strokeIndex}`} points={drawn} />]
    }),
    [selection.strokes, shadeExterior],
  )
  const taps = useMemo(
    () => selection.strokes.flatMap((stroke) => (stroke.kind === 'tap' ? stroke.points : [])),
    [selection.strokes],
  )
  const committedPath = selection.strokes.find((stroke) => stroke.kind === 'path')?.points ?? []
  const drawing = previewPoints.length > 0
  const shadePoints = shadeExterior && !drawing ? committedPath : []
  const previewPath = strokePath(previewPoints)

  if (acceptedPaths.length === 0 && taps.length === 0 && !previewPath && previewPoints.length === 0 && shadePoints.length < 3) {
    return null
  }
  return (
    <div aria-hidden="true" data-testid="studio-selection-overlay" className="pointer-events-none absolute inset-0 z-[1]">
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none">
        {shadePoints.length >= 3 ? <KeepExteriorShade points={shadePoints} /> : null}
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
  overlay?: boolean
  degradationCallout?: ReactNode
}

export function StudioObjectEditPanel({
  selection,
  rejection,
  overlay = false,
  degradationCallout,
  operation = 'remove',
  ...controls
}: StudioObjectEditPanelProps) {
  return (
    <section
      aria-label={operation === 'keep' ? 'Keep this' : 'Remove object'}
      data-testid="studio-object-edit-panel"
      className={
        overlay
          ? 'studio-tool-dock space-y-2'
          : 'space-y-3 rounded-[11px] border border-white/[0.1] bg-[#0f1c1f] p-3 shadow-sm'
      }
    >
      {overlay ? null : (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/55">
            {operation === 'keep' ? 'Keep this' : 'Remove'}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {operation === 'keep'
              ? 'Draw around what should stay. The shaded area will be cleared. A new outline replaces the last. Counts as a generation.'
              : 'Remove one object by tapping or drawing over it. A new mark replaces the last. Counts as a generation.'}
          </p>
        </div>
      )}
      <StudioObjectEditStatus selection={selection} rejection={rejection} operation={operation} />
      {overlay ? null : degradationCallout}
      <div className={overlay ? 'flex flex-wrap items-center gap-2' : undefined}>
        {overlay ? degradationCallout : null}
        <StudioObjectEditControls {...controls} operation={operation} showClose={!overlay} />
      </div>
    </section>
  )
}
