import { objectEditEditorReducer, INITIAL_OBJECT_EDIT_EDITOR_STATE } from '../editor-state'
import { selectionFromStrokes } from '../selection'

const naturalSize = { width: 1000, height: 1000 }
const selection = selectionFromStrokes([{ kind: 'tap', points: [{ x: 0.4, y: 0.5 }] }], naturalSize)

describe('object-edit editor reducer', () => {
  it.each(['CLEAR', 'CANCEL', 'CLOSE', 'SOURCE_CHANGED', 'SUBMISSION_ACCEPTED'] as const)(
    '%s clears selection and placement',
    (type) => {
      const withPlacement = {
        selection,
        operation: 'move' as const,
        placement: { source: { x: 0.4, y: 0.5 }, destination: { x: 0.8, y: 0.8 } },
      }
      const next = objectEditEditorReducer(withPlacement, { type })
      expect(next.selection.strokes).toEqual([])
      expect(next.placement).toBeNull()
    },
  )

  it('preserves selection and placement for non-clearing controls and pre-submission rejection', () => {
    const state = {
      selection,
      operation: 'move' as const,
      placement: { source: { x: 0.4, y: 0.5 }, destination: { x: 0.8, y: 0.8 } },
    }
    for (const type of ['MODEL_CHANGED', 'TOOLBAR_CHANGED', 'VIEWPORT_CHANGED', 'SUBMISSION_REJECTED'] as const) {
      expect(objectEditEditorReducer(state, { type })).toBe(state)
    }
  })

  it('clears existing placement after an accepted selection change or undo', () => {
    const state = {
      selection,
      operation: 'move' as const,
      placement: { source: { x: 0.4, y: 0.5 }, destination: { x: 0.8, y: 0.8 } },
    }
    const changed = selectionFromStrokes([{ kind: 'tap', points: [{ x: 0.2, y: 0.2 }] }], naturalSize)

    expect(objectEditEditorReducer(state, { type: 'SELECTION_ACCEPTED', selection: changed }).placement).toBeNull()
    expect(objectEditEditorReducer(state, { type: 'UNDO_APPLIED', selection: changed }).placement).toBeNull()
  })

  it('derives Move source from the current selection when placing a destination', () => {
    const state = objectEditEditorReducer(INITIAL_OBJECT_EDIT_EDITOR_STATE, {
      type: 'SELECTION_ACCEPTED',
      selection,
    })
    const next = objectEditEditorReducer(state, { type: 'DESTINATION_PLACED', destination: { x: 1, y: 0 } })

    expect(next.placement?.source).toEqual({ x: 0.4, y: 0.5 })
    expect(next.placement?.destination).toEqual({ x: 1, y: 0 })
  })
})
