/** @jest-environment node */

import sharp from 'sharp'

import { KeepCompositeError, compositeKeptRegion } from '../keep-composite'

async function solid(width: number, height: number, rgb: [number, number, number]): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3)
  for (let index = 0; index < pixels.length; index += 3) {
    pixels[index] = rgb[0]
    pixels[index + 1] = rgb[1]
    pixels[index + 2] = rgb[2]
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

describe('compositeKeptRegion', () => {
  it('keeps the original pixels inside the outline and the generated pixels outside it', async () => {
    const width = 120
    const height = 80
    const source = await solid(width, height, [220, 20, 20])
    const generated = await solid(width, height, [20, 20, 220])
    const locked = await compositeKeptRegion({
      sourcePng: source,
      generatedBytes: generated,
      points: [
        { x: 0.05, y: 0.05 },
        { x: 0.55, y: 0.05 },
        { x: 0.55, y: 0.95 },
        { x: 0.05, y: 0.95 },
      ],
    })
    const pixels = await sharp(locked).raw().toBuffer({ resolveWithObject: true })
    const channels = pixels.info.channels
    const at = (x: number, y: number) => {
      const offset = (y * width + x) * channels
      return [pixels.data[offset], pixels.data[offset + 1], pixels.data[offset + 2]]
    }

    const inside = at(18, 40)
    const outside = at(100, 40)
    expect(inside[0]).toBeGreaterThan(180)
    expect(inside[2]).toBeLessThan(80)
    expect(outside[2]).toBeGreaterThan(180)
    expect(outside[0]).toBeLessThan(80)
  })

  it('rejects a stroke that cannot surround a region', async () => {
    const source = await solid(16, 16, [0, 0, 0])
    await expect(
      compositeKeptRegion({
        sourcePng: source,
        generatedBytes: source,
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.4, y: 0.2 },
        ],
      }),
    ).rejects.toBeInstanceOf(KeepCompositeError)
  })
})
