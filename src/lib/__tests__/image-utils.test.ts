import { isOrientationRotated, applyExifOrientationTransform } from '@/lib/image-utils'

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


