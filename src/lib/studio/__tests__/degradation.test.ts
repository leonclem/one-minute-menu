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
    expect(degradationWarningCopy(3)?.line).toBe('Edited twice. Another edit can soften fine detail.')
    expect(degradationWarningCopy(3)?.tone).toBe('muted')
  })

  it('strengthens copy at GEN 4 and GEN 5+', () => {
    const four = degradationWarningCopy(4)
    const five = degradationWarningCopy(5)
    const six = degradationWarningCopy(6)
    expect(four?.line).toBe('Edited 3 times. Another edit often looks softer.')
    expect(four?.tone).toBe('warm')
    expect(five?.line).toBe('Edited 4 times. Another edit is likely to look softer.')
    expect(five?.tone).toBe('gold')
    expect(six?.line).toBe('Edited 5 times. Another edit is likely to look softer.')
    expect(six?.tone).toBe('gold')
  })

  it('keeps the earlier-photo CTA on every tier', () => {
    expect(degradationWarningCopy(3)?.cta).toBe('Use an earlier photo')
    expect(degradationWarningCopy(4)?.cta).toBe('Use an earlier photo')
    expect(degradationWarningCopy(5)?.cta).toBe('Use an earlier photo')
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
