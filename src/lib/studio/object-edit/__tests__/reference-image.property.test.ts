/**
 * @jest-environment node
 */

import fc from 'fast-check'
import sharp from 'sharp'

import {
  ObjectEditImagePreparationError,
  prepareObjectEditImages,
  type PrepareObjectEditImagesInput,
} from '../reference-image'
import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  type AnnotationStroke,
  type StructuredEditIntent,
} from '../contracts'

const pointArbitrary = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
})
const strokeArbitrary = fc.oneof(
  pointArbitrary.map((point) => ({ kind: 'tap' as const, points: [point] })),
  fc.array(pointArbitrary, { minLength: 2, maxLength: 12 }).map((points) => ({ kind: 'path' as const, points })),
)
const sourceSpecArbitrary = fc.record({
  width: fc.integer({ min: 4, max: 48 }),
  height: fc.integer({ min: 4, max: 48 }),
  seed: fc.integer({ min: 0, max: 255 }),
  format: fc.constantFrom('png' as const, 'jpeg' as const, 'webp' as const),
})

async function sourceImage(spec: fc.infer<typeof sourceSpecArbitrary>): Promise<Buffer> {
  const pixels = Buffer.alloc(spec.width * spec.height * 3)
  for (let index = 0; index < pixels.length; index += 1) pixels[index] = (spec.seed + index * 29) % 256
  const image = sharp(pixels, { raw: { width: spec.width, height: spec.height, channels: 3 } })
  if (spec.format === 'jpeg') return image.jpeg({ quality: 90 }).toBuffer()
  if (spec.format === 'webp') return image.webp({ quality: 90 }).toBuffer()
  return image.png().toBuffer()
}

function mimeTypeFor(format: fc.infer<typeof sourceSpecArbitrary>['format']): 'image/png' | 'image/jpeg' | 'image/webp' {
  return format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
}

function selection(strokes: AnnotationStroke[]) {
  return { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
}

function intentFor(operation: 'remove' | 'move', strokes: AnnotationStroke[], destination: { x: number; y: number }): StructuredEditIntent {
  const selected = selection(strokes)
  if (operation === 'remove') return { version: 1, operation, selection: selected }
  return {
    version: 1,
    operation,
    selection: selected,
    placement: { source: deriveSelectionSourcePoint(selected.boundingRegion), destination },
  }
}

describe('object-edit reference image properties', () => {
  it('Property 9: produces deterministic operation-specific image pairs with exact guidance manifests', async () => {
    await fc.assert(
      fc.asyncProperty(
        sourceSpecArbitrary,
        fc.array(strokeArbitrary, { minLength: 1, maxLength: 8 }),
        pointArbitrary,
        async (sourceSpec, strokes: AnnotationStroke[], destination) => {
          const sourceBytes = await sourceImage(sourceSpec)
          const sourceMimeType = mimeTypeFor(sourceSpec.format)
          const removeIntent = intentFor('remove', strokes, destination)
          const moveIntent = intentFor('move', strokes, destination)
          const removeInput = { sourceBytes, sourceMimeType, intent: removeIntent }

          const [first, second, move] = await Promise.all([
            prepareObjectEditImages(removeInput),
            prepareObjectEditImages(removeInput),
            prepareObjectEditImages({ sourceBytes, sourceMimeType, intent: moveIntent }),
          ])
          expect(first).toEqual(second)
          expect(first.clean.data).toBe(move.clean.data)
          expect(first.clean).toMatchObject({ mimeType: 'image/png', width: sourceSpec.width, height: sourceSpec.height })
          expect(first.annotated).toMatchObject({ mimeType: 'image/png', width: sourceSpec.width, height: sourceSpec.height })
          expect(move.annotated).toMatchObject({ mimeType: 'image/png', width: sourceSpec.width, height: sourceSpec.height })
          expect(first.annotated.data).not.toBe(first.clean.data)

          const [cleanMetadata, annotatedMetadata] = await Promise.all([
            sharp(Buffer.from(first.clean.data, 'base64')).metadata(),
            sharp(Buffer.from(first.annotated.data, 'base64')).metadata(),
          ])
          expect(cleanMetadata.width).toBe(annotatedMetadata.width)
          expect(cleanMetadata.height).toBe(annotatedMetadata.height)

          const targetMarkerCount = strokes.filter((stroke) => stroke.kind === 'tap').length
          expect(first.guidance).toEqual({
            selectionStrokeCount: strokes.length,
            targetMarkerCount,
            destinationMarkerCount: 0,
            moveArrowCount: 0,
            hasMovePlacementGuide: false,
            hasTranslatedBoundingGuide: false,
          })
          expect(move.guidance).toEqual({
            selectionStrokeCount: strokes.length,
            targetMarkerCount,
            destinationMarkerCount: 1,
            moveArrowCount: 1,
            hasMovePlacementGuide: false,
            hasTranslatedBoundingGuide: false,
          })
        },
      ),
      { numRuns: 100 },
    )
  })

  it('Property 10: invalid image or operation inputs fail before a pair can continue to submission', async () => {
    const validStrokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x: 0.25, y: 0.75 }] }]
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('empty', 'corrupt', 'mime-mismatch', 'incomplete-selection', 'missing-move-placement'),
        sourceSpecArbitrary,
        async (invalidKind, sourceSpec) => {
          const bytes = await sourceImage({ ...sourceSpec, format: 'png' })
          const validIntent = intentFor('remove', validStrokes, { x: 0.75, y: 0.25 })
          let input: PrepareObjectEditImagesInput
          if (invalidKind === 'empty') {
            input = { sourceBytes: Buffer.alloc(0), sourceMimeType: 'image/png', intent: validIntent }
          } else if (invalidKind === 'corrupt') {
            input = { sourceBytes: Buffer.from('not a decodable image'), sourceMimeType: 'image/png', intent: validIntent }
          } else if (invalidKind === 'mime-mismatch') {
            input = { sourceBytes: bytes, sourceMimeType: 'image/jpeg', intent: validIntent }
          } else if (invalidKind === 'incomplete-selection') {
            input = {
              sourceBytes: bytes,
              sourceMimeType: 'image/png',
              intent: { ...validIntent, selection: { ...validIntent.selection, strokes: [] } } as StructuredEditIntent,
            }
          } else {
            input = {
              sourceBytes: bytes,
              sourceMimeType: 'image/png',
              intent: { ...validIntent, operation: 'move' } as StructuredEditIntent,
            }
          }

          let pairProduced = false
          let submissionCount = 0
          try {
            await prepareObjectEditImages(input)
            pairProduced = true
            submissionCount += 1
          } catch (error) {
            expect(error).toBeInstanceOf(ObjectEditImagePreparationError)
          }
          expect(pairProduced).toBe(false)
          expect(submissionCount).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
