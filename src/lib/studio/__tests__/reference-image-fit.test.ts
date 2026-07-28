/**
 * @jest-environment node
 */

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn() },
}))

import sharp from 'sharp'

import { logger } from '@/lib/logger'
import { fitReferenceToSubject, type ReferenceImageForFit } from '../reference-image-fit'

const warnSpy = logger.warn as jest.Mock

function noisyPixels(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3)
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = (index * 73 + Math.floor(index / 11) * 29) % 256
  }
  return pixels
}

async function syntheticImage(
  width: number,
  height: number,
  format: 'jpeg' | 'png' = 'png',
): Promise<Buffer> {
  const image = sharp(noisyPixels(width, height), { raw: { width, height, channels: 3 } })
  return format === 'jpeg' ? image.jpeg({ quality: 90 }).toBuffer() : image.png().toBuffer()
}

describe('fitReferenceToSubject', () => {
  beforeEach(() => {
    warnSpy.mockClear()
  })

  it('downscales an oversized reference with its aspect ratio preserved and re-encodes it as PNG', async () => {
    const original = await syntheticImage(200, 100, 'jpeg')
    const ref: ReferenceImageForFit = {
      data: original.toString('base64'),
      mimeType: 'image/jpeg',
      role: 'style',
      comment: 'Synthetic style reference',
    }

    const result = await fitReferenceToSubject({
      ref,
      subjectPixels: 2_500,
      subjectBytes: 2_000,
    })

    expect(result).not.toBeNull()
    expect(result).not.toBe(ref)
    expect(result).toMatchObject({ mimeType: 'image/png', role: 'style', comment: ref.comment })

    const fitted = Buffer.from(result!.data, 'base64')
    const metadata = await sharp(fitted).metadata()
    expect(metadata.width! * metadata.height!).toBeLessThanOrEqual(2_500)
    expect(fitted.length).toBeLessThanOrEqual(2_000)
    expect(metadata.width! / metadata.height!).toBeCloseTo(2, 1)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('passes through a reference already within both subject limits', async () => {
    const image = await syntheticImage(10, 10)
    const ref: ReferenceImageForFit = {
      data: image.toString('base64'),
      mimeType: 'image/png',
      role: 'style',
    }

    const result = await fitReferenceToSubject({
      ref,
      subjectPixels: 1_000,
      subjectBytes: image.length + 1,
    })

    expect(result).toBe(ref)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('rejects and warns when even a one-pixel PNG cannot meet the subject byte limit', async () => {
    const image = await syntheticImage(10, 10)
    const ref: ReferenceImageForFit = {
      data: image.toString('base64'),
      mimeType: 'image/png',
      role: 'style',
    }

    await expect(
      fitReferenceToSubject({ ref, subjectPixels: 1, subjectBytes: 1 }),
    ).resolves.toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Rejected reference image'),
      expect.objectContaining({
        role: 'style',
        subjectPixels: 1,
        subjectBytes: 1,
      }),
    )
  })

  it('never downscales the subject identity anchor', async () => {
    const subject = await syntheticImage(100, 50)
    const ref: ReferenceImageForFit = {
      data: subject.toString('base64'),
      mimeType: 'image/png',
      role: 'dish',
    }

    const result = await fitReferenceToSubject({
      ref,
      subjectPixels: 1,
      subjectBytes: 1,
    })

    expect(result).toBe(ref)
    expect(Buffer.from(result!.data, 'base64')).toEqual(subject)
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
