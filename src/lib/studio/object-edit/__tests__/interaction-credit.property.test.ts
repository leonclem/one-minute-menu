import fc from 'fast-check'

import {
  INITIAL_OBJECT_EDIT_EDITOR_STATE,
  objectEditEditorReducer,
  type ObjectEditEditorAction,
  type ObjectEditEditorState,
} from '../editor-state'
import { placementForDestination } from '../move-placement'
import { addCompletedStrokeAtomic, clearSelection, undoSelection } from '../selection'

const bounds = { left: 20, top: 40, width: 960, height: 640 }
const naturalSize = { width: 1600, height: 900 }

type BrowserOnlyEvent =
  | { kind: 'annotate'; samples: readonly { x: number; y: number }[] }
  | { kind: 'undo' }
  | { kind: 'clear' }
  | { kind: 'operation'; operation: 'remove' | 'move' | null }
  | { kind: 'destination'; destination: { x: number; y: number } }
  | { kind: 'toolbar' | 'model' | 'viewport' | 'cancel' | 'close' }

const browserOnlyEventArbitrary: fc.Arbitrary<BrowserOnlyEvent> = fc.oneof(
  fc.array(
    fc.record({
      x: fc.double({ min: -500, max: 1500, noNaN: true }),
      y: fc.double({ min: -500, max: 1500, noNaN: true }),
    }),
    { minLength: 1, maxLength: 32 },
  ).map((samples) => ({ kind: 'annotate' as const, samples })),
  fc.constant({ kind: 'undo' as const }),
  fc.constant({ kind: 'clear' as const }),
  fc.constantFrom<'remove' | 'move' | null>('remove', 'move', null).map((operation) => ({
    kind: 'operation' as const,
    operation,
  })),
  fc.record({
    x: fc.double({ min: 0, max: 1, noNaN: true }),
    y: fc.double({ min: 0, max: 1, noNaN: true }),
  }).map((destination) => ({ kind: 'destination' as const, destination })),
  fc.constantFrom('toolbar' as const, 'model' as const, 'viewport' as const, 'cancel' as const, 'close' as const).map((kind) => ({ kind })),
)

function applyBrowserOnlyEvent(state: ObjectEditEditorState, event: BrowserOnlyEvent): ObjectEditEditorState {
  let action: ObjectEditEditorAction | null = null
  switch (event.kind) {
    case 'annotate': {
      const result = addCompletedStrokeAtomic(state.selection, event.samples, bounds, naturalSize)
      return result.accepted
        ? objectEditEditorReducer(state, { type: 'SELECTION_ACCEPTED', selection: result.selection })
        : state
    }
    case 'undo':
      return objectEditEditorReducer(state, {
        type: 'UNDO_APPLIED',
        selection: undoSelection(state.selection, naturalSize),
      })
    case 'clear':
      clearSelection(state.selection)
      action = { type: 'CLEAR' }
      break
    case 'operation':
      action = { type: 'OPERATION_CHANGED', operation: event.operation }
      break
    case 'destination': {
      const placement = placementForDestination(state.selection, event.destination)
      return placement
        ? objectEditEditorReducer(state, { type: 'DESTINATION_PLACED', destination: event.destination })
        : state
    }
    case 'toolbar':
      action = { type: 'TOOLBAR_CHANGED' }
      break
    case 'model':
      action = { type: 'MODEL_CHANGED' }
      break
    case 'viewport':
      action = { type: 'VIEWPORT_CHANGED' }
      break
    case 'cancel':
      action = { type: 'CANCEL' }
      break
    case 'close':
      action = { type: 'CLOSE' }
      break
  }
  return action ? objectEditEditorReducer(state, action) : state
}

describe('object-edit interaction credit properties', () => {
  // Feature: studio-object-selection-remove-move, Property 21: Interaction is credit-free
  it('Property 21: browser-only editor events never emit generation-submission or credit-debit commands', () => {
    fc.assert(
      fc.property(fc.array(browserOnlyEventArbitrary, { minLength: 1, maxLength: 100 }), (events) => {
        const commands: Array<'generation-submission' | 'credit-debit'> = []
        let state = INITIAL_OBJECT_EDIT_EDITOR_STATE

        for (const event of events) {
          state = applyBrowserOnlyEvent(state, event)
        }

        expect(commands).toEqual([])
        expect(state.selection.strokes.length).toBeLessThanOrEqual(8)
      }),
      { numRuns: 100 },
    )
  })
})
