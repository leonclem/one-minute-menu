import {
  CROP_LOW_RES_HINT_TEXT,
  LOW_RES_NOTICE_TEXT,
  cropFloorHint,
  cropForPreset,
  storedPixelSize,
} from '../index'

describe('storedPixelSize', () => {
  it('returns stored width/height and ignores missing rows', () => {
    expect(storedPixelSize({ width: 2400, height: 1600 })).toEqual({ width: 2400, height: 1600 })
    expect(storedPixelSize({ width: null, height: 1600 })).toBeNull()
    expect(storedPixelSize({ width: 0, height: 800 })).toBeNull()
    expect(storedPixelSize(null)).toBeNull()
  })
})

describe('crop copy', () => {
  it('keeps user-facing crop copy free of pixel counts', () => {
    expect(LOW_RES_NOTICE_TEXT).toMatch(/lower resolution than recommended/)
    expect(CROP_LOW_RES_HINT_TEXT).toBe(
      'This crop is a lower resolution than recommended. Generate may look soft.',
    )
    expect(`${LOW_RES_NOTICE_TEXT} ${CROP_LOW_RES_HINT_TEXT}`).not.toMatch(/\d+\s*px/i)
  })

  it('warns when the crop would be lower resolution, without blocking', () => {
    const landscape = { width: 2000, height: 900 }
    expect(cropFloorHint({ x: 0, y: 0, width: 0.2, height: 1 }, landscape)).toBe(
      CROP_LOW_RES_HINT_TEXT,
    )
    expect(cropFloorHint(cropForPreset('3:4', landscape), landscape)).toBe(CROP_LOW_RES_HINT_TEXT)
    expect(cropFloorHint({ x: 0, y: 0, width: 1, height: 1 }, { width: 1600, height: 1600 })).toBeNull()
  })
})
