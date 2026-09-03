/**
 * Normalised crop-window math for the Studio workbench.
 * Rects are fractions of the (EXIF-oriented) image: x, y, width, height in 0–1.
 */

import {
  CROP_ASPECT_PRESETS,
  CROP_LOW_RES_WARN_PX,
  CROP_MIN_WINDOW_PX,
  type CropAspectPreset,
} from './constants'

export type NaturalImageSize = { width: number; height: number }

export type NormalizedCropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

export type PixelExtractRegion = {
  left: number
  top: number
  width: number
  height: number
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function assertNaturalSize(size: NaturalImageSize): void {
  if (!isFinitePositive(size.width) || !isFinitePositive(size.height)) {
    throw new RangeError('Natural image dimensions must be finite and positive.')
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Crop coordinates must be finite.')
  return Math.max(0, Math.min(1, value))
}

export function resolveCropPixelAspect(
  preset: CropAspectPreset,
  natural: NaturalImageSize,
): number | null {
  assertNaturalSize(natural)
  if (preset === 'free') return null
  if (preset === 'original') return natural.width / natural.height
  const def = CROP_ASPECT_PRESETS.find((item) => item.id === preset)
  return def?.pixelAspect ?? null
}

/**
 * Largest window of `pixelAspect` (width/height in pixels) that fits in the image.
 * A null aspect uses the full frame (Free default and Original).
 */
export function maxInscribedCrop(
  natural: NaturalImageSize,
  pixelAspect: number | null,
): NormalizedCropRect {
  assertNaturalSize(natural)
  if (pixelAspect === null || !(pixelAspect > 0) || !Number.isFinite(pixelAspect)) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  const normRatio = (pixelAspect * natural.height) / natural.width
  let width: number
  let height: number
  if (normRatio >= 1) {
    width = 1
    height = 1 / normRatio
  } else {
    height = 1
    width = normRatio
  }
  if (width > 1) {
    width = 1
    height = width / normRatio
  }
  if (height > 1) {
    height = 1
    width = height * normRatio
  }

  return {
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  }
}

export function cropForPreset(
  preset: CropAspectPreset,
  natural: NaturalImageSize,
): NormalizedCropRect {
  return maxInscribedCrop(natural, resolveCropPixelAspect(preset, natural))
}

export function minNormalizedCropSize(natural: NaturalImageSize, minPx = CROP_MIN_WINDOW_PX): {
  width: number
  height: number
} {
  assertNaturalSize(natural)
  return {
    width: Math.min(1, minPx / natural.width),
    height: Math.min(1, minPx / natural.height),
  }
}

export function clampCropRect(
  rect: NormalizedCropRect,
  natural: NaturalImageSize,
  minPx = CROP_MIN_WINDOW_PX,
): NormalizedCropRect {
  assertNaturalSize(natural)
  const min = minNormalizedCropSize(natural, minPx)
  const width = Math.min(1, Math.max(min.width, rect.width))
  const height = Math.min(1, Math.max(min.height, rect.height))
  return {
    x: Math.max(0, Math.min(1 - width, rect.x)),
    y: Math.max(0, Math.min(1 - height, rect.y)),
    width,
    height,
  }
}

export function translateCrop(
  rect: NormalizedCropRect,
  dx: number,
  dy: number,
): NormalizedCropRect {
  const width = clamp01(rect.width)
  const height = clamp01(rect.height)
  return {
    x: Math.max(0, Math.min(1 - width, rect.x + dx)),
    y: Math.max(0, Math.min(1 - height, rect.y + dy)),
    width,
    height,
  }
}

export function pixelExtractFromNormalized(
  rect: NormalizedCropRect,
  natural: NaturalImageSize,
): PixelExtractRegion {
  assertNaturalSize(natural)
  const natW = Math.round(natural.width)
  const natH = Math.round(natural.height)
  let left = Math.round(clamp01(rect.x) * natW)
  let top = Math.round(clamp01(rect.y) * natH)
  let width = Math.round(clamp01(rect.width) * natW)
  let height = Math.round(clamp01(rect.height) * natH)
  if (left + width > natW) width = natW - left
  if (top + height > natH) height = natH - top
  if (left < 0) left = 0
  if (top < 0) top = 0
  return {
    left,
    top,
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
}

export function shortestCropSidePx(rect: NormalizedCropRect, natural: NaturalImageSize): number {
  const region = pixelExtractFromNormalized(rect, natural)
  return Math.min(region.width, region.height)
}

export function isCropLargeEnough(
  rect: NormalizedCropRect,
  natural: NaturalImageSize,
  minPx = CROP_MIN_WINDOW_PX,
): boolean {
  return shortestCropSidePx(rect, natural) >= minPx
}

export function isLowResCrop(
  rect: NormalizedCropRect,
  natural: NaturalImageSize,
  warnPx = CROP_LOW_RES_WARN_PX,
): boolean {
  if (!isFinitePositive(natural.width) || !isFinitePositive(natural.height)) return false
  return shortestCropSidePx(rect, natural) < warnPx
}

export function isLowResImage(natural: NaturalImageSize, warnPx = CROP_LOW_RES_WARN_PX): boolean {
  if (!isFinitePositive(natural.width) || !isFinitePositive(natural.height)) return false
  return Math.min(natural.width, natural.height) < warnPx
}

/**
 * Pixel size from `studio_images.width/height`. Never use the workbench
 * Next/Image `naturalWidth` for floors — that is the compressed preview.
 */
export function storedPixelSize(
  image: { width: number | null; height: number | null } | null | undefined,
): NaturalImageSize | null {
  if (!image) return null
  const { width, height } = image
  if (typeof width !== 'number' || typeof height !== 'number') return null
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return { width, height }
}

function clampEdge(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Pixel width / height of a normalised window. */
export function cropPixelAspect(rect: NormalizedCropRect, natural: NaturalImageSize): number {
  const region = pixelExtractFromNormalized(rect, natural)
  return region.width / region.height
}

function fitLockedSize(
  width: number,
  height: number,
  normRatio: number,
  min: { width: number; height: number },
): { width: number; height: number } {
  const fromWidth = { width, height: width / normRatio }
  const fromHeight = { width: height * normRatio, height }
  const widthOk = fromWidth.height >= min.height - 1e-9 && fromWidth.width >= min.width - 1e-9
  const heightOk = fromHeight.width >= min.width - 1e-9 && fromHeight.height >= min.height - 1e-9
  if (widthOk && (!heightOk || Math.abs(fromWidth.height - height) <= Math.abs(fromHeight.width - width))) {
    return fromWidth
  }
  if (heightOk) return fromHeight
  return fromWidth.height >= fromHeight.width ? fromWidth : fromHeight
}

/**
 * Resize the window from a handle. Locked aspect keeps pixel width/height ratio.
 * The opposite corner (or the unmoved edge) stays put when possible.
 */
export function applyCropPointer(input: {
  startRect: NormalizedCropRect
  handle: CropHandle
  startPoint: { x: number; y: number }
  point: { x: number; y: number }
  natural: NaturalImageSize
  pixelAspect: number | null
}): NormalizedCropRect {
  const { startRect, handle, startPoint, point, natural, pixelAspect } = input
  assertNaturalSize(natural)
  const dx = point.x - startPoint.x
  const dy = point.y - startPoint.y

  if (handle === 'move') {
    return translateCrop(startRect, dx, dy)
  }

  let left = startRect.x
  let top = startRect.y
  let right = startRect.x + startRect.width
  let bottom = startRect.y + startRect.height
  const min = minNormalizedCropSize(natural)
  const moveW = handle.includes('w')
  const moveE = handle.includes('e')
  const moveN = handle.includes('n')
  const moveS = handle.includes('s')

  if (moveW) left = startRect.x + dx
  if (moveE) right = startRect.x + startRect.width + dx
  if (moveN) top = startRect.y + dy
  if (moveS) bottom = startRect.y + startRect.height + dy

  if (right < left) [left, right] = [right, left]
  if (bottom < top) [top, bottom] = [bottom, top]

  left = clampEdge(left, 0, 1)
  right = clampEdge(right, 0, 1)
  top = clampEdge(top, 0, 1)
  bottom = clampEdge(bottom, 0, 1)

  let width = Math.max(min.width, right - left)
  let height = Math.max(min.height, bottom - top)

  if (pixelAspect && pixelAspect > 0) {
    const normRatio = (pixelAspect * natural.height) / natural.width
    const fitted = fitLockedSize(width, height, normRatio, min)
    width = fitted.width
    height = fitted.height
  }

  if (moveW && !moveE) left = right - width
  else if (moveE && !moveW) left = startRect.x
  else left = startRect.x + (startRect.width - width) / 2

  if (moveN && !moveS) top = bottom - height
  else if (moveS && !moveN) top = startRect.y
  else top = startRect.y + (startRect.height - height) / 2

  return clampCropRect({ x: left, y: top, width, height }, natural)
}
