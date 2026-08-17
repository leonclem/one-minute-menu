/**
 * Fit / zoom / pan math for the Studio Workbench canvas.
 * Zoom 1 is "fit entire image"; pan is in viewport pixels around centre.
 */

export const WORKBENCH_ZOOM_MIN = 1
export const WORKBENCH_ZOOM_MAX = 8
export const WORKBENCH_FIT_PADDING = 12
export const WORKBENCH_ZOOM_STEP = 1.25

export type WorkbenchCamera = {
  zoom: number
  panX: number
  panY: number
}

export const WORKBENCH_FIT_CAMERA: WorkbenchCamera = { zoom: 1, panX: 0, panY: 0 }

export function computeFitScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = WORKBENCH_FIT_PADDING,
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1
  const availW = Math.max(1, viewportWidth - padding * 2)
  const availH = Math.max(1, viewportHeight - padding * 2)
  return Math.min(availW / imageWidth, availH / imageHeight)
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return WORKBENCH_ZOOM_MIN
  return Math.min(WORKBENCH_ZOOM_MAX, Math.max(WORKBENCH_ZOOM_MIN, zoom))
}

export function clampPan(
  panX: number,
  panY: number,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
): { panX: number; panY: number } {
  const displayW = imageWidth * scale
  const displayH = imageHeight * scale
  const maxX = Math.max(0, displayW - viewportWidth) / 2
  const maxY = Math.max(0, displayH - viewportHeight) / 2
  return {
    panX: Math.min(maxX, Math.max(-maxX, panX)) || 0,
    panY: Math.min(maxY, Math.max(-maxY, panY)) || 0,
  }
}

export function zoomAroundPoint(
  camera: WorkbenchCamera,
  nextZoom: number,
  pointX: number,
  pointY: number,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  fitScale: number,
): WorkbenchCamera {
  const zoom = clampZoom(nextZoom)
  const oldScale = fitScale * camera.zoom
  const newScale = fitScale * zoom
  if (oldScale <= 0) return { ...WORKBENCH_FIT_CAMERA }

  const originX = viewportWidth / 2
  const originY = viewportHeight / 2
  const offsetX = pointX - originX
  const offsetY = pointY - originY
  const ratio = newScale / oldScale
  const panX = offsetX - (offsetX - camera.panX) * ratio
  const panY = offsetY - (offsetY - camera.panY) * ratio
  return {
    zoom,
    ...clampPan(panX, panY, imageWidth, imageHeight, viewportWidth, viewportHeight, newScale),
  }
}

export function imageBox(
  camera: WorkbenchCamera,
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  fitScale: number,
): { left: number; top: number; width: number; height: number } {
  const scale = fitScale * camera.zoom
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    left: (viewportWidth - width) / 2 + camera.panX,
    top: (viewportHeight - height) / 2 + camera.panY,
    width,
    height,
  }
}
