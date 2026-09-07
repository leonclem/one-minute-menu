/**
 * @jest-environment node
 */

import { degradationWarningCopy, degradationWarningForShot } from '../degradation'
import type { StudioImageRecord } from '../types'

function image(
  overrides: Partial<StudioImageRecord> & Pick<StudioImageRecord, 'id' | 'role'>,
): StudioImageRecord {
  return {
    dish_id: 'dish-1',
    user_id: 'user-1',
    storage_path: `${overrides.id}.png`,
    public_url: `https://example.com/${overrides.id}.png`,
    mime_type: 'image/png',
    width: 1024,
    height: 1024,
    prompt: null,
    model: null,
    source_image_id: null,
    metadata: {},
    is_favourite: false,
    archived_at: null,
    created_at: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

const original = image({ id: 'og', role: 'source' })
const gen1 = image({
  id: 'v1',
  role: 'generated',
  source_image_id: 'og',
  created_at: '2026-08-15T01:00:00.000Z',
})
const gen2 = image({
  id: 'v2',
  role: 'generated',
  source_image_id: 'v1',
  created_at: '2026-08-15T02:00:00.000Z',
})
const cropOnGen2 = image({
  id: 'crop',
  role: 'generated',
  source_image_id: 'v2',
  created_at: '2026-08-15T03:00:00.000Z',
  metadata: { mode: 'crop' },
})
const gen3 = image({
  id: 'v3',
  role: 'generated',
  source_image_id: 'crop',
  created_at: '2026-08-15T04:00:00.000Z',
})
const gen4 = image({
  id: 'v4',
  role: 'generated',
  source_image_id: 'v3',
  created_at: '2026-08-15T05:00:00.000Z',
})

const gallery = [original, gen1, gen2, cropOnGen2, gen3, gen4]

describe('degradationWarningCopy', () => {
  it('stays silent until the next hop would be GEN 3', () => {
    expect(degradationWarningCopy(1)).toBeNull()
    expect(degradationWarningCopy(2)).toBeNull()
    expect(degradationWarningCopy(3)?.title).toBe('This next shot will be GEN 3')
  })

  it('strengthens copy at GEN 4 and GEN 5+', () => {
    const three = degradationWarningCopy(3)
    const four = degradationWarningCopy(4)
    const five = degradationWarningCopy(5)
    const six = degradationWarningCopy(6)
    expect(three?.body).toMatch(/soften detail/i)
    expect(four?.title).toBe('This next shot will be GEN 4')
    expect(four?.body).toMatch(/often drops/i)
    expect(four?.body.length ?? 0).toBeGreaterThan(three?.body.length ?? 0)
    expect(five?.title).toBe('This next shot will be GEN 5')
    expect(five?.body).toMatch(/likely to look worse/i)
    expect(five?.body).toMatch(/still generate/i)
    expect(six?.title).toBe('This next shot will be GEN 6')
    expect(six?.body).toBe(five?.body)
  })

  it('keeps the tree CTA on every tier', () => {
    expect(degradationWarningCopy(3)?.cta).toBe('View shot tree')
    expect(degradationWarningCopy(4)?.cta).toBe('View shot tree')
    expect(degradationWarningCopy(5)?.cta).toBe('View shot tree')
  })
})

describe('degradationWarningForShot', () => {
  it('warns when Generate from this shot would become GEN 3, including lossless crops', () => {
    expect(degradationWarningForShot(original, gallery)).toBeNull()
    expect(degradationWarningForShot(gen1, gallery)).toBeNull()
    expect(degradationWarningForShot(gen2, gallery)?.nextGen).toBe(3)
    expect(degradationWarningForShot(cropOnGen2, gallery)?.nextGen).toBe(3)
    expect(degradationWarningForShot(gen3, gallery)?.nextGen).toBe(4)
    expect(degradationWarningForShot(gen4, gallery)?.nextGen).toBe(5)
  })
})
