import fc from 'fast-check'

import {
  deriveAnnotationBoundingRegion,
  deriveAnnotationRadius,
  normalizedToViewport,
  viewportToNormalized,
  type DisplayedImageBounds,
  type NaturalImageSize,
} from '../coordinate-transform'
import type { AnnotationStroke, NormalizedPoint } from '../contracts'

const normalizedCoordinate = fc.double({ min: 0, max: 1, noNaN: true })
const naturalSizeArbitrary = fc.record({
  width: fc.integer({ min: 1, max: 6000 }),
  height: fc.integer({ min: 1, max: 6000 }),
})
const viewportTransformArbitrary = fc.record({
  viewportWidth: fc.integer({ min: 32, max: 2400 }),
  viewportHeight: fc.integer({ min: 32, max: 1600 }),
  zoom: fc.double({ min: 0.25, max: 6, noNaN: true }),
  panX: fc.double({ min: -3000, max: 3000, noNaN: true }),
  panY: fc.double({ min: -3000, max: 3000, noNaN: true }),
})

function boundsForTransform(
  naturalSize: NaturalImageSize,
  transform: fc.infer<typeof viewportTransformArbitrary>,
): DisplayedImageBounds {
  const fitScale = Math.min(
    transform.viewportWidth / naturalSize.width,
    transform.viewportHeight / naturalSize.height,
  )
  return {
    left: transform.panX + (transform.viewportWidth - naturalSize.width * fitScale * transform.zoom) / 2,
    top: transform.panY + (transform.viewportHeight - naturalSize.height * fitScale * transform.zoom) / 2,
    width: naturalSize.width * fitScale * transform.zoom,
    height: naturalSize.height * fitScale * transform.zoom,
  }
}

const strokeArbitrary = fc.oneof(
  normalizedCoordinate.chain((x) => normalizedCoordinate.map((y) => ({ kind: 'tap' as const, points: [{ x, y }] }))),
  fc.array(
    normalizedCoordinate.chain((x) => normalizedCoordinate.map((y) => ({ x, y }))),
    { minLength: 2, maxLength: 16 },
  ).map((points) => ({ kind: 'path' as const, points })),
)

function expectClose(actual: number, expected: number, tolerance = 1e-9): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe('object-edit coordinate transform properties', () => {
  it('Property 1: round-trips in-range coordinates and independently clamps outside displayed image bounds', () => {
    fc.assert(
      fc.property(
        naturalSizeArbitrary,
        viewportTransformArbitrary,
        normalizedCoordinate,
        normalizedCoordinate,
        fc.double({ min: -2, max: 3, noNaN: true }),
        fc.double({ min: -2, max: 3, noNaN: true }),
        (naturalSize, transform, x, y, outsideX, outsideY) => {
          const bounds = boundsForTransform(naturalSize, transform)
          const normalized = { x, y }
          const viewport = normalizedToViewport(normalized, bounds)
          const roundTrip = viewportToNormalized(viewport, bounds)

          // One CSS pixel in normalized units is the permitted rendering error.
          expectClose(roundTrip.x, normalized.x, 1 / bounds.width)
          expectClose(roundTrip.y, normalized.y, 1 / bounds.height)

          const clamped = viewportToNormalized(
            {
              x: bounds.left + outsideX * bounds.width,
              y: bounds.top + outsideY * bounds.height,
            },
            bounds,
          )
          expectClose(clamped.x, Math.max(0, Math.min(1, outsideX)))
          expectClose(clamped.y, Math.max(0, Math.min(1, outsideY)))
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Property 2: derives a complete, normalized, viewport-stable bounding region', () => {
    fc.assert(
      fc.property(
        fc.array(strokeArbitrary, { minLength: 1, maxLength: 8 }),
        naturalSizeArbitrary,
        viewportTransformArbitrary,
        viewportTransformArbitrary,
        (strokes: AnnotationStroke[], naturalSize, firstTransform, secondTransform) => {
          const region = deriveAnnotationBoundingRegion(strokes, naturalSize)
          const radius = deriveAnnotationRadius(naturalSize)
          const points = strokes.flatMap((stroke) => stroke.points)
          const minX = Math.min(...points.map((point) => point.x))
          const maxX = Math.max(...points.map((point) => point.x))
          const minY = Math.min(...points.map((point) => point.y))
          const maxY = Math.max(...points.map((point) => point.y))

          expect(region).toEqual({
            left: Math.max(0, minX - radius.x),
            top: Math.max(0, minY - radius.y),
            right: Math.min(1, maxX + radius.x),
            bottom: Math.min(1, maxY + radius.y),
          })
          for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(region.left)
            expect(point.x).toBeLessThanOrEqual(region.right)
            expect(point.y).toBeGreaterThanOrEqual(region.top)
            expect(point.y).toBeLessThanOrEqual(region.bottom)
          }
          expect(region.left).toBeGreaterThanOrEqual(0)
          expect(region.top).toBeGreaterThanOrEqual(0)
          expect(region.right).toBeLessThanOrEqual(1)
          expect(region.bottom).toBeLessThanOrEqual(1)

          // Rendering transforms can change pixels, never the image-relative derived region.
          const firstBounds = boundsForTransform(naturalSize, firstTransform)
          const secondBounds = boundsForTransform(naturalSize, secondTransform)
          const restored = normalizedToViewport(points[0] as NormalizedPoint, firstBounds)
          const restoredNormalized = viewportToNormalized(restored, firstBounds)
          expectClose(restoredNormalized.x, points[0].x, 1 / firstBounds.width)
          expectClose(restoredNormalized.y, points[0].y, 1 / firstBounds.height)
          expect(deriveAnnotationBoundingRegion(strokes, naturalSize)).toEqual(region)
          expect(normalizedToViewport(points[0] as NormalizedPoint, secondBounds)).not.toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })
})
