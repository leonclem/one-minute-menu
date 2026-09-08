/**
 * @jest-environment node
 */

import sharp from 'sharp'
import {
  applyInwardFeather,
  padCanvas,
  paddingPixels,
  restoreRectAfterInset,
  restoreSourcePixels,
  sourceRectAfterPadding,
} from './canvas'

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

describe('reframe spike canvas', () => {
  it('pads only the requested side', () => {
    expect(paddingPixels(100, 80, 'right', 0.2)).toEqual({
      top: 0,
      right: 16,
      bottom: 0,
      left: 0,
    })
    expect(paddingPixels(100, 80, 'all', 0.2)).toEqual({
      top: 16,
      right: 20,
      bottom: 16,
      left: 20,
    })
    const portrait = paddingPixels(1080, 1440, 'all', 0.2)
    expect(portrait).toEqual({ top: 288, right: 216, bottom: 288, left: 216 })
    expect((1080 + portrait.left + portrait.right) / (1440 + portrait.top + portrait.bottom)).toBe(
      1080 / 1440,
    )
    expect(sourceRectAfterPadding(100, 80, paddingPixels(100, 80, 'right', 0.2))).toEqual({
      left: 0,
      top: 0,
      width: 100,
      height: 80,
    })
  })

  it('builds a transparent surround and keeps the source rectangle', async () => {
    const source = await solidPng(40, 40, { r: 200, g: 20, b: 20 })
    const padded = await padCanvas(source, { top: 0, right: 20, bottom: 0, left: 0 })
    expect(padded.width).toBe(60)
    expect(padded.height).toBe(40)
    expect(padded.sourceRect).toEqual({ left: 0, top: 0, width: 40, height: 40 })

    const original = await sampleRgba(padded.buffer, 10, 10)
    expect(original.r).toBeGreaterThan(150)
    expect(original.a).toBe(255)

    const empty = await sampleRgba(padded.buffer, 50, 10)
    expect(empty.a).toBe(0)
  })

  it('insets restore only on sides that were padded', () => {
    const source = sourceRectAfterPadding(100, 80, { top: 0, right: 16, bottom: 0, left: 0 })
    expect(restoreRectAfterInset(source, { top: 0, right: 16, bottom: 0, left: 0 }, 8)).toEqual({
      left: 0,
      top: 0,
      width: 92,
      height: 80,
    })
    expect(
      restoreRectAfterInset(
        sourceRectAfterPadding(100, 80, { top: 16, right: 16, bottom: 16, left: 16 }),
        { top: 16, right: 16, bottom: 16, left: 16 },
        8,
      ),
    ).toEqual({
      left: 24,
      top: 24,
      width: 84,
      height: 64,
    })
  })

  it('hard-restores original pixels over a generated canvas', async () => {
    const source = await solidPng(40, 40, { r: 200, g: 20, b: 20 })
    const generated = await solidPng(60, 40, { r: 20, g: 180, b: 40 })
    const restored = await restoreSourcePixels({
      generated,
      source,
      paddedWidth: 60,
      paddedHeight: 40,
      sourceRect: { left: 0, top: 0, width: 40, height: 40 },
    })

    const inside = await sampleRgba(restored, 10, 10)
    expect(inside.r).toBeGreaterThan(150)
    expect(inside.g).toBeLessThan(50)

    const outside = await sampleRgba(restored, 50, 10)
    expect(outside.g).toBeGreaterThan(120)
    expect(outside.r).toBeLessThan(50)
  })

  it('leaves a generated band when restoring an inset rectangle', async () => {
    const source = await solidPng(40, 40, { r: 200, g: 20, b: 20 })
    const generated = await solidPng(60, 40, { r: 20, g: 180, b: 40 })
    const restored = await restoreSourcePixels({
      generated,
      source,
      paddedWidth: 60,
      paddedHeight: 40,
      sourceRect: { left: 0, top: 0, width: 40, height: 40 },
      restoreRect: { left: 0, top: 0, width: 32, height: 40 },
    })

    const interior = await sampleRgba(restored, 10, 10)
    expect(interior.r).toBeGreaterThan(150)

    const band = await sampleRgba(restored, 36, 10)
    expect(band.g).toBeGreaterThan(120)
    expect(band.r).toBeLessThan(50)
  })

  it('feathers source-edge alpha inward', async () => {
    const source = await solidPng(40, 40, { r: 10, g: 10, b: 200 })
    const feathered = await applyInwardFeather(source, 4)
    const edge = await sampleRgba(feathered, 0, 20)
    const inner = await sampleRgba(feathered, 20, 20)
    expect(edge.a).toBe(0)
    expect(inner.a).toBe(255)
  })
})
