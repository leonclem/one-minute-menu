/**
 * @jest-environment node
 */

import sharp from 'sharp'
import { padExpandCanvas, paddingPixels, StudioExpandCanvasError } from '../canvas'

async function solidPng(
  width: number,
  height: number,
  background: { r: number; g: number; b: number; alpha?: number },
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: background.r, g: background.g, b: background.b, alpha: background.alpha ?? 1 },
    },
  })
    .png()
    .toBuffer()
}

async function sampleRgba(
  buffer: Buffer,
  x: number,
  y: number,
): Promise<{ r: number; g: number; b: number; a: number }> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const index = (y * info.width + x) * 4
  return { r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] }
}

describe('expand canvas', () => {
  it('pads each axis so the canvas keeps the source aspect', () => {
    expect(paddingPixels(100, 80, 0.2)).toEqual({
      top: 16,
      right: 20,
      bottom: 16,
      left: 20,
    })
    const portrait = paddingPixels(1080, 1440, 0.2)
    expect(portrait).toEqual({ top: 288, right: 216, bottom: 288, left: 216 })
    expect((1080 + portrait.left + portrait.right) / (1440 + portrait.top + portrait.bottom)).toBe(
      1080 / 1440,
    )
  })

  it('rejects a non-positive pad', () => {
    expect(() => paddingPixels(100, 80, 0)).toThrow(StudioExpandCanvasError)
  })

  it('builds a transparent surround around the source', async () => {
    const source = await solidPng(40, 40, { r: 200, g: 20, b: 20 })
    const padded = await padExpandCanvas(source, 0.25)
    expect(padded.width).toBe(60)
    expect(padded.height).toBe(60)

    const original = await sampleRgba(padded.buffer, 20, 20)
    expect(original.r).toBeGreaterThan(150)
    expect(original.a).toBe(255)

    const empty = await sampleRgba(padded.buffer, 2, 2)
    expect(empty.a).toBe(0)
  })
})
