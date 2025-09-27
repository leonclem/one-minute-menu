import { isOrientationRotated, applyExifOrientationTransform } from '@/lib/image-utils'
import { contrastRatio, isWcagAA, ensureTextContrast, hexToRgb, rgbToHex } from '@/lib/color'

describe('EXIF orientation helpers', () => {
  test('isOrientationRotated returns true for 5-8 and false otherwise', () => {
    const rotated = [5, 6, 7, 8]
    const notRotated = [1, 2, 3, 4, 9, 0, -1]
    for (const o of rotated) expect(isOrientationRotated(o)).toBe(true)
    for (const o of notRotated) expect(isOrientationRotated(o)).toBe(false)
  })

  test('applyExifOrientationTransform calls context methods as expected for common cases', () => {
    const ctx: any = {
      translate: jest.fn(),
      rotate: jest.fn(),
      scale: jest.fn(),
    }

    // Orientation 1: no-op
    applyExifOrientationTransform(ctx, 1, 100, 200)
    expect(ctx.translate).not.toHaveBeenCalled()
    expect(ctx.rotate).not.toHaveBeenCalled()
    expect(ctx.scale).not.toHaveBeenCalled()

    // Orientation 3: 180°
    applyExifOrientationTransform(ctx, 3, 100, 200)
    expect(ctx.translate).toHaveBeenCalledWith(100, 200)
    expect(ctx.rotate).toHaveBeenCalled()

    // Orientation 6: 90° right
    applyExifOrientationTransform(ctx, 6, 100, 200)
    expect(ctx.rotate).toHaveBeenCalled()
  })
})

describe('color utils', () => {
  test('computes contrast ratio', () => {
    const ratio = contrastRatio('#000000', '#FFFFFF')
    expect(Math.round(ratio * 10) / 10).toBe(21)
  })

  test('ensures WCAG AA', () => {
    expect(isWcagAA(4.5)).toBe(true)
    expect(isWcagAA(3.9)).toBe(false)
  })

  test('hex <-> rgb roundtrip', () => {
    const rgb = hexToRgb('#3B82F6')
    const hex = rgbToHex(rgb)
    expect(hex.toLowerCase()).toBe('#3b82f6')
  })

  test('chooses readable text color', () => {
    const text = ensureTextContrast('#FFFFFF', '#111827')
    const ratio = contrastRatio(text, '#FFFFFF')
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})


