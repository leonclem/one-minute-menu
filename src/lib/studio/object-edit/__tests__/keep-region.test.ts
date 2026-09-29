import { keepOutlineFromSelection, keepOutlinePoints } from '../keep-region'

describe('keep outline', () => {
  it('closes an open outline and keeps one that already returns to its start', () => {
    const open = [
      { x: 0.2, y: 0.2 },
      { x: 0.6, y: 0.2 },
      { x: 0.5, y: 0.7 },
    ]
    expect(keepOutlinePoints(open)).toEqual([...open, open[0]])
    expect(keepOutlinePoints([...open, { x: 0.201, y: 0.2 }])).toEqual([...open, { x: 0.201, y: 0.2 }])
  })

  it('accepts one drawn path and rejects a tap or a short stroke', () => {
    const path = [
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.1 },
      { x: 0.4, y: 0.8 },
    ]
    expect(keepOutlineFromSelection({ strokes: [{ kind: 'path', points: path }] })).toEqual([...path, path[0]])
    expect(keepOutlineFromSelection({ strokes: [{ kind: 'tap', points: [{ x: 0.2, y: 0.2 }] }] })).toBeNull()
    expect(keepOutlineFromSelection({ strokes: [{ kind: 'path', points: path.slice(0, 2) }] })).toBeNull()
    expect(
      keepOutlineFromSelection({
        strokes: [
          { kind: 'path', points: path },
          { kind: 'path', points: path },
        ],
      }),
    ).toBeNull()
  })
})
