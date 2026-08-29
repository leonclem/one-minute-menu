import fc from 'fast-check'

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  deriveSelectionBoundingRegion,
  deriveSelectionSourcePoint,
  type StructuredEditIntent,
} from '../contracts'
import { reconcileObjectEditChildState } from '../reconciliation'
import { buildSpatialInventory, SpatialInventoryV1Z, type SpatialInventoryV1 } from '../spatial-inventory'
import {
  extractStudioOutputEvidence,
  reuseOrExtractStudioOutputEvidence,
  type ExtractStudioOutputEvidenceInput,
} from '@/lib/studio/output-validation'

const sourceImageId = '11111111-1111-4111-8111-111111111111'
const childImageId = '22222222-2222-4222-8222-222222222222'
const elementId = '33333333-3333-4333-8333-333333333333'

const schemaArbitrary: fc.Arbitrary<MinimalSchema> = fc.record({
  scene_setup: fc.record({
    angle: fc.constantFrom('top-down' as const, '45-degree' as const, 'eye-level' as const, 'macro-close-up' as const),
    framing: fc.constantFrom('close-up' as const, 'medium' as const, 'wide' as const),
    lighting: fc.stringMatching(/^[a-z]{1,12}$/),
    spin: fc.constantFrom('0' as const, 'left-45' as const, 'right-45' as const),
  }),
  canvas: fc.record({
    background: fc.stringMatching(/^[a-z]{1,12}$/),
    background_style: fc.stringMatching(/^[a-z]{0,12}$/),
    surface_style: fc.stringMatching(/^[a-z]{0,12}$/),
    main_vessel: fc.stringMatching(/^[a-z]{1,12}$/),
  }),
  food_components: fc.record({
    main_item: fc.stringMatching(/^[a-z]{1,12}$/),
    garnishes: fc.uniqueArray(fc.stringMatching(/^[a-z]{1,12}$/), { maxLength: 4 }),
    sides: fc.uniqueArray(fc.stringMatching(/^[a-z]{1,12}$/), { maxLength: 4 }),
  }),
})

const pointArbitrary = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
})

function moveIntent(destination: { x: number; y: number }): StructuredEditIntent {
  const strokes = [{ kind: 'tap' as const, points: [{ x: 0.5, y: 0.5 }] }]
  const selection = { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
  return {
    version: 1,
    operation: 'move',
    selection,
    placement: { source: deriveSelectionSourcePoint(selection.boundingRegion), destination },
  }
}

function removeIntent(): StructuredEditIntent {
  const strokes = [{ kind: 'tap' as const, points: [{ x: 0.5, y: 0.5 }] }]
  return {
    version: 1,
    operation: 'remove',
    selection: { version: 1, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) },
  }
}

function inventory(imageId: string, elements: SpatialInventoryV1['elements']): SpatialInventoryV1 {
  return {
    version: 1,
    imageId,
    naturalWidth: 1200,
    naturalHeight: 800,
    extractedAt: '2026-01-01T00:00:00.000Z',
    extractorVersion: 'test',
    elements,
  }
}

function centerElement(id: string, label = 'garnish', x = 0.5, y = 0.5): SpatialInventoryV1['elements'][number] {
  return {
    id,
    label,
    componentRef: { section: 'food_components', field: 'garnishes', value: label },
    hint: { kind: 'center', center: { x, y } },
    visibility: 'visible',
  }
}

const canonicalRaw: MinimalSchema = {
  scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'studio', spin: '0' },
  canvas: { background: 'linen', background_style: '', surface_style: '', main_vessel: 'bowl' },
  food_components: { main_item: 'pasta', garnishes: ['garnish'], sides: ['bread'] },
}

