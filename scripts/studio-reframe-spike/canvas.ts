/**
 * Isolated Reframe spike compositing. Not used by Studio production paths.
 */

import sharp from 'sharp'

export type ExpandLayout = 'all' | 'right' | 'left' | 'top' | 'bottom'

export const EXPAND_LAYOUTS: readonly ExpandLayout[] = [
  'all',
  'right',
  'left',
  'top',
  'bottom',
]

export type EdgePadding = {
  top: number
  right: number
  bottom: number
  left: number
}

export type SourceRect = {
  left: number
  top: number
  width: number
  height: number
}

export type PaddedCanvas = {
  buffer: Buffer
  width: number
  height: number
  padding: EdgePadding
  sourceRect: SourceRect
}

export function isExpandLayout(value: string): value is ExpandLayout {
  return (EXPAND_LAYOUTS as readonly string[]).includes(value)
}

/**
 * Padding in pixels.
 *
 * `all` scales each axis: padRatio of width left/right, padRatio of height
 * top/bottom, so the canvas keeps the source aspect ratio (phone zoom-out).
 * One-sided layouts still use a band based on the shorter side.
 */
export function paddingPixels(
  width: number,
  height: number,
  layout: ExpandLayout,
  padRatio: number,
): EdgePadding {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Source dimensions must be positive.')
  }
  if (!Number.isFinite(padRatio) || padRatio <= 0) {
    throw new Error('padRatio must be a positive number.')
  }
  const horizontal = Math.max(1, Math.round(width * padRatio))
  const vertical = Math.max(1, Math.round(height * padRatio))
  const shortSide = Math.max(1, Math.round(Math.min(width, height) * padRatio))
  switch (layout) {
    case 'all':
      return { top: vertical, right: horizontal, bottom: vertical, left: horizontal }
    case 'right':
      return { top: 0, right: shortSide, bottom: 0, left: 0 }
    case 'left':
      return { top: 0, right: 0, bottom: 0, left: shortSide }
    case 'top':
      return { top: shortSide, right: 0, bottom: 0, left: 0 }
    case 'bottom':
      return { top: 0, right: 0, bottom: shortSide, left: 0 }
  }
}

export function sourceRectAfterPadding(
  sourceWidth: number,
  sourceHeight: number,
  padding: EdgePadding,
): SourceRect {
  return {
    left: padding.left,
    top: padding.top,
    width: sourceWidth,
    height: sourceHeight,
  }
}

/** Inset in pixels from a fraction of the shorter source side. */
export function insetPixels(width: number, height: number, insetRatio: number): number {
  if (!Number.isFinite(insetRatio) || insetRatio < 0) {
    throw new Error('insetRatio must be zero or a positive number.')
  }
  if (insetRatio === 0) return 0
  return Math.max(1, Math.round(Math.min(width, height) * insetRatio))
}

/**
 * Restore only the interior. Inset only on sides that have padding, so Gemini
 * keeps a band at the old frame edge to continue cut objects.
 */
export function restoreRectAfterInset(
  sourceRect: SourceRect,
  padding: EdgePadding,
  insetPx: number,
): SourceRect {
  const inset = Math.max(0, Math.round(insetPx))
  const maxX = Math.max(0, Math.floor(sourceRect.width * 0.25))
  const maxY = Math.max(0, Math.floor(sourceRect.height * 0.25))
  const left = padding.left > 0 ? Math.min(inset, maxX) : 0
  const right = padding.right > 0 ? Math.min(inset, maxX) : 0
  const top = padding.top > 0 ? Math.min(inset, maxY) : 0
  const bottom = padding.bottom > 0 ? Math.min(inset, maxY) : 0
  return {
    left: sourceRect.left + left,
    top: sourceRect.top + top,
    width: sourceRect.width - left - right,
    height: sourceRect.height - top - bottom,
  }
}

export function sourceCropForRestore(
  sourceRect: SourceRect,
  restoreRect: SourceRect,
): { left: number; top: number; width: number; height: number } {
  const left = restoreRect.left - sourceRect.left
  const top = restoreRect.top - sourceRect.top
  if (
    left < 0 ||
    top < 0 ||
    restoreRect.width < 1 ||
    restoreRect.height < 1 ||
    left + restoreRect.width > sourceRect.width ||
    top + restoreRect.height > sourceRect.height
  ) {
    throw new Error('Restore rectangle must sit inside the source rectangle.')
  }
  return { left, top, width: restoreRect.width, height: restoreRect.height }
}

