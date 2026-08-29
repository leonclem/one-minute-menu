/** @jest-environment node */

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { reconcileObjectEditChildState } from '../reconciliation'
import type { SpatialInventoryV1 } from '../spatial-inventory'

const sourceImageId = '11111111-1111-4111-8111-111111111111'
const childImageId = '22222222-2222-4222-8222-222222222222'
const elementId = '33333333-3333-4333-8333-333333333333'

const parent: MinimalSchema = {
  scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'bright-clean', spin: '0' },
  canvas: { background: 'stone', background_style: '', surface_style: '', main_vessel: 'bowl' },
  food_components: { main_item: 'ramen', garnishes: ['scallion'], sides: ['kimchi'] },
}

const inventory = (imageId: string, id = elementId): SpatialInventoryV1 => ({
  version: 1,
  imageId,
  naturalWidth: 100,
  naturalHeight: 100,
  extractedAt: '2026-01-01T00:00:00.000Z',
  extractorVersion: 'test',
  elements: [
    {
      id,
      label: 'scallion',
      componentRef: { section: 'food_components', field: 'garnishes', value: 'scallion' },
      hint: { kind: 'center', center: { x: 0.5, y: 0.5 } },
      visibility: 'visible',
    },
  ],
})

const removeIntent = {
  version: 1 as const,
  operation: 'remove' as const,
  selection: {
    version: 1 as const,
    strokes: [{ kind: 'tap' as const, points: [{ x: 0.5, y: 0.5 }] }],
    boundingRegion: { left: 0.492, top: 0.492, right: 0.508, bottom: 0.508 },
  },
}

const moveIntent = {
  ...removeIntent,
  operation: 'move' as const,
  placement: { source: { x: 0.5, y: 0.5 }, destination: { x: 0.8, y: 0.6 } },
}

describe('object-edit reconciliation', () => {
  it('preserves the narrow Remove delta while reconciling unrelated explicit canonical evidence', () => {
    const current: MinimalSchema = {
      ...parent,
      canvas: { ...parent.canvas, background: 'linen' },
    }
    const result = reconcileObjectEditChildState({
      directParent: parent,
      intent: removeIntent,
      sourceImage: { id: sourceImageId },
      childImage: { id: childImageId, width: 100, height: 100 },
      parentSpatialInventory: inventory(sourceImageId),
      currentEvidence: { canonical: current, spatialInventory: inventory(childImageId, '44444444-4444-4444-8444-444444444444') },
    })

    expect(result.canonical.canvas.background).toBe('linen')
    expect(result.canonical.food_components.garnishes).toEqual([])
    expect(result.spatialInventory?.elements[0]).toMatchObject({ id: elementId, visibility: 'removed' })
  })

  it('moves only one unambiguous inherited spatial element and keeps absent current evidence non-blocking', () => {
    const result = reconcileObjectEditChildState({
      directParent: parent,
      intent: moveIntent,
      sourceImage: { id: sourceImageId },
      childImage: { id: childImageId, width: 100, height: 100 },
      parentSpatialInventory: inventory(sourceImageId),
    })

    expect(result.canonical).toEqual(parent)
    expect(result.spatialInventory?.elements[0].hint).toEqual({
      kind: 'center',
      center: { x: 0.8, y: 0.6 },
    })
  })

  it('treats invalid/stale spatial evidence as absent rather than failing canonical reconciliation', () => {
    const result = reconcileObjectEditChildState({
      directParent: parent,
      intent: moveIntent,
      sourceImage: { id: sourceImageId },
      childImage: { id: childImageId, width: 100, height: 100 },
      parentSpatialInventory: inventory('55555555-5555-4555-8555-555555555555'),
      currentEvidence: { canonical: parent },
    })

    expect(result.canonical).toEqual(parent)
    expect(result.spatialInventory).toBeNull()
    expect(result.matchedParentElement).toBeNull()
  })
})
