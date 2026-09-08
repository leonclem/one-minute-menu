import {
  expandDestinationInset,
  expandDestinationScale,
  expandGestureFromPointer,
  expandLayoutFromHandle,
  expandPhotoRect,
  expandPhotoScale,
  expandPresetFromPointer,
  snapExpandPreset,
} from '../overlay'

describe('expand overlay math', () => {
  it('sizes the photo and destination inside the Editorial frame', () => {
    expect(expandPhotoScale(0.35)).toBeCloseTo(1 / 1.7)
    expect(expandDestinationScale(0.2, 0.35)).toBeCloseTo(1.4 / 1.7)
    expect(expandDestinationScale(0.35, 0.35)).toBe(1)
  })

  it('snaps pad ratios onto the three named presets', () => {
    expect(snapExpandPreset(0.09)).toBe('a_little')
    expect(snapExpandPreset(0.18)).toBe('balanced')
    expect(snapExpandPreset(0.34)).toBe('editorial')
  })

  it('maps a corner drag at the overlay edge to Editorial', () => {
    expect(expandPresetFromPointer({ x: 1, y: 1 })).toBe('editorial')
  })

  it('maps a drag just outside the photo to A little wider', () => {
    expect(expandPresetFromPointer({ x: 0.5 + 0.31, y: 0.5 })).toBe('a_little')
  })

  it('sets layout from edge and corner handles', () => {
    expect(expandLayoutFromHandle('w')).toBe('left')
    expect(expandLayoutFromHandle('e')).toBe('right')
    expect(expandLayoutFromHandle('n')).toBe('top')
    expect(expandLayoutFromHandle('s')).toBe('bottom')
    expect(expandLayoutFromHandle('nw')).toBe('top_left')
    expect(expandLayoutFromHandle('se')).toBe('bottom_right')
  })

  it('maps an edge drag to a side and a corner drag to that corner', () => {
    expect(expandGestureFromPointer({ x: 0, y: 0.5 }, 'w')).toEqual({
      preset: 'editorial',
      layout: 'left',
    })
    expect(expandGestureFromPointer({ x: 1, y: 1 }, 'se')).toEqual({
      preset: 'editorial',
      layout: 'bottom_right',
    })
  })

  it('hugs the photo to the opposite inside edge of the destination', () => {
    const left = expandPhotoRect('left', 0.2, 0.35)
    const dest = expandDestinationScale(0.2, 0.35)
    const inset = expandDestinationInset(0.2, 0.35)
    expect(left.x + left.width).toBeCloseTo(inset + dest)
    expect(left.y).toBeCloseTo(inset + (dest - left.height) / 2)

    const all = expandPhotoRect('all', 0.2, 0.35)
    expect(all.x).toBeCloseTo((1 - all.width) / 2)
    expect(all.y).toBeCloseTo((1 - all.height) / 2)

    const topLeft = expandPhotoRect('top_left', 0.2, 0.35)
    expect(topLeft.x + topLeft.width).toBeCloseTo(inset + dest)
    expect(topLeft.y + topLeft.height).toBeCloseTo(inset + dest)
  })
})
