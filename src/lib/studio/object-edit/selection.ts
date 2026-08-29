import type { AnnotationStroke, NormalizedRegion } from './contracts'
import {
  clampCssPointToBounds,
  deriveAnnotationBoundingRegion,
  normalizedToViewport,
  viewportToNormalized,
  type CssPoint,
  type DisplayedImageBounds,
  type NaturalImageSize,
} from './coordinate-transform'

export const TAP_MOVEMENT_TOLERANCE_PX = 10
export const STROKE_RENDERING_TOLERANCE_PX = 1
export const MAX_SELECTION_STROKES = 8
export const MAX_STROKE_POINTS = 512
export const MAX_SELECTION_POINTS = 4096

export type SelectionState = {
  strokes: readonly AnnotationStroke[]
  boundingRegion: NormalizedRegion | null
}

export type SelectionRejectReason =
  | 'empty-path'
  | 'path-simplification'
  | 'stroke-limit'
  | 'point-limit'

export type AtomicStrokeAddition = {
  selection: SelectionState
  accepted: boolean
  reason?: SelectionRejectReason
}

export const EMPTY_SELECTION: SelectionState = Object.freeze({ strokes: [], boundingRegion: null })

export function selectionFromStrokes(
  strokes: readonly AnnotationStroke[],
  naturalSize: NaturalImageSize,
): SelectionState {
  if (strokes.length === 0) return EMPTY_SELECTION
  return {
    strokes: [...strokes],
    boundingRegion: deriveAnnotationBoundingRegion(strokes, naturalSize),
  }
}

function distance(left: CssPoint, right: CssPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function distanceToSegment(point: CssPoint, start: CssPoint, end: CssPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(point, start)
  const position = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
  return distance(point, { x: start.x + position * dx, y: start.y + position * dy })
}

function ramerDouglasPeucker(samples: readonly CssPoint[], tolerance: number): CssPoint[] {
  if (samples.length <= 2) return [...samples]

  let furthestDistance = -1
  let furthestIndex = -1
  const start = samples[0]
  const end = samples[samples.length - 1]
  for (let index = 1; index < samples.length - 1; index += 1) {
    const candidateDistance = distanceToSegment(samples[index], start, end)
    if (candidateDistance > furthestDistance) {
      furthestDistance = candidateDistance
      furthestIndex = index
    }
  }

  if (furthestDistance <= tolerance) return [start, end]
  const before = ramerDouglasPeucker(samples.slice(0, furthestIndex + 1), tolerance)
  const after = ramerDouglasPeucker(samples.slice(furthestIndex), tolerance)
  return [...before.slice(0, -1), ...after]
}

function isWithinRenderingTolerance(
  original: readonly CssPoint[],
  retained: readonly CssPoint[],
): boolean {
  if (retained.length < 2) return false
  return original.every((point) => {
    for (let index = 0; index < retained.length - 1; index += 1) {
      if (distanceToSegment(point, retained[index], retained[index + 1]) <= STROKE_RENDERING_TOLERANCE_PX) {
        return true
      }
    }
    return false
  })
}

function totalPointCount(strokes: readonly AnnotationStroke[]): number {
  return strokes.reduce((total, stroke) => total + stroke.points.length, 0)
}

/**
 * Converts only a completed pointer path. It never stores samples while the
 * pointer is active, so a failed classification leaves the prior state intact.
 */
export function addCompletedStrokeAtomic(
  current: SelectionState,
  sampledCssPath: readonly CssPoint[],
  bounds: DisplayedImageBounds,
  naturalSize: NaturalImageSize,
): AtomicStrokeAddition {
  if (sampledCssPath.length === 0) {
    return { selection: current, accepted: false, reason: 'empty-path' }
  }

  const clampedSamples = sampledCssPath.map((point) => clampCssPointToBounds(point, bounds))
  const first = clampedSamples[0]
  const last = clampedSamples[clampedSamples.length - 1]
  // A closed loop can finish at its starting point. Classification therefore
  // uses the furthest sampled displacement from pointer-down, not only the
  // final down-to-up displacement.
  // Reduced iteratively: a spread over an unbounded sample list can exceed the
  // argument limit and throw for long high-report-rate drags.
  let maximumDisplacement = 0
  for (const point of clampedSamples) {
    const displacement = distance(first, point)
    if (displacement > maximumDisplacement) maximumDisplacement = displacement
  }
  const isTap = maximumDisplacement <= TAP_MOVEMENT_TOLERANCE_PX

  let stroke: AnnotationStroke
  if (isTap) {
    stroke = { kind: 'tap', points: [viewportToNormalized(last, bounds)] }
  } else {
    if (clampedSamples.length < 2) {
      return { selection: current, accepted: false, reason: 'empty-path' }
    }
    const simplified =
      clampedSamples.length > MAX_STROKE_POINTS
        ? ramerDouglasPeucker(clampedSamples, STROKE_RENDERING_TOLERANCE_PX)
        : clampedSamples
    if (
      simplified.length > MAX_STROKE_POINTS ||
      !isWithinRenderingTolerance(clampedSamples, simplified)
    ) {
      return { selection: current, accepted: false, reason: 'path-simplification' }
    }

    const points = simplified.map((point) => viewportToNormalized(point, bounds))
    // Reconstruct at 100% viewport mapping before accepting the simplified path.
    const reconstructed = points.map((point) => normalizedToViewport(point, bounds))
    if (!isWithinRenderingTolerance(clampedSamples, reconstructed)) {
      return { selection: current, accepted: false, reason: 'path-simplification' }
    }
    stroke = { kind: 'path', points: [points[0], ...points.slice(1)] }
  }

  if (current.strokes.length >= MAX_SELECTION_STROKES) {
    return { selection: current, accepted: false, reason: 'stroke-limit' }
  }
  if (totalPointCount(current.strokes) + stroke.points.length > MAX_SELECTION_POINTS) {
    return { selection: current, accepted: false, reason: 'point-limit' }
  }

  return {
    selection: selectionFromStrokes([...current.strokes, stroke], naturalSize),
    accepted: true,
  }
}

export function undoSelection(current: SelectionState, naturalSize: NaturalImageSize): SelectionState {
  if (current.strokes.length === 0) return current
  return selectionFromStrokes(current.strokes.slice(0, -1), naturalSize)
}

export function clearSelection(current: SelectionState): SelectionState {
  return current.strokes.length === 0 ? current : EMPTY_SELECTION
}
