/** @jest-environment node */

import {
  buildSpatialInventory,
  matchSpatialElement,
  SpatialInventoryV1Z,
} from '../spatial-inventory'

const image = {
  id: '11111111-1111-4111-8111-111111111111',
  width: 1200,
  height: 800,
}

const raw = {
  spatial_inventory: {
    extractorVersion: 'test',
    elements: [
      {
        // Provider IDs are deliberately ignored.
        id: 'provider-id',
        label: 'scallion',
        componentRef: { section: 'food_components', field: 'garnishes', value: 'scallion' },
        hint: { kind: 'region', region: { left: 0.4, top: 0.4, right: 0.6, bottom: 0.6 } },
        visibility: 'visible', confidence: 0.9, evidence: 'visible topping',
      },
    ],
  },
}

describe('spatial inventory', () => {
  it('creates a strict image-bound inventory with app-assigned element IDs', () => {
    const inventory = buildSpatialInventory(image, raw, new Date('2026-01-01T00:00:00.000Z'))
    expect(inventory).not.toBeNull()
    expect(SpatialInventoryV1Z.safeParse(inventory).success).toBe(true)
    expect(inventory?.imageId).toBe(image.id)
    expect(inventory?.elements[0].id).not.toBe('provider-id')
  })

  it('does not build inventory for malformed observations or missing natural dimensions', () => {
    expect(buildSpatialInventory({ ...image, width: null }, raw)).toBeNull()
    expect(buildSpatialInventory(image, { spatial_inventory: { elements: [{}] } })).toBeNull()
  })

  it('matches only a current, clearly overlapping element and treats stale or broad input as non-authoritative', () => {
    const inventory = buildSpatialInventory(image, raw)!
    const matched = matchSpatialElement({
      inventory,
      imageId: image.id,
      selection: { left: 0.42, top: 0.42, right: 0.58, bottom: 0.58 },
    })
    expect(matched.matched).toBe(true)

    expect(
      matchSpatialElement({
        inventory,
        imageId: '22222222-2222-4222-8222-222222222222',
        selection: { left: 0.42, top: 0.42, right: 0.58, bottom: 0.58 },
      }),
    ).toEqual({ matched: false, reason: 'stale' })
    expect(
      matchSpatialElement({
        inventory,
        imageId: image.id,
        selection: { left: 0, top: 0, right: 1, bottom: 1 },
      }),
    ).toEqual({ matched: false, reason: 'ambiguous' })
  })
})
