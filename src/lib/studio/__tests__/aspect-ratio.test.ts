/**
 * @jest-environment node
 */

import { nearestStudioAspectRatio } from '../aspect-ratio'

describe('nearestStudioAspectRatio', () => {
  it('maps exact supported ratios onto themselves', () => {
    expect(nearestStudioAspectRatio(1000, 1000)).toBe('1:1')
    expect(nearestStudioAspectRatio(1500, 1000)).toBe('3:2')
    expect(nearestStudioAspectRatio(1000, 1500)).toBe('2:3')
    expect(nearestStudioAspectRatio(1600, 1200)).toBe('4:3')
    expect(nearestStudioAspectRatio(1200, 1600)).toBe('3:4')
    expect(nearestStudioAspectRatio(1080, 1350)).toBe('4:5')
    expect(nearestStudioAspectRatio(1350, 1080)).toBe('5:4')
    expect(nearestStudioAspectRatio(1920, 1080)).toBe('16:9')
    expect(nearestStudioAspectRatio(1080, 1920)).toBe('9:16')
    expect(nearestStudioAspectRatio(2100, 900)).toBe('21:9')
  })

  it('snaps a frame between 3:2 and 16:9 to the closer label', () => {
    expect(nearestStudioAspectRatio(1024, 612)).toBe('16:9')
    expect(nearestStudioAspectRatio(1400, 900)).toBe('3:2')
  })

  it('rejects a non-positive size', () => {
    expect(() => nearestStudioAspectRatio(0, 100)).toThrow('Width and height must be positive.')
  })
})
