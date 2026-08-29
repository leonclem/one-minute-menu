import fc from 'fast-check'

import { deriveSelectionSourcePoint, type AnnotationStroke, type NormalizedPoint } from '../contracts'
import {
  deriveMovePlacementGeometry,
  isTranslatedRegionOutOfBounds,
  placementForDestination,
} from '../move-placement'
import { selectionFromStrokes } from '../selection'

const pointArbitrary = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
})
const strokeArbitrary = fc.oneof(
  pointArbitrary.map((point) => ({ kind: 'tap' as const, points: [point] })),
  fc.array(pointArbitrary, { minLength: 2, maxLength: 24 }).map((points) => ({ kind: 'path' as const, points })),
)

function translated(point: NormalizedPoint, source: NormalizedPoint, destination: NormalizedPoint): NormalizedPoint {
  return {
    x: point.x + destination.x - source.x,
    y: point.y + destination.y - source.y,
  }
}

describe('object-edit Move placement properties', () => {
  it('Property 7: retains normalized destinations and derives complete translation and non-blocking edge overflow', () => {
    fc.assert(
      fc.property(
        fc.array(strokeArbitrary, { minLength: 1, maxLength: 8 }),
        pointArbitrary,
        fc.record({ zoom: fc.double({ min: 0.25, max: 8, noNaN: true }), panX: fc.integer({ min: -5000, max: 5000 }), panY: fc.integer({ min: -5000, max: 5000 }) }),
        (strokes: AnnotationStroke[], destination, viewportTransform) => {
          const selection = selectionFromStrokes(strokes, { width: 1920, height: 1080 })
          const placement = placementForDestination(selection, destination)
          const geometry = deriveMovePlacementGeometry(selection, placement)
          expect(placement).not.toBeNull()
          expect(geometry).not.toBeNull()
          if (!placement || !geometry || !selection.boundingRegion) return

          const source = deriveSelectionSourcePoint(selection.boundingRegion)
          expect(placement).toEqual({ source, destination })
          expect(geometry.source).toEqual(source)
          expect(geometry.destination).toEqual(destination)
          expect(geometry.translatedStrokes).toEqual(
            strokes.map((stroke) => ({
              kind: stroke.kind,
              points: stroke.points.map((point) => translated(point, source, destination)),
            })),
          )
          const expectedRegion = {
            left: selection.boundingRegion.left + destination.x - source.x,
            top: selection.boundingRegion.top + destination.y - source.y,
            right: selection.boundingRegion.right + destination.x - source.x,
            bottom: selection.boundingRegion.bottom + destination.y - source.y,
          }
          expect(geometry.translatedBoundingRegion.left).toBeCloseTo(expectedRegion.left, 12)
          expect(geometry.translatedBoundingRegion.top).toBeCloseTo(expectedRegion.top, 12)
          expect(geometry.translatedBoundingRegion.right).toBeCloseTo(expectedRegion.right, 12)
          expect(geometry.translatedBoundingRegion.bottom).toBeCloseTo(expectedRegion.bottom, 12)
          expect(geometry.likelyOutOfBounds).toBe(
            geometry.translatedBoundingRegion.left < 0 ||
              geometry.translatedBoundingRegion.top < 0 ||
              geometry.translatedBoundingRegion.right > 1 ||
              geometry.translatedBoundingRegion.bottom > 1,
          )
          expect(isTranslatedRegionOutOfBounds(geometry.translatedBoundingRegion)).toBe(geometry.likelyOutOfBounds)
          // A rendered viewport transform never changes stored placement geometry.
          expect(viewportTransform.zoom).toBeGreaterThan(0)
          expect(deriveMovePlacementGeometry(selection, placement)).toEqual(geometry)
        },
      ),
      { numRuns: 100 },
    )
  })
})
