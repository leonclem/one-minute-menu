/** @jest-environment node */

jest.mock('sharp', () => jest.fn(() => ({ metadata: jest.fn().mockResolvedValue({ width: 1600, height: 900 }) })))

import fc from 'fast-check'

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  ObjectEditOperationMetadataZ,
  type StructuredEditIntent,
} from '../contracts'
import { buildCandidateCanonicalState } from '../canonical-state'
import type { SpatialElementV1 } from '../spatial-inventory'
import { finalizeStudioGenerationAtomic } from '@/lib/studio/finalize-generation-atomic'

const textArbitrary = fc.stringMatching(/^[a-z]{1,12}$/)
const schemaArbitrary: fc.Arbitrary<MinimalSchema> = fc.record({
  scene_setup: fc.record({
    angle: fc.constantFrom('top-down' as const, '45-degree' as const, 'eye-level' as const, 'macro-close-up' as const),
    framing: fc.constantFrom('close-up' as const, 'medium' as const, 'wide' as const),
    lighting: textArbitrary,
    spin: fc.constantFrom('0' as const, 'left-45' as const, 'right-45' as const),
  }),
  canvas: fc.record({
    background: textArbitrary,
    background_style: textArbitrary,
    surface_style: textArbitrary,
    main_vessel: textArbitrary,
  }),
  food_components: fc.record({
    main_item: textArbitrary,
    garnishes: fc.uniqueArray(textArbitrary, { minLength: 1, maxLength: 4 }),
    sides: fc.uniqueArray(textArbitrary, { minLength: 1, maxLength: 4 }),
  }),
})

const pointArbitrary = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
})

