/** @jest-environment node */

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { StudioImageRecord } from '@/lib/studio/types'
import {
  buildCandidateCanonicalState,
  CanonicalSourceStateError,
  establishCanonicalSourceState,
} from '../canonical-state'

const schema: MinimalSchema = {
  scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'bright-clean', spin: '0' },
  canvas: { background: 'stone', background_style: '', surface_style: '', main_vessel: 'bowl' },
  food_components: { main_item: 'ramen', garnishes: ['scallion', 'sesame'], sides: ['kimchi'] },
}

const source = (metadata: Record<string, unknown>): StudioImageRecord =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    dish_id: '33333333-3333-4333-8333-333333333333',
    role: 'source', storage_path: 'x', public_url: 'x', mime_type: 'image/png',
    width: 100, height: 100, prompt: null, model: null, metadata, is_favourite: false,
    archived_at: null, created_at: '2026-01-01T00:00:00.000Z',
  }) as StudioImageRecord

describe('canonical source state', () => {
  it('uses a compatible persisted state without hydration', async () => {
    const hydrate = jest.fn()
    const state = await establishCanonicalSourceState(
      source({ editorStateVersion: 1, editorState: { schema, position: { x: 0, y: 0 } } }),
      { hydrate },
    )

    expect(state.hydrated).toBe(false)
    expect(state.schema).toEqual(schema)
    expect(hydrate).not.toHaveBeenCalled()
  })

  it('hydrates a legacy source and persists versioned compatible metadata', async () => {
    const persistMetadata = jest.fn().mockResolvedValue({})
    const state = await establishCanonicalSourceState(source({}), {
      hydrate: async () => ({ schema, position: { x: 0, y: 0 } }),
      persistMetadata,
    })

    expect(state.hydrated).toBe(true)
    expect(persistMetadata).toHaveBeenCalledWith(
      source({}).user_id,
      source({}).id,
      expect.objectContaining({ editorStateVersion: 1, editorState: { schema, position: { x: 0, y: 0 } } }),
    )
  })

  it('rejects before submission when valid canonical state cannot be established', async () => {
    await expect(
      establishCanonicalSourceState(source({}), { hydrate: async () => null }),
    ).rejects.toBeInstanceOf(CanonicalSourceStateError)
  })

  it('uses only the direct parent, keeps Move unchanged, and limits Remove to one exact field', () => {
    const move = buildCandidateCanonicalState({
      directParent: schema,
      intent: { operation: 'move' } as never,
    })
    expect(move).toEqual(schema)
    expect(move).not.toBe(schema)

    const removed = buildCandidateCanonicalState({
      directParent: schema,
      intent: { operation: 'remove' } as never,
      matchedElement: {
        id: '44444444-4444-4444-8444-444444444444',
        label: 'scallion',
        componentRef: { section: 'food_components', field: 'garnishes', value: 'scallion' },
        hint: { kind: 'center', center: { x: 0.5, y: 0.5 } },
        visibility: 'visible',
      },
    })

    expect(removed.food_components.garnishes).toEqual(['sesame'])
    expect(removed.scene_setup).toEqual(schema.scene_setup)
    expect(removed.canvas).toEqual(schema.canvas)
    expect(removed.food_components.main_item).toBe(schema.food_components.main_item)
    expect(removed.food_components.sides).toEqual(schema.food_components.sides)
  })
})
