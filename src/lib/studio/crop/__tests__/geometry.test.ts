import {
  CROP_MIN_WINDOW_PX,
  applyCropPointer,
  cropForPreset,
  cropPixelAspect,
  isCropLargeEnough,
  isLowResCrop,
  isLowResImage,
  maxInscribedCrop,
  pixelExtractFromNormalized,
  resolveCropPixelAspect,
  translateCrop,
} from '../index'

const LANDSCAPE = { width: 1600, height: 900 }
const SQUARE = { width: 1200, height: 1200 }
const PORTRAIT = { width: 900, height: 1600 }

describe('maxInscribedCrop / cropForPreset', () => {
  it('Original uses the full frame', () => {
    expect(cropForPreset('original', LANDSCAPE)).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(resolveCropPixelAspect('original', LANDSCAPE)).toBeCloseTo(1600 / 900)
  })

  it('Free starts as the full frame', () => {
    expect(cropForPreset('free', LANDSCAPE)).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(resolveCropPixelAspect('free', LANDSCAPE)).toBeNull()
  })

  it('locks 1:1 inside a 16:9 photo as a centred vertical strip', () => {
    const rect = cropForPreset('1:1', LANDSCAPE)
    expect(rect.height).toBeCloseTo(1)
    expect(rect.width).toBeCloseTo(900 / 1600)
    expect(rect.x).toBeCloseTo((1 - 900 / 1600) / 2)
    expect(rect.y).toBeCloseTo(0)
    expect(cropPixelAspect(rect, LANDSCAPE)).toBeCloseTo(1, 2)
  })

  it('locks 16:9 inside a square as a centred horizontal strip', () => {
    const rect = cropForPreset('16:9', SQUARE)
    expect(rect.width).toBeCloseTo(1)
    expect(rect.height).toBeCloseTo(9 / 16)
    expect(rect.y).toBeCloseTo((1 - 9 / 16) / 2)
  })
})

describe('translateCrop', () => {
  it('clamps the window inside the image', () => {
    const window = { x: 0.2, y: 0.2, width: 0.5, height: 0.5 }
    expect(translateCrop(window, -1, 0).x).toBe(0)
    expect(translateCrop(window, 1, 0).x).toBe(0.5)
    expect(translateCrop(window, 0, -1).y).toBe(0)
    expect(translateCrop(window, 0, 1).y).toBe(0.5)
  })
})

describe('applyCropPointer', () => {
  it('moves without changing size', () => {
    const start = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 }
    const next = applyCropPointer({
      startRect: start,
      handle: 'move',
      startPoint: { x: 0.4, y: 0.4 },
      point: { x: 0.5, y: 0.45 },
      natural: SQUARE,
      pixelAspect: 1,
    })
    expect(next.width).toBeCloseTo(0.4)
    expect(next.height).toBeCloseTo(0.4)
    expect(next.x).toBeCloseTo(0.3)
    expect(next.y).toBeCloseTo(0.25)
  })

  it('resizes Free edges independently', () => {
    const start = { x: 0.1, y: 0.1, width: 0.7, height: 0.7 }
    const next = applyCropPointer({
      startRect: start,
      handle: 'e',
      startPoint: { x: 0.8, y: 0.45 },
      point: { x: 0.95, y: 0.45 },
      natural: SQUARE,
      pixelAspect: null,
    })
    expect(next.x).toBeCloseTo(0.1)
    expect(next.height).toBeCloseTo(0.7)
    expect(next.width).toBeCloseTo(0.85)
  })

  it('keeps locked aspect when dragging the south-east corner', () => {
    const start = cropForPreset('1:1', LANDSCAPE)
    const next = applyCropPointer({
      startRect: start,
      handle: 'se',
      startPoint: { x: start.x + start.width, y: start.y + start.height },
      point: {
        x: start.x + start.width - 0.1,
        y: start.y + start.height - 0.1,
      },
      natural: LANDSCAPE,
      pixelAspect: 1,
    })
    expect(cropPixelAspect(next, LANDSCAPE)).toBeCloseTo(1, 1)
    expect(next.x).toBeCloseTo(start.x)
    expect(next.y).toBeCloseTo(start.y)
  })
})

describe('pixel floors', () => {
  it('keeps a small overlay floor so handles stay usable', () => {
    const tiny = { x: 0, y: 0, width: 0.01, height: 0.01 }
    expect(isCropLargeEnough(tiny, { width: 2000, height: 2000 })).toBe(false)
    expect(isCropLargeEnough({ x: 0, y: 0, width: 1, height: 1 }, { width: 800, height: 800 })).toBe(
      true,
    )
    expect(CROP_MIN_WINDOW_PX).toBe(32)
    const region = pixelExtractFromNormalized({ x: 0, y: 0, width: 1, height: 1 }, { width: 800, height: 600 })
    expect(region.width).toBe(800)
    expect(region.height).toBe(600)
  })

  it('warns when the shortest side is under 1024px', () => {
    expect(isLowResImage({ width: 2000, height: 1500 })).toBe(false)
    expect(isLowResImage({ width: 1024, height: 1024 })).toBe(false)
    expect(isLowResImage({ width: 1023, height: 2000 })).toBe(true)
    expect(isLowResCrop({ x: 0, y: 0, width: 0.2, height: 0.2 }, { width: 2000, height: 2000 })).toBe(
      true,
    )
    expect(isLowResCrop({ x: 0, y: 0, width: 1, height: 1 }, { width: 1600, height: 1600 })).toBe(
      false,
    )
  })
})

describe('maxInscribedCrop on portrait', () => {
  it('places a 16:9 window as a centred band', () => {
    const rect = maxInscribedCrop(PORTRAIT, 16 / 9)
    expect(rect.width).toBeCloseTo(1)
    expect(cropPixelAspect(rect, PORTRAIT)).toBeCloseTo(16 / 9, 2)
  })
})
