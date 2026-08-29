import fc from 'fast-check'

import {
  beginPointer,
  endPointer,
  INITIAL_POINTER_STATE,
  mayCollectAnnotationSamples,
  mayPlaceMoveDestination,
} from '../pointer-state'
import { selectionFromStrokes } from '../selection'

describe('object-edit pointer arbitration properties', () => {
  it('Property 6: a second touch discards only transient input, preserves accepted state, and requires a fresh pointer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 100001, max: 200000 }),
        fc.constantFrom('selection' as const, 'move-placement' as const),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (firstPointerId, secondPointerId, mode, x, y) => {
          const acceptedSelection = selectionFromStrokes([{ kind: 'tap', points: [{ x, y }] }], {
            width: 1200,
            height: 800,
          })
          const first = beginPointer(INITIAL_POINTER_STATE, {
            pointerId: firstPointerId,
            pointerType: 'touch',
            mode,
            startsInsideImage: true,
            startsOnMoveGuide: mode === 'move-placement',
          })
          const second = beginPointer(first.state, {
            pointerId: secondPointerId,
            pointerType: 'touch',
            mode,
            startsInsideImage: true,
            startsOnMoveGuide: mode === 'move-placement',
          })

          expect(second.discardTransient).toBe(true)
          expect(second.beginPanZoom).toBe(true)
          expect(second.state.phase).toBe('pinch-pan')
          expect(mayCollectAnnotationSamples(second.state, firstPointerId)).toBe(false)
          expect(mayPlaceMoveDestination(second.state, firstPointerId)).toBe(false)
          // Accepted editor state is external to pointer arbitration and remains untouched.
          expect(acceptedSelection.strokes).toEqual([{ kind: 'tap', points: [{ x, y }] }])

          const awaitingFreshPointer = endPointer(second.state, secondPointerId)
          expect(awaitingFreshPointer.phase).toBe('await-fresh-pointer')
          expect(mayCollectAnnotationSamples(awaitingFreshPointer, firstPointerId)).toBe(false)
          expect(mayPlaceMoveDestination(awaitingFreshPointer, firstPointerId)).toBe(false)

          const idle = endPointer(awaitingFreshPointer, firstPointerId)
          expect(idle).toEqual(INITIAL_POINTER_STATE)
          const fresh = beginPointer(idle, {
            pointerId: firstPointerId,
            pointerType: 'touch',
            mode: 'selection',
            startsInsideImage: true,
            startsOnMoveGuide: false,
          })
          expect(fresh.beginSelection).toBe(true)
          expect(mayCollectAnnotationSamples(fresh.state, firstPointerId)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
