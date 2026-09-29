import 'server-only'

import sharp from 'sharp'

import type { NormalizedPoint } from './contracts'
import { keepOutlinePoints } from './keep-region'

export class KeepCompositeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KeepCompositeError'
  }
}

/** Soft edge width, in pixels, between the locked interior and the cleared area. */
export function keepFeatherSigma(width: number, height: number): number {
  return Math.max(6, Math.min(28, Math.round(Math.min(width, height) * 0.012)))
}

function polygonPath(points: readonly NormalizedPoint[], width: number, height: number): string {
  const commands = points
    .map((point, index) => {
      const x = (point.x * width).toFixed(2)
      const y = (point.y * height).toFixed(2)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  return `${commands} Z`
}

/**
 * Resizes the generated frame to the source, then paints the original pixels
 * back inside the outline. The edge is feathered so the join is not a hard cut.
 */
export async function compositeKeptRegion(input: {
  sourcePng: Buffer
  generatedBytes: Buffer
  points: readonly NormalizedPoint[]
}): Promise<Buffer> {
  const outline = keepOutlinePoints(input.points)
  if (!outline) throw new KeepCompositeError('Keep this needs an outline around what should stay.')

  const sourceMeta = await sharp(input.sourcePng, { failOn: 'error' }).metadata()
  const width = sourceMeta.width
  const height = sourceMeta.height
  if (!width || !height) throw new KeepCompositeError('Source image has no dimensions.')

  const generated = await sharp(input.generatedBytes, { failOn: 'error' })
    .rotate()
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .png()
    .toBuffer()

  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<path d="${polygonPath(outline, width, height)}" fill="white"/>` +
      `</svg>`,
  )
  const mask = await sharp(maskSvg)
    .resize(width, height)
    .greyscale()
    .blur(keepFeatherSigma(width, height))
    .raw()
    .toBuffer()

  const sourceRgb = await sharp(input.sourcePng, { failOn: 'error' })
    .rotate()
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer()
  const lockedSource = await sharp(sourceRgb, { raw: { width, height, channels: 3 } })
    .joinChannel(mask, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer()

  return sharp(generated)
    .composite([{ input: lockedSource, blend: 'over' }])
    .png()
    .toBuffer()
}