function selectionAt(point: { x: number; y: number }) {
  const strokes = [{ kind: 'tap' as const, points: [point] }]
  return { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
}

function intentFor(operation: 'remove' | 'move', point: { x: number; y: number }): StructuredEditIntent {
  const selection = selectionAt(point)
  return operation === 'remove'
    ? { version: 1, operation, selection }
    : {
        version: 1,
        operation,
        selection,
        placement: { source: deriveSelectionSourcePoint(selection.boundingRegion), destination: point },
      }
}

function mappedElement(schema: MinimalSchema, target: 'main_vessel' | 'main_item' | 'garnishes' | 'sides'): SpatialElementV1 {
  const value = target === 'main_vessel'
    ? schema.canvas.main_vessel
    : target === 'main_item'
      ? schema.food_components.main_item
      : schema.food_components[target][0]
  return {
    id: '11111111-1111-4111-8111-111111111111',
    label: value,
    componentRef: target === 'main_vessel'
      ? { section: 'canvas', field: target, value }
      : { section: 'food_components', field: target, value },
    hint: { kind: 'center', center: { x: 0.5, y: 0.5 } },
    visibility: 'visible',
  }
}

describe('object-edit canonical lineage properties', () => {
  // Feature: studio-object-selection-remove-move, Property 22: Direct-parent canonical lineage and narrow delta
  it('Property 22: initializes only from the supplied direct parent and changes at most one exact Remove field', () => {
    fc.assert(
      fc.property(
        schemaArbitrary,
        schemaArbitrary,
        pointArbitrary,
        fc.constantFrom<'main_vessel' | 'main_item' | 'garnishes' | 'sides'>('main_vessel', 'main_item', 'garnishes', 'sides'),
        (directParent, ancestor, point, target) => {
          const move = buildCandidateCanonicalState({ directParent, intent: intentFor('move', point) })
          const ambiguousRemove = buildCandidateCanonicalState({ directParent, intent: intentFor('remove', point) })
          const removed = buildCandidateCanonicalState({
            directParent,
            intent: intentFor('remove', point),
            matchedElement: mappedElement(directParent, target),
          })

          expect(move).toEqual(directParent)
          expect(move).not.toBe(directParent)
          expect(ambiguousRemove).toEqual(directParent)
          expect(removed.scene_setup).toEqual(directParent.scene_setup)
          expect(removed.canvas.background).toBe(directParent.canvas.background)
          expect(removed.canvas.background_style).toBe(directParent.canvas.background_style)
          expect(removed.canvas.surface_style).toBe(directParent.canvas.surface_style)

          if (target === 'main_vessel') {
            expect(removed.canvas.main_vessel).toBe('')
            expect(removed.food_components).toEqual(directParent.food_components)
          } else if (target === 'main_item') {
            expect(removed.food_components.main_item).toBe('')
            expect(removed.canvas).toEqual(directParent.canvas)
            expect(removed.food_components.garnishes).toEqual(directParent.food_components.garnishes)
            expect(removed.food_components.sides).toEqual(directParent.food_components.sides)
          } else {
            expect(removed.canvas).toEqual(directParent.canvas)
            expect(removed.food_components.main_item).toBe(directParent.food_components.main_item)
            expect(removed.food_components[target]).toEqual(directParent.food_components[target].slice(1))
            expect(removed.food_components[target === 'garnishes' ? 'sides' : 'garnishes']).toEqual(
              directParent.food_components[target === 'garnishes' ? 'sides' : 'garnishes'],
            )
          }

          // The candidate is constructed from the direct parent object, never an ancestor.
          expect(removed).not.toBe(ancestor)
        },
      ),
      { numRuns: 100 },
    )
  })

  // Feature: studio-object-selection-remove-move, Property 23: Child lineage metadata is internally consistent
  it('Property 23: commits source-row lineage and accepted Selection/Move metadata unchanged through the atomic RPC plan', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        pointArbitrary,
        fc.constantFrom('remove' as const, 'move' as const),
        pointArbitrary,
        schemaArbitrary,
        async (dishId, sourceImageId, sourcePoint, operation, destination, canonical) => {
          const selection = selectionAt(sourcePoint)
          const placement = { source: deriveSelectionSourcePoint(selection.boundingRegion), destination }
          const objectEdit = ObjectEditOperationMetadataZ.parse({
            version: 1,
            operation,
            directParentImageId: sourceImageId,
            selectedSourceImageId: sourceImageId,
            selection,
            ...(operation === 'move' ? { placement } : {}),
            annotationRendererVersion: 1,
            contractDigest: 'a'.repeat(64),
          })
          const rpc = jest.fn().mockResolvedValue({
            data: [{
              image_id: '99999999-9999-4999-8999-999999999999',
              image_url: 'https://example.test/child.png',
              dish_id: dishId,
              model: 'nb2',
              balance_after: 8,
            }],
            error: null,
          })
          const client = {
            storage: {
              from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ error: null }),
                remove: jest.fn().mockResolvedValue({ error: null }),
                getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.test/child.png' } }),
              }),
            },
            rpc,
          }
          await finalizeStudioGenerationAtomic({
            userId: '11111111-1111-4111-8111-111111111111',
            dishId,
            sourceImageId,
            imageBase64: 'aW1hZ2U=',
            mimeType: 'image/png',
            prompt: 'object edit',
            requestedModel: 'nb2',
            creditCost: 1,
            canonical,
            objectEdit,
          }, { createClient: () => client, createImageId: () => '99999999-9999-4999-8999-999999999999' })

          const parameters = rpc.mock.calls[0]?.[1] as Record<string, unknown>
          const persisted = parameters.p_metadata as { objectEdit: typeof objectEdit }
          expect(parameters.p_source_image_id).toBe(sourceImageId)
          expect(persisted.objectEdit.directParentImageId).toBe(sourceImageId)
          expect(persisted.objectEdit.selectedSourceImageId).toBe(sourceImageId)
          expect(persisted.objectEdit.selection).toEqual(selection)
          expect(persisted.objectEdit.operation === 'move' ? persisted.objectEdit.placement : undefined).toEqual(
            operation === 'move' ? placement : undefined,
          )
        },
      ),
      { numRuns: 100 },
    )
  })
})
