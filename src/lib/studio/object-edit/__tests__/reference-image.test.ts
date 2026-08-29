/**
 * @jest-environment node
 */

import sharp from 'sharp'

import {
  ObjectEditImagePreparationError,
  prepareObjectEditImages,
} from '../reference-image'
import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  type AnnotationStroke,
  type StructuredEditIntent,
} from '../contracts'

async function sourceImage(format: 'png' | 'jpeg' | 'webp' = 'png'): Promise<Buffer> {
  const pixels = Buffer.alloc(80 * 40 * 3)
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = (index * 17) % 256
  const image = sharp(pixels, { raw: { width: 80, height: 40, channels: 3 } })
  if (format === 'jpeg') return image.jpeg({ quality: 90 }).toBuffer()
  if (format === 'webp') return image.webp({ quality: 90 }).toBuffer()
  return image.png().toBuffer()
}

function selection(strokes: AnnotationStroke[]) {
  return { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
}

function removeIntent(): StructuredEditIntent {
  return {
    version: 1,
    operation: 'remove',
    selection: selection([
      { kind: 'tap', points: [{ x: 0.25, y: 0.5 }] },
      { kind: 'path', points: [{ x: 0.5, y: 0.2 }, { x: 0.75, y: 0.7 }] },
    ]),
  }
}

function moveIntent(): StructuredEditIntent {
  const selected = selection([{ kind: 'tap', points: [{ x: 0.25, y: 0.5 }] }])
  return {
    version: 1,
    operation: 'move',
    selection: selected,
    placement: {
      source: deriveSelectionSourcePoint(selected.boundingRegion),
      destination: { x: 0.75, y: 0.5 },
    },
  }
}

describe('prepareObjectEditImages', () => {
  it('deterministically produces a same-sized clean Image A and annotated Image B', async () => {
    const bytes = await sourceImage()
    const input = { sourceBytes: bytes, sourceMimeType: 'image/png' as const, intent: removeIntent() }

    const first = await prepareObjectEditImages(input)
    const second = await prepareObjectEditImages(input)

    expect(first).toEqual(second)
    expect(first.clean).toMatchObject({ mimeType: 'image/png', width: 80, height: 40 })
    expect(first.annotated).toMatchObject({ mimeType: 'image/png', width: 80, height: 40 })
    expect(first.clean.data).not.toBe(first.annotated.data)
    expect(first.renderDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(await sharp(Buffer.from(first.clean.data, 'base64')).metadata()).toMatchObject({ width: 80, height: 40 })
    expect(await sharp(Buffer.from(first.annotated.data, 'base64')).metadata()).toMatchObject({ width: 80, height: 40 })
  })

  it('keeps Image A invariant across operations and exposes only operation-allowed guidance', async () => {
    const bytes = await sourceImage('jpeg')
    const remove = await prepareObjectEditImages({
      sourceBytes: bytes,
      sourceMimeType: 'image/jpeg',
      intent: removeIntent(),
    })
    const move = await prepareObjectEditImages({
      sourceBytes: bytes,
      sourceMimeType: 'image/jpeg',
      intent: moveIntent(),
    })

    expect(remove.clean.data).toBe(move.clean.data)
    expect(remove.guidance).toEqual({
      selectionStrokeCount: 2,
      targetMarkerCount: 1,
      destinationMarkerCount: 0,
      moveArrowCount: 0,
      hasMovePlacementGuide: false,
      hasTranslatedBoundingGuide: false,
    })
    expect(move.guidance).toEqual({
      selectionStrokeCount: 1,
      targetMarkerCount: 1,
      destinationMarkerCount: 1,
      moveArrowCount: 1,
      hasMovePlacementGuide: false,
      hasTranslatedBoundingGuide: false,
    })
  })

  it('supports each server-accepted image MIME type', async () => {
    await expect(
      prepareObjectEditImages({
        sourceBytes: await sourceImage('webp'),
        sourceMimeType: 'image/webp',
        intent: removeIntent(),
      }),
    ).resolves.toMatchObject({ clean: { mimeType: 'image/png' }, annotated: { mimeType: 'image/png' } })
  })

  it('rejects empty, corrupt, mismatched-MIME, and invalid operation guidance without a partial pair', async () => {
    await expect(
      prepareObjectEditImages({
        sourceBytes: Buffer.alloc(0),
        sourceMimeType: 'image/png',
        intent: removeIntent(),
      }),
    ).rejects.toBeInstanceOf(ObjectEditImagePreparationError)
    await expect(
      prepareObjectEditImages({
        sourceBytes: Buffer.from('not an image'),
        sourceMimeType: 'image/png',
        intent: removeIntent(),
      }),
    ).rejects.toBeInstanceOf(ObjectEditImagePreparationError)
    await expect(
      prepareObjectEditImages({
        sourceBytes: await sourceImage(),
        sourceMimeType: 'image/jpeg',
        intent: removeIntent(),
      }),
    ).rejects.toBeInstanceOf(ObjectEditImagePreparationError)

    const invalid = removeIntent() as StructuredEditIntent & { selection: { strokes: [] } }
    invalid.selection.strokes = []
    await expect(
      prepareObjectEditImages({
        sourceBytes: await sourceImage(),
        sourceMimeType: 'image/png',
        intent: invalid as StructuredEditIntent,
      }),
    ).rejects.toBeInstanceOf(ObjectEditImagePreparationError)
  })
})
