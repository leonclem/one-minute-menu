/**
 * @jest-environment node
 */

import { createHash } from 'crypto'

import fc from 'fast-check'
import sharp from 'sharp'

import { deriveSelectionBoundingRegion, deriveSelectionSourcePoint, type AnnotationStroke } from '../contracts'
import { serializeObjectEditValue } from '../reference-image'
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import {
  assertComparisonGroupInvariants,
  constructSpikeComparisonGroup,
} from '../../../../../scripts/studio-object-edit-spike/construction'

const canonical = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft daylight', spin: '0' },
  canvas: { background: 'neutral', background_style: '', surface_style: '', main_vessel: 'plate' },
  food_components: { main_item: 'pasta', garnishes: ['basil'], sides: ['bread'] },
} as const

async function sourceBytes(seed: number): Promise<Buffer> {
  const data = Buffer.from(Array.from({ length: 4 * 4 * 3 }, (_, index) => (seed + index * 17) % 256))
  return sharp(data, { raw: { width: 4, height: 4, channels: 3 } }).png().toBuffer()
}

describe('controlled spike comparison properties', () => {
  it('Property 17: A/B/C requests retain all fixed inputs and differ only by canonical/spatial enrichment', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('remove' as const, 'move' as const),
        fc.constantFrom('nb2' as const, 'nb_pro' as const),
        fc.integer({ min: 0, max: 255 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        async (operation, requestedModelClass, seed, x, y) => {
          const bytes = await sourceBytes(seed)
          const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [{ x, y }] }]
          const selection = { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
          const configuredModelIdentifier = requestedModelClass === 'nb_pro' ? STUDIO_PRO_MODEL : STUDIO_FLASH_MODEL
          const scenarioCase = {
            id: 'case-property-17',
            operation,
            requestedModelClass,
            configuredModelIdentifier,
            sourceArtifact: { storagePath: 'spike/source.png', mimeType: 'image/png', sha256: createHash('sha256').update(bytes).digest('hex') },
            selection,
            ...(operation === 'move' ? { placement: { source: deriveSelectionSourcePoint(selection.boundingRegion), destination: { x: 1 - x, y: 1 - y } } } : {}),
            scenarioTags: ['isolated_foreground' as const],
          }
          const group = await constructSpikeComparisonGroup({
            scenarioCase,
            sourceBytes: bytes,
            sourceMimeType: 'image/png',
            canonical,
            currentSpatialInventory: { version: 1, imageId: 'current-source', elements: [] },
          })
          const [a, b, c] = group.requests
          expect(() => assertComparisonGroupInvariants(group.requests)).not.toThrow()
          expect([a.variant, b.variant, c.variant]).toEqual(['A', 'B', 'C'])
          expect(a.contract.canonical).toBeUndefined()
          expect(a.contract.spatial).toBeUndefined()
          expect(b.contract.canonical).toBeDefined()
          expect(b.contract.spatial).toBeUndefined()
          expect(c.contract.canonical).toEqual(b.contract.canonical)
          expect(c.contract.spatial).toEqual({ version: 1, imageId: 'current-source', elements: [] })
          expect(new Set(group.requests.map((request) => request.fixedContractDigest)).size).toBe(1)
          expect(new Set(group.requests.map((request) => request.sourceDigest)).size).toBe(1)
          expect(new Set(group.requests.map((request) => request.annotatedDigest)).size).toBe(1)
          expect(new Set(group.requests.map((request) => request.mutationInput.sourceImageBase64)).size).toBe(1)
          expect(new Set(group.requests.map((request) => request.mutationInput.annotationReference.data)).size).toBe(1)
          const { canonical: aCanonical, spatial: aSpatial, ...aInvariant } = a.contract
          const { canonical: bCanonical, spatial: bSpatial, ...bInvariant } = b.contract
          expect(aCanonical).toBeUndefined()
          expect(aSpatial).toBeUndefined()
          expect(bCanonical).toBeDefined()
          expect(bSpatial).toBeUndefined()
          expect(serializeObjectEditValue(aInvariant)).toEqual(serializeObjectEditValue(bInvariant))
          expect(() => assertComparisonGroupInvariants([{ ...a, operation: operation === 'move' ? 'remove' : 'move' }, b, c])).toThrow()
        },
      ),
      { numRuns: 100 },
    )
  })
})
