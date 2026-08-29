import fc from 'fast-check'

import { MinimalSchemaZ, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  ObjectEditOperationMetadataZ,
  ObjectEditSubmissionZ,
  type AnnotationStroke,
} from '../contracts'
import { buildObjectEditInstruction } from '../instruction'

const pointArbitrary = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
})
const strokeArbitrary = fc.oneof(
  pointArbitrary.map((point) => ({ kind: 'tap' as const, points: [point] })),
  fc.array(pointArbitrary, { minLength: 2, maxLength: 32 }).map((points) => ({ kind: 'path' as const, points })),
)
const canonical: MinimalSchema = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft daylight', spin: '0' },
  canvas: { background: 'neutral', background_style: '', surface_style: '', main_vessel: 'plate' },
  food_components: { main_item: 'pasta', garnishes: ['basil'], sides: ['bread'] },
}

function selection(strokes: AnnotationStroke[]) {
  return { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
}

describe('object-edit contract properties', () => {
  it('Property 11: strict Remove/Move contracts survive serialize/parse with every accepted coordinate unchanged', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.constantFrom('remove' as const, 'move' as const),
        fc.array(strokeArbitrary, { minLength: 1, maxLength: 8 }),
        pointArbitrary,
        (dishId, sourceImageId, operation, strokes: AnnotationStroke[], destination) => {
          const selected = selection(strokes)
          const editIntent = operation === 'move'
            ? { version: 1 as const, operation, selection: selected, placement: { source: deriveSelectionSourcePoint(selected.boundingRegion), destination } }
            : { version: 1 as const, operation, selection: selected }
          const submission = { dishId, sourceImageId, model: 'gemini-3.1-flash-image-preview', editIntent }
          const parsed = ObjectEditSubmissionZ.parse(submission)
          const roundTripped = ObjectEditSubmissionZ.parse(JSON.parse(JSON.stringify(parsed)))

          expect(roundTripped).toEqual(parsed)
          expect(roundTripped.editIntent.selection.strokes).toEqual(strokes)
          expect(roundTripped.editIntent.selection.boundingRegion).toEqual(selected.boundingRegion)
          if (roundTripped.editIntent.operation === 'move') {
            expect(roundTripped.editIntent.placement.destination).toEqual(destination)
            expect(roundTripped.editIntent.placement.source).toEqual(deriveSelectionSourcePoint(selected.boundingRegion))
          }

          const instruction = buildObjectEditInstruction({ intent: parsed.editIntent, canonical })
          expect(instruction.contract.selection).toEqual(selected)
          expect(MinimalSchemaZ.parse(instruction.contract.canonical?.schema)).toEqual(canonical)
          expect(instruction.contract.canonical?.schema).not.toHaveProperty('selection')
          expect(instruction.contract.canonical?.schema).not.toHaveProperty('placement')

          expect(ObjectEditSubmissionZ.safeParse({ ...submission, unexpected: true }).success).toBe(false)
          const invalidRegion = JSON.parse(JSON.stringify(submission))
          invalidRegion.editIntent.selection.boundingRegion.left = 0.123456789
          expect(ObjectEditSubmissionZ.safeParse(invalidRegion).success).toBe(false)

          const metadata = {
            version: 1,
            operation,
            directParentImageId: sourceImageId,
            selectedSourceImageId: sourceImageId,
            selection: selected,
            ...(operation === 'move' ? { placement: (editIntent as Extract<typeof editIntent, { operation: 'move' }>).placement } : {}),
            annotationRendererVersion: 1,
            contractDigest: 'a'.repeat(64),
          }
          expect(ObjectEditOperationMetadataZ.safeParse(metadata).success).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})
