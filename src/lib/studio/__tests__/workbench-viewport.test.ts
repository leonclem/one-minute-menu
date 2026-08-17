import {
  clampPan,
  clampZoom,
  computeFitScale,
  imageBox,
  WORKBENCH_FIT_CAMERA,
  WORKBENCH_ZOOM_MAX,
  zoomAroundPoint,
} from '../workbench-viewport'

describe('computeFitScale', () => {
  it('fits a landscape image into a short wide viewport without cropping', () => {
    expect(computeFitScale(1600, 900, 800, 200, 0)).toBeCloseTo(200 / 900)
  })

  it('fits a portrait image into a wide viewport without cropping', () => {
    expect(computeFitScale(900, 1600, 800, 400, 0)).toBeCloseTo(400 / 1600)
  })
})

describe('clampPan', () => {
  it('locks pan at fit when the image is smaller than the viewport', () => {
    expect(clampPan(40, -20, 100, 80, 400, 300, 1)).toEqual({ panX: 0, panY: 0 })
  })

  it('keeps the image from being dragged fully off-canvas', () => {
    expect(clampPan(500, 500, 400, 200, 200, 200, 2)).toEqual({ panX: 300, panY: 100 })
  })
})

describe('clampZoom', () => {
  it('does not zoom out past fit or past the max', () => {
    expect(clampZoom(0.2)).toBe(1)
    expect(clampZoom(99)).toBe(WORKBENCH_ZOOM_MAX)
  })
})

describe('zoomAroundPoint', () => {
  it('keeps the cursor-aligned image point stable when zooming in', () => {
    const fitScale = 0.5
    const next = zoomAroundPoint(
      WORKBENCH_FIT_CAMERA,
      2,
      100,
      80,
      400,
      300,
      200,
      160,
      fitScale,
    )
    const before = imageBox(WORKBENCH_FIT_CAMERA, 400, 300, 200, 160, fitScale)
    const after = imageBox(next, 400, 300, 200, 160, fitScale)
    const imgX = (100 - before.left) / before.width
    const imgY = (80 - before.top) / before.height
    expect(after.left + imgX * after.width).toBeCloseTo(100)
    expect(after.top + imgY * after.height).toBeCloseTo(80)
  })
})
