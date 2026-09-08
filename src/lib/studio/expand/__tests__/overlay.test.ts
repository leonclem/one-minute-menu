import {
  expandDestinationScale,
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
})
