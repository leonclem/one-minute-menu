import { deriveSelectionSourcePoint, type MovePlacement } from './contracts'
import type { NormalizedPoint } from './contracts'
import type { SelectionState } from './selection'
import { EMPTY_SELECTION } from './selection'

export type EditOperation = 'remove' | 'move' | null

export type ObjectEditEditorState = {
  selection: SelectionState
  operation: EditOperation
  placement: MovePlacement | null
}

export const INITIAL_OBJECT_EDIT_EDITOR_STATE: ObjectEditEditorState = Object.freeze({
  selection: EMPTY_SELECTION,
  operation: null,
  placement: null,
})

export type ObjectEditEditorAction =
  | { type: 'SELECTION_ACCEPTED'; selection: SelectionState }
  | { type: 'UNDO_APPLIED'; selection: SelectionState }
  | { type: 'CLEAR' | 'CANCEL' | 'CLOSE' | 'SOURCE_CHANGED' | 'SUBMISSION_ACCEPTED' }
  | { type: 'OPERATION_CHANGED'; operation: EditOperation }
  | { type: 'MODEL_CHANGED' | 'TOOLBAR_CHANGED' | 'VIEWPORT_CHANGED' | 'SUBMISSION_REJECTED' }
  | { type: 'DESTINATION_PLACED'; destination: NormalizedPoint }

function clearSelectionAndPlacement(state: ObjectEditEditorState): ObjectEditEditorState {
  if (state.selection.strokes.length === 0 && state.placement === null) return state
  return { ...state, selection: EMPTY_SELECTION, placement: null }
}

function selectionChanged(
  current: SelectionState,
  next: SelectionState,
): boolean {
  return current !== next && current.strokes !== next.strokes
}

export function objectEditEditorReducer(
  state: ObjectEditEditorState,
  action: ObjectEditEditorAction,
): ObjectEditEditorState {
  switch (action.type) {
    case 'CLEAR':
    case 'CANCEL':
    case 'CLOSE':
    case 'SOURCE_CHANGED':
    case 'SUBMISSION_ACCEPTED':
      return clearSelectionAndPlacement(state)
    case 'SELECTION_ACCEPTED':
    case 'UNDO_APPLIED':
      if (!selectionChanged(state.selection, action.selection)) return state
      return { ...state, selection: action.selection, placement: null }
    case 'OPERATION_CHANGED':
      return state.operation === action.operation ? state : { ...state, operation: action.operation }
    case 'DESTINATION_PLACED': {
      if (!state.selection.boundingRegion) return state
      const placement: MovePlacement = {
        source: deriveSelectionSourcePoint(state.selection.boundingRegion),
        destination: action.destination,
      }
      return { ...state, placement }
    }
    case 'MODEL_CHANGED':
    case 'TOOLBAR_CHANGED':
    case 'VIEWPORT_CHANGED':
    case 'SUBMISSION_REJECTED':
      return state
    default:
      return state
  }
}
