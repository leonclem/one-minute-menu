import { projectLevelAEditor } from '../level-a-projection'
import { EMPTY_SELECTION, selectionFromStrokes } from '../selection'

describe('Level A presentation projection', () => {
  it('provides the selection instruction for an empty editor', () => {
    const projection = projectLevelAEditor({ selection: EMPTY_SELECTION, operation: null, placement: null })

    expect(projection.guidanceText).toBe('Tap or draw over one object.')
    expect(projection.statusText).toBeNull()
    expect(projection.rawAnnotations).toEqual([])
  })

  it('renders raw taps and paths, plus focused guidance at the sixth stroke', () => {
    const selection = selectionFromStrokes(
      Array.from({ length: 6 }, (_, index) => ({
        kind: 'tap' as const,
        points: [{ x: index / 10, y: 0.5 }],
      })),
      { width: 1000, height: 1000 },
    )
    const projection = projectLevelAEditor({ selection, operation: 'remove', placement: null })

    expect(projection.rawAnnotations).toHaveLength(6)
    expect(projection.rawAnnotations.every((primitive) => primitive.kind === 'target-marker')).toBe(true)
    expect(projection.statusText).toBe('Selection added')
    expect(projection.guidanceText).toContain('Keep the annotation focused on one object')
  })

  it('projects approximate Move graphics and warning text without semantic data', () => {
    const selection = selectionFromStrokes([{ kind: 'tap', points: [{ x: 0.5, y: 0.5 }] }], {
      width: 1000,
      height: 1000,
    })
    const projection = projectLevelAEditor({
      selection,
      operation: 'move',
      placement: { source: { x: 0.5, y: 0.5 }, destination: { x: 1, y: 0 } },
    })

    expect(projection.destinationMarker).toEqual({ x: 1, y: 0 })
    expect(projection.moveArrow).toEqual({ from: { x: 0.5, y: 0.5 }, to: { x: 1, y: 0 } })
    expect(projection.approximatePlacementGuide).not.toBeNull()
    expect(projection.warningText).toContain('may extend beyond the image edge')
    expect(JSON.stringify(projection).toLowerCase()).not.toMatch(/mask|segmentation|lasso|pixel selection|confidence/)
  })
})
