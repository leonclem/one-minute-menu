import type { AnnotationStroke, NormalizedPoint, NormalizedRegion } from './contracts'

export type DisplayedImageBounds = {
  left: number
  top: number
  width: number
  height: number
}

export type CssPoint = { x: number; y: number }
export type NaturalImageSize = { width: number; height: number }
export type AnnotationRadius = { x: number; y: number }

export const NATURAL_ANNOTATION_RADIUS_MIN_PX = 4
export const NATURAL_ANNOTATION_RADIUS_RATIO = 0.006

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

export function assertDisplayedImageBounds(bounds: DisplayedImageBounds): void {
  if (
    !isFiniteNumber(bounds.left) ||
    !isFiniteNumber(bounds.top) ||
    !isFiniteNumber(bounds.width) ||
    !isFiniteNumber(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new RangeError('Displayed image bounds must have finite positive width and height.')
  }
}

export function assertNaturalImageSize(size: NaturalImageSize): void {
  if (
    !isFiniteNumber(size.width) ||
    !isFiniteNumber(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new RangeError('Natural image dimensions must be finite positive values.')
  }
}

export function clampNormalized(value: number): number {
  if (!isFiniteNumber(value)) {
    throw new RangeError('Normalized coordinates must be finite.')
  }
  return Math.max(0, Math.min(1, value))
}

/** Converts browser client coordinates using only the displayed image pixels, not letterboxing. */
export function viewportToNormalized(
  point: CssPoint,
  bounds: DisplayedImageBounds,
): NormalizedPoint {
  assertDisplayedImageBounds(bounds)
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
    throw new RangeError('Viewport coordinates must be finite.')
  }

  return {
    x: clampNormalized((point.x - bounds.left) / bounds.width),
    y: clampNormalized((point.y - bounds.top) / bounds.height),
  }
}

export function normalizedToViewport(
  point: NormalizedPoint,
  bounds: DisplayedImageBounds,
): CssPoint {
  assertDisplayedImageBounds(bounds)
  return {
    x: bounds.left + clampNormalized(point.x) * bounds.width,
    y: bounds.top + clampNormalized(point.y) * bounds.height,
  }
}

export function clampCssPointToBounds(point: CssPoint, bounds: DisplayedImageBounds): CssPoint {
  assertDisplayedImageBounds(bounds)
  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
    throw new RangeError('Viewport coordinates must be finite.')
  }
  return {
    x: Math.max(bounds.left, Math.min(bounds.left + bounds.width, point.x)),
    y: Math.max(bounds.top, Math.min(bounds.top + bounds.height, point.y)),
  }
}

/**
 * The annotation radius is retained in image-relative units, so viewport size,
 * zoom, and pan cannot change the selection's derived region.
 */
export function deriveAnnotationRadius(size: NaturalImageSize): AnnotationRadius {
  assertNaturalImageSize(size)
  const radiusPixels = Math.max(
    NATURAL_ANNOTATION_RADIUS_MIN_PX,
    Math.round(Math.min(size.width, size.height) * NATURAL_ANNOTATION_RADIUS_RATIO),
  )
  return { x: radiusPixels / size.width, y: radiusPixels / size.height }
}

export function deriveAnnotationBoundingRegion(
  strokes: readonly AnnotationStroke[],
  naturalSize: NaturalImageSize,
): NormalizedRegion {
  const points = strokes.flatMap((stroke): readonly NormalizedPoint[] => stroke.points)
  if (points.length === 0) {
    throw new RangeError('Cannot derive an annotation bounding region from an empty selection.')
  }

  const radius = deriveAnnotationRadius(naturalSize)
  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))

  return {
    left: clampNormalized(minX - radius.x),
    top: clampNormalized(minY - radius.y),
    right: clampNormalized(maxX + radius.x),
    bottom: clampNormalized(maxY + radius.y),
  }
}
