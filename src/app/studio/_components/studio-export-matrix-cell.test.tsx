import { exportAspectBoxSize } from './studio-export-matrix-cell'

describe('exportAspectBoxSize', () => {
  it('keeps square, landscape, and portrait outlines distinct', () => {
    expect(exportAspectBoxSize(1200, 1200, 40)).toEqual({ width: 40, height: 40 })
    expect(exportAspectBoxSize(1600, 900, 40)).toEqual({ width: 40, height: 23 })
    expect(exportAspectBoxSize(1080, 1350, 40).height).toBe(40)
    expect(exportAspectBoxSize(1080, 1350, 40).width).toBeLessThan(40)
  })
})
