import type { AnnotationStroke, NormalizedPoint } from './contracts'

const MIN_OUTLINE_POINTS = 3
/** Treat a stroke that already returns to its start as closed. */
const CLOSE_DISTANCE = 0.01

export function keepOutlinePoints(points: readonly NormalizedPoint[]): NormalizedPoint[] | null {
  if (points.length < MIN_OUTLINE_POINTS) return null
  const first = points[0]
  const last = points[points.length - 1]
  const alreadyClosed = Math.hypot(first.x - last.x, first.y - last.y) <= CLOSE_DISTANCE
  return alreadyClosed ? [...points] : [...points, first]
}

export function keepOutlineFromSelection(selection: {
  strokes?: readonly AnnotationStroke[] | null
}): readonly NormalizedPoint[] | null {
  const strokes = selection.strokes
  if (!strokes || strokes.length !== 1) return null
  const stroke = strokes[0]
  if (!stroke || stroke.kind !== 'path' || !stroke.points) return null
  return keepOutlinePoints(stroke.points)
}
