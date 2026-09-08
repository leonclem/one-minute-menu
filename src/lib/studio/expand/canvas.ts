/**
 * Transparent pad for workbench Expand. Directional layouts keep the source
 * aspect and bias the photo to one side or a corner. Pixel restore stays in the spike.
 */

import sharp from 'sharp'
import { DEFAULT_EXPAND_LAYOUT, type ExpandLayoutId } from './presets'

const MAX_SOURCE_SIDE = 1600

export class StudioExpandCanvasError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status = 400) {
    super(message)
    this.name = 'StudioExpandCanvasError'
    this.code = code
    this.status = status
  }
}

export type EdgePadding = {
  top: number
  right: number
  bottom: number
  left: number
}

export type PaddedCanvas = {
  buffer: Buffer
  width: number
  height: number
  padding: EdgePadding
}

/**
 * Same destination size for every layout: padRatio of width on the horizontal
 * axis total, padRatio of height on the vertical axis total. `all` splits that
 * equally; side layouts put the whole extra on one side; corner layouts put
 * it on two sides so the photo hugs the opposite corner.
 */
export function paddingPixels(
  width: number,
  height: number,
  padRatio: number,
  layout: ExpandLayoutId = DEFAULT_EXPAND_LAYOUT,
): EdgePadding {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new StudioExpandCanvasError('Source dimensions must be positive.', 'EXPAND_INVALID_SOURCE')
  }
  if (!Number.isFinite(padRatio) || padRatio <= 0) {
    throw new StudioExpandCanvasError('padRatio must be a positive number.', 'EXPAND_INVALID_PAD')
  }
  const horizontal = Math.max(1, Math.round(width * padRatio))
  const vertical = Math.max(1, Math.round(height * padRatio))
  switch (layout) {
    case 'left':
      return { top: vertical, right: 0, bottom: vertical, left: 2 * horizontal }
    case 'right':
      return { top: vertical, right: 2 * horizontal, bottom: vertical, left: 0 }
    case 'top':
      return { top: 2 * vertical, right: horizontal, bottom: 0, left: horizontal }
    case 'bottom':
      return { top: 0, right: horizontal, bottom: 2 * vertical, left: horizontal }
    case 'top_left':
      return { top: 2 * vertical, right: 0, bottom: 0, left: 2 * horizontal }
    case 'top_right':
      return { top: 2 * vertical, right: 2 * horizontal, bottom: 0, left: 0 }
    case 'bottom_left':
      return { top: 0, right: 0, bottom: 2 * vertical, left: 2 * horizontal }
    case 'bottom_right':
      return { top: 0, right: 2 * horizontal, bottom: 2 * vertical, left: 0 }
    default:
      return { top: vertical, right: horizontal, bottom: vertical, left: horizontal }
  }
}

export async function prepareExpandSource(sourceBuffer: Buffer): Promise<Buffer> {
  try {
    const oriented = sharp(sourceBuffer).rotate()
    const meta = await oriented.metadata()
    const width = meta.width
    const height = meta.height
    if (!width || !height) {
      throw new StudioExpandCanvasError('Could not read the source image.', 'EXPAND_READ_FAILED')
    }

    const longSide = Math.max(width, height)
    const pipeline =
      longSide > MAX_SOURCE_SIDE
        ? oriented.resize({
            width: width >= height ? MAX_SOURCE_SIDE : undefined,
            height: height > width ? MAX_SOURCE_SIDE : undefined,
            fit: 'inside',
            withoutEnlargement: true,
          })
        : oriented

    return pipeline.ensureAlpha().png().toBuffer()
  } catch (error) {
    if (error instanceof StudioExpandCanvasError) throw error
    throw new StudioExpandCanvasError('Could not read the source image.', 'EXPAND_READ_FAILED')
  }
}

export async function padExpandCanvas(
  sourceBuffer: Buffer,
  padRatio: number,
  layout: ExpandLayoutId = DEFAULT_EXPAND_LAYOUT,
): Promise<PaddedCanvas> {
  const source = await prepareExpandSource(sourceBuffer)
  const meta = await sharp(source).metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) {
    throw new StudioExpandCanvasError('Could not read the source image.', 'EXPAND_READ_FAILED')
  }

  const padding = paddingPixels(width, height, padRatio, layout)
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
  }
}
