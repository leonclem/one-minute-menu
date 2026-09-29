import { objectEditEditorReducer, INITIAL_OBJECT_EDIT_EDITOR_STATE } from '../editor-state'
import { EMPTY_SELECTION, selectionFromStrokes } from '../selection'

const naturalSize = { width: 1000, height: 1000 }
const selection = selectionFromStrokes([{ kind: 'tap', points: [{ x: 0.4, y: 0.5 }] }], naturalSize)
const replaced = selectionFromStrokes([{ kind: 'tap', points: [{ x: 0.2, y: 0.2 }] }], naturalSize)

describe('object-edit editor reducer', () => {
  it.each(['CLEAR', 'CANCEL', 'CLOSE', 'SOURCE_CHANGED', 'SUBMISSION_ACCEPTED'] as const)(
    '%s clears selection and placement',
    (type) => {
      const withPlacement = {
        selection,
        previousSelection: replaced,
        operation: 'move' as const,
        placement: { source: { x: 0.4, y: 0.5 }, destination: { x: 0.8, y: 0.8 } },
      }
      const next = objectEditEditorReducer(withPlacement, { type })
      expect(next.selection.strokes).toEqual([])
      expect(next.previousSelection.strokes).toEqual([])
      expect(next.placement).toBeNull()
    },
  )

  it('preserves selection and placement for non-clearing controls and pre-submission rejection', () => {
    const state = {
      selection,
      previousSelection: EMPTY_SELECTION,
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
      previousSelection: EMPTY_SELECTION,
      operation: 'move' as const,
      placement: { source: { x: 0.4, y: 0.5 }, destination: { x: 0.8, y: 0.8 } },
    }

    expect(objectEditEditorReducer(state, { type: 'SELECTION_ACCEPTED', selection: replaced }).placement).toBeNull()
    expect(objectEditEditorReducer(state, { type: 'UNDO_APPLIED', selection: replaced }).placement).toBeNull()
  })

  it('keeps the replaced gesture and restores it once on undo', () => {
    const withCurrent = objectEditEditorReducer(
      { ...INITIAL_OBJECT_EDIT_EDITOR_STATE, selection },
      { type: 'SELECTION_ACCEPTED', selection: replaced },
    )
    expect(withCurrent.selection).toBe(replaced)
    expect(withCurrent.previousSelection).toBe(selection)

    const restored = objectEditEditorReducer(withCurrent, { type: 'UNDO' })
    expect(restored.selection).toBe(selection)
    expect(restored.previousSelection).toBe(EMPTY_SELECTION)

    const cleared = objectEditEditorReducer(restored, { type: 'UNDO' })
    expect(cleared.selection).toBe(EMPTY_SELECTION)
    expect(cleared.previousSelection).toBe(EMPTY_SELECTION)
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
