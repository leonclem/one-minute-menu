import fc from 'fast-check'

import { objectEditEditorReducer, type ObjectEditEditorAction, type ObjectEditEditorState } from '../editor-state'
import {
  addCompletedStrokeAtomic,
  EMPTY_SELECTION,
  MAX_SELECTION_POINTS,
  MAX_SELECTION_STROKES,
  selectionFromStrokes,
  type SelectionState,
} from '../selection'
import type { AnnotationStroke } from '../contracts'
import type { CssPoint } from '../coordinate-transform'

const bounds = { left: -50, top: 25, width: 1000, height: 750 }
const naturalSize = { width: 1600, height: 900 }
const normalizedCoordinate = fc.double({ min: 0, max: 1, noNaN: true })

function selectionWithPointCount(pointCount: number): SelectionState {
  if (pointCount === 0) return EMPTY_SELECTION
  const strokes: AnnotationStroke[] = []
  let remaining = pointCount
  while (remaining > 0) {
    const count = Math.min(512, remaining)
    const points = Array.from({ length: count }, (_, index) => ({
      x: (index % 32) / 31,
      y: (strokes.length + index / Math.max(1, count - 1)) / 9,
    }))
    strokes.push(count === 1 ? { kind: 'tap', points } : { kind: 'path', points })
    remaining -= count
  }
  return selectionFromStrokes(strokes, naturalSize)
}

const samplePathArbitrary = fc.array(
  fc.record({
    x: fc.double({ min: -1000, max: 2000, noNaN: true }),
    y: fc.double({ min: -1000, max: 2000, noNaN: true }),
  }),
  { minLength: 0, maxLength: 650 },
)

function assertSelectionWithinLimits(selection: SelectionState): void {
  expect(selection.strokes.length).toBeLessThanOrEqual(MAX_SELECTION_STROKES)
  expect(selection.strokes.reduce((total, stroke) => total + stroke.points.length, 0)).toBeLessThanOrEqual(MAX_SELECTION_POINTS)
  for (const stroke of selection.strokes) {
    expect(stroke.points.length).toBeGreaterThanOrEqual(stroke.kind === 'tap' ? 1 : 2)
    expect(stroke.points.length).toBeLessThanOrEqual(stroke.kind === 'tap' ? 1 : 512)
    for (const point of stroke.points) {
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(1)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(1)
    }
  }
}

function shapeSamples(kind: 'circle' | 'oval' | 'self-intersection' | 'random-walk', seed: number): CssPoint[] {
  const center = { x: 450 + (seed % 100), y: 375 + (seed % 80) }
  if (kind === 'circle' || kind === 'oval') {
    const radiusX = kind === 'circle' ? 90 : 160
    const radiusY = 75
    return Array.from({ length: 32 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 31
      return { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY }
    })
  }
  if (kind === 'self-intersection') {
    return Array.from({ length: 32 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 31
      return { x: center.x + Math.sin(angle) * 160, y: center.y + Math.sin(angle * 2) * 100 }
    })
  }
  return Array.from({ length: 32 }, (_, index) => ({
    x: center.x + index * 14 + ((seed + index * 13) % 31) - 15,
    y: center.y + ((seed + index * 17) % 101) - 50,
  }))
}

function selectedState(): ObjectEditEditorState {
  const selection = selectionFromStrokes([{ kind: 'tap', points: [{ x: 0.4, y: 0.5 }] }], naturalSize)
  return {
    selection,
    operation: 'move',
    placement: { source: { x: 0.4, y: 0.5 }, destination: { x: 0.8, y: 0.7 } },
  }
}

describe('object-edit selection properties', () => {
  it('Property 3: atomically accepts one complete valid stroke or preserves the prior selection exactly', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_SELECTION_POINTS }), samplePathArbitrary, (pointCount, samples) => {
        const current = selectionWithPointCount(pointCount)
        const before = JSON.stringify(current)
        const result = addCompletedStrokeAtomic(current, samples, bounds, naturalSize)

        if (!result.accepted) {
          expect(result.selection).toBe(current)
          expect(JSON.stringify(result.selection)).toBe(before)
          return
        }

        expect(result.selection.strokes).toHaveLength(current.strokes.length + 1)
        expect(result.selection.strokes.slice(0, -1)).toEqual(current.strokes)
        expect(result.selection.strokes.at(-1)?.points.length).toBeGreaterThan(0)
        assertSelectionWithinLimits(result.selection)
      }),
      { numRuns: 100 },
    )
  })

  it('Property 4: circles, ovals, self-intersections, and random walks remain one raw path', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('circle' as const, 'oval' as const, 'self-intersection' as const, 'random-walk' as const),
        fc.integer({ min: 0, max: 10000 }),
        (kind, seed) => {
          const result = addCompletedStrokeAtomic(EMPTY_SELECTION, shapeSamples(kind, seed), bounds, naturalSize)
          expect(result.accepted).toBe(true)
          expect(result.selection.strokes).toHaveLength(1)
          expect(result.selection.strokes[0]).toMatchObject({ kind: 'path' })
          if (result.selection.strokes[0]?.kind === 'path') {
            expect(result.selection.strokes[0].points.length).toBeGreaterThanOrEqual(2)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Property 5: reducer lifecycle sequences clear and preserve selection/Move placement exactly as specified', () => {
    const eventKinds = fc.array(
      fc.constantFrom(
        'CLEAR',
        'CANCEL',
        'CLOSE',
        'SOURCE_CHANGED',
        'SUBMISSION_ACCEPTED',
        'MODEL_CHANGED',
        'TOOLBAR_CHANGED',
        'VIEWPORT_CHANGED',
        'SUBMISSION_REJECTED',
        'SELECTION_ACCEPTED',
        'UNDO_APPLIED',
      ),
      { minLength: 1, maxLength: 30 },
    )
    fc.assert(
      fc.property(eventKinds, (events) => {
        let state = selectedState()
        for (const event of events) {
          const previous = state
          let action: ObjectEditEditorAction
          if (event === 'SELECTION_ACCEPTED' || event === 'UNDO_APPLIED') {
            action = { type: event, selection: EMPTY_SELECTION }
          } else {
            action = { type: event }
          }
          state = objectEditEditorReducer(state, action)

          if (['CLEAR', 'CANCEL', 'CLOSE', 'SOURCE_CHANGED', 'SUBMISSION_ACCEPTED'].includes(event)) {
            expect(state.selection).toBe(EMPTY_SELECTION)
            expect(state.placement).toBeNull()
          } else if (['MODEL_CHANGED', 'TOOLBAR_CHANGED', 'VIEWPORT_CHANGED', 'SUBMISSION_REJECTED'].includes(event)) {
            expect(state).toBe(previous)
          } else if (previous.selection !== EMPTY_SELECTION) {
            expect(state.selection).toBe(EMPTY_SELECTION)
            expect(state.placement).toBeNull()
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})