/**
 * Place the source on a larger PNG canvas. New area is transparent so the model
 * can treat it as empty scene to fill.
 */
export async function padCanvas(
  sourceBuffer: Buffer,
  padding: EdgePadding,
): Promise<PaddedCanvas> {
  const source = await sharp(sourceBuffer).rotate().ensureAlpha().png().toBuffer()
  const meta = await sharp(source).metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) throw new Error('Could not read source image dimensions.')

  const buffer = await sharp(source)
    .extend({
      ...padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const paddedMeta = await sharp(buffer).metadata()
  return {
    buffer,
    width: paddedMeta.width ?? width + padding.left + padding.right,
    height: paddedMeta.height ?? height + padding.top + padding.bottom,
    padding,
    sourceRect: sourceRectAfterPadding(width, height, padding),
  }
}

/** Debug overlay. Red = original frame. Teal = pixels we paste back. Never sent to Gemini. */
export async function paintSourceBoundsOverlay(
  paddedPng: Buffer,
  sourceRect: SourceRect,
  restoreRect?: SourceRect,
): Promise<Buffer> {
  const meta = await sharp(paddedPng).metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) throw new Error('Could not read padded canvas dimensions.')

  const sourceBox =
    `<rect x="${sourceRect.left + 2}" y="${sourceRect.top + 2}" ` +
    `width="${Math.max(1, sourceRect.width - 4)}" height="${Math.max(1, sourceRect.height - 4)}" ` +
    `fill="none" stroke="#e11d48" stroke-width="4"/>`
  const restoreBox = restoreRect
    ? `<rect x="${restoreRect.left + 2}" y="${restoreRect.top + 2}" ` +
      `width="${Math.max(1, restoreRect.width - 4)}" height="${Math.max(1, restoreRect.height - 4)}" ` +
      `fill="none" stroke="#0d9488" stroke-width="3"/>`
    : ''

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      sourceBox +
      restoreBox +
      `</svg>`,
  )

  return sharp(paddedPng).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer()
}

/**
 * Scale Gemini's output onto the padded canvas, then paste the original photo
 * back at the known rectangle. Optional inward feather on the source edge.
 */
export async function restoreSourcePixels(input: {
  generated: Buffer
  source: Buffer
  paddedWidth: number
  paddedHeight: number
  sourceRect: SourceRect
  /** Sub-rectangle to paste. Defaults to the full source rectangle. */
  restoreRect?: SourceRect
  featherPx?: number
}): Promise<Buffer> {
  const restoreRect = input.restoreRect ?? input.sourceRect
  const crop = sourceCropForRestore(input.sourceRect, restoreRect)

  const canvas = await sharp(input.generated)
    .resize(input.paddedWidth, input.paddedHeight, { fit: 'fill' })
    .ensureAlpha()
    .png()
    .toBuffer()

  const sourcePng = await sharp(input.source).rotate().ensureAlpha().png().toBuffer()
  let patch = await sharp(sourcePng).extract(crop).png().toBuffer()
  if (input.featherPx && input.featherPx > 0) {
    patch = await applyInwardFeather(patch, input.featherPx)
  }

  const fitted = await sharp(patch)
    .resize(restoreRect.width, restoreRect.height, { fit: 'fill' })
    .png()
    .toBuffer()

  return sharp(canvas)
    .composite([
      {
        input: fitted,
        left: restoreRect.left,
        top: restoreRect.top,
      },
    ])
    .png()
    .toBuffer()
}

/** Fade source alpha to 0 over `featherPx` pixels from each edge. */
export async function applyInwardFeather(sourcePng: Buffer, featherPx: number): Promise<Buffer> {
  const feather = Math.max(1, Math.round(featherPx))
  const meta = await sharp(sourcePng).ensureAlpha().metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) throw new Error('Could not read source dimensions for feathering.')

  const raw = await sharp(sourcePng).ensureAlpha().raw().toBuffer()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dist = Math.min(x, y, width - 1 - x, height - 1 - y)
      const fade = dist >= feather ? 1 : dist / feather
      const alphaIndex = (y * width + x) * 4 + 3
      raw[alphaIndex] = Math.round(raw[alphaIndex] * fade)
    }
  }

  return sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()
}
