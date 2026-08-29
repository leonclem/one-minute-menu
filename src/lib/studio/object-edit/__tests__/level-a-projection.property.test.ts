import fc from 'fast-check'

import { projectLevelAEditor } from '../level-a-projection'
import { selectionFromStrokes } from '../selection'
import type { AnnotationStroke } from '../contracts'

const pointArbitrary = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
})
const strokeArbitrary = fc.oneof(
  pointArbitrary.map((point) => ({ kind: 'tap' as const, points: [point] })),
  fc.array(pointArbitrary, { minLength: 2, maxLength: 32 }).map((points) => ({ kind: 'path' as const, points })),
)

describe('Level A projection properties', () => {
  it('Property 8: projects exactly one raw primitive per retained stroke without semantic, confidence, boundary, or shape output', () => {
    fc.assert(
      fc.property(fc.array(strokeArbitrary, { minLength: 1, maxLength: 8 }), (strokes: AnnotationStroke[]) => {
        const selection = selectionFromStrokes(strokes, { width: 1600, height: 900 })
        const projection = projectLevelAEditor({ selection, operation: 'remove', placement: null })

        expect(projection.rawAnnotations).toHaveLength(strokes.length)
        expect(projection.strokeCount).toBe(strokes.length)
        expect(projection.statusText).toBe('Selection added')
        projection.rawAnnotations.forEach((primitive, index) => {
          const stroke = strokes[index]
          if (stroke.kind === 'tap') {
            expect(primitive).toEqual({ kind: 'target-marker', point: stroke.points[0] })
            expect(Object.keys(primitive).sort()).toEqual(['kind', 'point'])
          } else {
            expect(primitive).toEqual({ kind: 'stroke', points: stroke.points })
            expect(Object.keys(primitive).sort()).toEqual(['kind', 'points'])
          }
        })
        expect(JSON.stringify(projection).toLowerCase()).not.toMatch(
          /semantic|confidence|inferred|mask|segmentation|lasso|pixel selection|circle|oval|shape/,
        )
      }),
      { numRuns: 100 },
    )
  })

  // Feature: studio-object-selection-remove-move, Property 28: Level A projection ignores internal enrichment
  it('Property 28: returns byte-identical customer-facing output when canonical, spatial, and reconciliation internals vary', () => {
    const enrichmentArbitrary = fc.record({
      canonicalHydration: fc.jsonValue(),
      spatialInventory: fc.jsonValue(),
      reconciliationEvidence: fc.jsonValue(),
      optionalFailure: fc.option(fc.string(), { nil: null }),
    })
    fc.assert(
      fc.property(
        fc.array(strokeArbitrary, { minLength: 1, maxLength: 8 }),
        fc.constantFrom('remove' as const, 'move' as const),
        enrichmentArbitrary,
        enrichmentArbitrary,
        (strokes: AnnotationStroke[], operation, leftInternals, rightInternals) => {
          const selection = selectionFromStrokes(strokes, { width: 1600, height: 900 })
          const input = { selection, operation, placement: null }
          const left = projectLevelAEditor(input)
          const right = projectLevelAEditor(input)

          expect(leftInternals).not.toBe(rightInternals)
          expect(JSON.stringify(left)).toBe(JSON.stringify(right))
        },
      ),
      { numRuns: 100 },
    )
  })
})
