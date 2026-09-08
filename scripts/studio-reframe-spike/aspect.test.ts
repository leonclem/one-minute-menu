/**
 * @jest-environment node
 */

import { nearestFlashAspectRatio } from './aspect'

describe('nearestFlashAspectRatio', () => {
  it('maps common phone shapes onto Flash ratios', () => {
    expect(nearestFlashAspectRatio(1200, 1200)).toBe('1:1')
    expect(nearestFlashAspectRatio(1600, 1200)).toBe('4:3')
    expect(nearestFlashAspectRatio(1200, 1600)).toBe('3:4')
    expect(nearestFlashAspectRatio(1920, 1080)).toBe('16:9')
    expect(nearestFlashAspectRatio(1080, 1920)).toBe('9:16')
    expect(nearestFlashAspectRatio(1080, 1350)).toBe('4:5')
  })

  it('snaps an odd portrait toward 3:4 or 4:5 rather than landscape', () => {
    expect(nearestFlashAspectRatio(1000, 1400)).toBe('3:4')
  })
})
