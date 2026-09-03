/**
 * @jest-environment node
 */

import sharp from 'sharp'
import { renderWorkbenchCrop } from '../render'

async function solidJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 80, b: 40 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe('renderWorkbenchCrop', () => {
  it('extracts a centred window and keeps JPEG', async () => {
    const source = await solidJpeg(1600, 1600)
    const result = await renderWorkbenchCrop({
      sourceBuffer: source,
      sourceMimeType: 'image/jpeg',
      crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    })
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.width).toBe(800)
    expect(result.height).toBe(800)
    const meta = await sharp(result.buffer).metadata()
    expect(meta.width).toBe(800)
    expect(meta.height).toBe(800)
    expect(meta.format).toBe('jpeg')
  })

  it('extracts a tight window instead of rejecting it', async () => {
    const source = await solidJpeg(1600, 1600)
    const result = await renderWorkbenchCrop({
      sourceBuffer: source,
      sourceMimeType: 'image/jpeg',
      crop: { x: 0, y: 0, width: 0.2, height: 0.2 },
    })
    expect(result.width).toBe(320)
    expect(result.height).toBe(320)
  })
})