describe('object-edit spatial and reconciliation properties', () => {
  // Feature: studio-object-selection-remove-move, Property 24: Spatial inventory is separate and image-bound
  it('Property 24: keeps canonical state independent while accepted inventories remain image-bound with app-assigned unique IDs', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.integer({ min: 1, max: 10_000 }), fc.integer({ min: 1, max: 10_000 }), schemaArbitrary, (imageId, width, height, canonical) => {
        const built = buildSpatialInventory(
          { id: imageId, width, height },
          {
            spatial_inventory: {
              extractorVersion: 'property-test',
              elements: [{ id: 'provider-controlled-id', label: 'garnish', hint: { kind: 'center', center: { x: 0.5, y: 0.5 } }, visibility: 'visible' }],
            },
          },
          new Date('2026-01-01T00:00:00.000Z'),
        )
        expect(SpatialInventoryV1Z.safeParse(built).success).toBe(true)
        expect(built?.imageId).toBe(imageId)
        expect(built?.naturalWidth).toBe(width)
        expect(built?.naturalHeight).toBe(height)
        expect(built?.elements[0].id).not.toBe('provider-controlled-id')
        expect(new Set(built?.elements.map((element) => element.id)).size).toBe(built?.elements.length)

        const result = reconcileObjectEditChildState({
          directParent: canonical,
          intent: moveIntent({ x: 0.8, y: 0.6 }),
          sourceImage: { id: sourceImageId },
          childImage: { id: childImageId, width: 1200, height: 800 },
          parentSpatialInventory: null,
        })
        expect(result.canonical).toEqual(canonical)
        expect(buildSpatialInventory({ id: imageId, width: null, height }, {})).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  // Feature: studio-object-selection-remove-move, Property 25: Spatial fallback and signal priority
  it('Property 25: treats missing, stale, ambiguous, and conflicting spatial data as non-blocking fallback evidence', () => {
    fc.assert(
      fc.property(schemaArbitrary, pointArbitrary, (canonical, destination) => {
        const intent = moveIntent(destination)
        const baseline = reconcileObjectEditChildState({
          directParent: canonical,
          intent,
          sourceImage: { id: sourceImageId },
          childImage: { id: childImageId, width: 1200, height: 800 },
        })
        const stale = inventory('44444444-4444-4444-8444-444444444444', [centerElement(elementId)])
        const ambiguous = inventory(sourceImageId, [
          centerElement(elementId),
          centerElement('55555555-5555-4555-8555-555555555555'),
        ])
        const conflictingCurrent = inventory(childImageId, [centerElement('66666666-6666-4666-8666-666666666666', 'different')])

        for (const parentSpatialInventory of [null, stale, ambiguous]) {
          const result = reconcileObjectEditChildState({
            directParent: canonical,
            intent,
            sourceImage: { id: sourceImageId },
            childImage: { id: childImageId, width: 1200, height: 800 },
            parentSpatialInventory,
            currentEvidence: { spatialInventory: conflictingCurrent },
          })
          expect(result.canonical).toEqual(baseline.canonical)
          expect(result.matchedParentElement).toBeNull()
        }
      }),
      { numRuns: 100 },
    )
  })

  // Feature: studio-object-selection-remove-move, Property 26: Reconciliation is evidence-conservative
  it('Property 26: preserves direct-parent fallback for invalid evidence and changes at most one controlled spatial element', () => {
    fc.assert(
      fc.property(schemaArbitrary, pointArbitrary, (canonical, destination) => {
        const parentInventory = inventory(sourceImageId, [
          centerElement(elementId),
          centerElement('77777777-7777-4777-8777-777777777777', 'other', 0.1, 0.1),
        ])
        const invalidEvidence = reconcileObjectEditChildState({
          directParent: canonical,
          intent: moveIntent(destination),
          sourceImage: { id: sourceImageId },
          childImage: { id: childImageId, width: 1200, height: 800 },
          parentSpatialInventory: parentInventory,
          currentEvidence: { canonical: { invalid: true } as unknown as MinimalSchema },
        })
        expect(invalidEvidence.canonical).toEqual(canonical)

        const remove = reconcileObjectEditChildState({
          directParent: { ...canonical, food_components: { ...canonical.food_components, garnishes: ['garnish'] } },
          intent: removeIntent(),
          sourceImage: { id: sourceImageId },
          childImage: { id: childImageId, width: 1200, height: 800 },
          parentSpatialInventory: parentInventory,
        })
        const changed = remove.spatialInventory?.elements.filter((element) => element.visibility === 'removed') ?? []
        expect(changed).toHaveLength(1)
        expect(changed[0]?.id).toBe(elementId)
        expect(remove.spatialInventory?.elements.find((element) => element.id === '77777777-7777-4777-8777-777777777777')).toEqual(
          parentInventory.elements[1],
        )
      }),
      { numRuns: 100 },
    )
  })

  // Feature: studio-object-selection-remove-move, Property 27: Compatible extraction reuse is idempotent
  it('Property 27: reuses compatible evidence byte-for-byte and schedules no extra extraction', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (contents) => {
        const input: ExtractStudioOutputEvidenceInput = {
          imageBase64: Buffer.from(contents).toString('base64'),
          mimeType: 'image/png',
        }
        const extract = jest.fn().mockResolvedValue({ raw: canonicalRaw })
        const first = await extractStudioOutputEvidence(input, { extract })
        const reused = await reuseOrExtractStudioOutputEvidence(input, first, { extract })
        const fresh = await extractStudioOutputEvidence(input, { extract })

        expect(reused).toBe(first)
        expect(reused).toEqual(fresh)
        expect(extract).toHaveBeenCalledTimes(2)
      }),
      { numRuns: 100 },
    )
  })
})
