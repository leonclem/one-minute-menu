import fc from 'fast-check'

import { selectionFromStrokes } from '../selection'
import {
  boundingRegionInconsistency,
  deriveSelectionBoundingRegion,
  ObjectEditSubmissionZ,
  SELECTION_BOUNDING_REGION_MAX_RADIUS,
  type AnnotationStroke,
} from '../contracts'

const dishId = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const sourceImageId = '0135d7b0-61a1-4de1-9de6-0123456789ab'

function submissionFor(selection: { version: 1; strokes: readonly AnnotationStroke[]; boundingRegion: unknown }) {
  return {
    dishId,
    sourceImageId,
    model: 'gemini-3.1-flash-image-preview',
    editIntent: { version: 1, operation: 'remove', selection },
  }
}

/** Mirrors what the browser selection engine hands to the submission payload. */
function clientSelection(strokes: AnnotationStroke[], naturalSize: { width: number; height: number }) {
  const state = selectionFromStrokes(strokes, naturalSize)
  if (!state.boundingRegion) throw new Error('Expected a derived bounding region.')
  return { version: 1 as const, strokes: state.strokes, boundingRegion: state.boundingRegion }
}

describe('selection engine to wire contract interop', () => {
  it('accepts the image-aware bounding region the browser derives', () => {
    // The engine radius is max(4, round(min(w,h) * 0.006)) px per axis, which is
    // anisotropic and differs from the contract's isotropic fallback radius.
    const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }]
    const selection = clientSelection(strokes, { width: 1000, height: 800 })

    expect(selection.boundingRegion).not.toEqual(deriveSelectionBoundingRegion(strokes))
    expect(ObjectEditSubmissionZ.safeParse(submissionFor(selection)).success).toBe(true)
  })

  it('accepts the contract fallback region for the same strokes', () => {
    const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.24, y: 0.68 }] }]
    const selection = {
      version: 1 as const,
      strokes,
      boundingRegion: deriveSelectionBoundingRegion(strokes),
    }

    expect(ObjectEditSubmissionZ.safeParse(submissionFor(selection)).success).toBe(true)
  })

  it('accepts every engine-derived region across image shapes, stroke kinds, and edges', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({
              kind: fc.constant('tap' as const),
              points: fc.tuple(
                fc.record({
                  x: fc.double({ min: 0, max: 1, noNaN: true }),
                  y: fc.double({ min: 0, max: 1, noNaN: true }),
                }),
              ),
            }),
            fc.record({
              kind: fc.constant('path' as const),
              points: fc.array(
                fc.record({
                  x: fc.double({ min: 0, max: 1, noNaN: true }),
                  y: fc.double({ min: 0, max: 1, noNaN: true }),
                }),
                { minLength: 2, maxLength: 12 },
              ),
            }),
          ),
          { minLength: 1, maxLength: 8 },
        ),
        fc.integer({ min: 64, max: 6000 }),
        fc.integer({ min: 64, max: 6000 }),
        (strokes, width, height) => {
          const selection = clientSelection(strokes as AnnotationStroke[], { width, height })
          expect(boundingRegionInconsistency(selection.strokes, selection.boundingRegion)).toBeNull()
          expect(ObjectEditSubmissionZ.safeParse(submissionFor(selection)).success).toBe(true)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('still rejects a region that does not contain every retained point', () => {
    const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }]
    const selection = clientSelection(strokes, { width: 1000, height: 800 })
    const tampered = { ...selection, boundingRegion: { ...selection.boundingRegion, right: 0.4 } }

    expect(boundingRegionInconsistency(strokes, tampered.boundingRegion)).toBe('not-containing')
    expect(ObjectEditSubmissionZ.safeParse(submissionFor(tampered)).success).toBe(false)
  })

  it('still rejects a region expanded on one edge only', () => {
    const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }]
    const selection = clientSelection(strokes, { width: 1000, height: 800 })
    const tampered = {
      ...selection,
      boundingRegion: { ...selection.boundingRegion, left: selection.boundingRegion.left - 0.02 },
    }

    expect(boundingRegionInconsistency(strokes, tampered.boundingRegion)).toBe('asymmetric-expansion')
    expect(ObjectEditSubmissionZ.safeParse(submissionFor(tampered)).success).toBe(false)
  })

  it('still rejects an expansion beyond the maximum annotation radius', () => {
    const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }]
    const overshoot = SELECTION_BOUNDING_REGION_MAX_RADIUS + 0.01
    const selection = {
      version: 1 as const,
      strokes,
      boundingRegion: deriveSelectionBoundingRegion(strokes, overshoot),
    }

    expect(boundingRegionInconsistency(strokes, selection.boundingRegion)).toBe('radius-out-of-range')
    expect(ObjectEditSubmissionZ.safeParse(submissionFor(selection)).success).toBe(false)
  })

  it('still rejects a whole-axis region claimed from a central selection', () => {
    const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }]
    const selection = {
      version: 1 as const,
      strokes,
      boundingRegion: { left: 0, top: 0, right: 1, bottom: 1 },
    }

    expect(boundingRegionInconsistency(strokes, selection.boundingRegion)).toBe('radius-out-of-range')
    expect(ObjectEditSubmissionZ.safeParse(submissionFor(selection)).success).toBe(false)
  })
})
