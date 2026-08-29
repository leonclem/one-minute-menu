import {
  addCompletedStrokeAtomic,
  clearSelection,
  EMPTY_SELECTION,
  MAX_SELECTION_STROKES,
  selectionFromStrokes,
  undoSelection,
} from '../selection'

const bounds = { left: 0, top: 0, width: 100, height: 100 }
const naturalSize = { width: 1000, height: 1000 }

describe('object-edit selection primitives', () => {
  it('atomically adds one tap when down-to-up movement stays within 10 CSS pixels', () => {
    const result = addCompletedStrokeAtomic(EMPTY_SELECTION, [{ x: 10, y: 10 }, { x: 20, y: 10 }], bounds, naturalSize)

    expect(result.accepted).toBe(true)
    expect(result.selection.strokes).toEqual([{ kind: 'tap', points: [{ x: 0.2, y: 0.1 }] }])
  })

  it('retains one raw path without recognizing its geometric shape', () => {
    const result = addCompletedStrokeAtomic(
      EMPTY_SELECTION,
      [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }, { x: 10, y: 10 }],
      bounds,
      naturalSize,
    )

    expect(result.accepted).toBe(true)
    expect(result.selection.strokes).toHaveLength(1)
    expect(result.selection.strokes[0].kind).toBe('path')
  })

  it('simplifies a completed dense path while retaining endpoints', () => {
    const denseLine = Array.from({ length: 600 }, (_, index) => ({ x: index / 6, y: 10 }))
    const result = addCompletedStrokeAtomic(EMPTY_SELECTION, denseLine, bounds, naturalSize)

    expect(result.accepted).toBe(true)
    const stroke = result.selection.strokes[0]
    expect(stroke.kind).toBe('path')
    if (stroke.kind === 'path') {
      expect(stroke.points.length).toBeLessThanOrEqual(512)
      expect(stroke.points[0]).toEqual({ x: 0, y: 0.1 })
      expect(stroke.points[stroke.points.length - 1]).toEqual({ x: expect.closeTo(0.9983333333333334), y: 0.1 })
    }
  })

  it('rejects an entire addition at the stroke limit without changing existing selection', () => {
    const selection = selectionFromStrokes(
      Array.from({ length: MAX_SELECTION_STROKES }, (_, index) => ({
        kind: 'tap' as const,
        points: [{ x: index / 10, y: 0.5 }],
      })),
      naturalSize,
    )
    const result = addCompletedStrokeAtomic(selection, [{ x: 10, y: 10 }], bounds, naturalSize)

    expect(result).toEqual({ selection, accepted: false, reason: 'stroke-limit' })
    expect(result.selection).toBe(selection)
  })

  it('undoes only the newest completed stroke and clears the full selection', () => {
    const selected = selectionFromStrokes(
      [
        { kind: 'tap', points: [{ x: 0.1, y: 0.1 }] },
        { kind: 'tap', points: [{ x: 0.2, y: 0.2 }] },
      ],
      naturalSize,
    )

    expect(undoSelection(selected, naturalSize).strokes).toEqual([
      { kind: 'tap', points: [{ x: 0.1, y: 0.1 }] },
    ])
    expect(clearSelection(selected)).toBe(EMPTY_SELECTION)
    expect(undoSelection(EMPTY_SELECTION, naturalSize)).toBe(EMPTY_SELECTION)
  })
})
