/**
 * @jest-environment node
 */

import type { StudioImageRecord } from '@/lib/studio/types'
import { parentVariantShortLabel, parentVariantLineageText, studioVariantShortLabel, studioVariantSpokenLabel } from '../variant-labels'

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

const og = image({ id: 'og', role: 'source' })
const v1 = image({ id: 'v1', role: 'generated', source_image_id: 'og' })
const v2 = image({ id: 'v2', role: 'generated', source_image_id: 'v1' })
const v3 = image({ id: 'v3', role: 'generated', source_image_id: 'og' })
const variants = [og, v1, v2, v3]

describe('studioVariantShortLabel', () => {
  it('labels the source OG and generated images V1… in gallery order', () => {
    expect(studioVariantShortLabel(og, variants)).toBe('OG')
    expect(studioVariantShortLabel(v1, variants)).toBe('V1')
    expect(studioVariantShortLabel(v2, variants)).toBe('V2')
    expect(studioVariantShortLabel(v3, variants)).toBe('V3')
  })
})

describe('studioVariantSpokenLabel', () => {
  it('uses Original and Variant N', () => {
    expect(studioVariantSpokenLabel(og, variants)).toBe('Original')
    expect(studioVariantSpokenLabel(v2, variants)).toBe('Variant 2')
  })
})

describe('parentVariantShortLabel', () => {
  it('names the parent with the same short labels', () => {
    expect(parentVariantShortLabel(v3, variants)).toBe('OG')
    expect(parentVariantShortLabel(v2, variants)).toBe('V1')
    expect(parentVariantShortLabel(v1, variants)).toBe('OG')
  })

  it('returns null for OG or when the parent is no longer in the gallery', () => {
    expect(parentVariantShortLabel(og, variants)).toBeNull()
    expect(
      parentVariantShortLabel(image({ id: 'orphan', role: 'generated', source_image_id: 'gone' }), variants),
    ).toBeNull()
  })
})

describe('parentVariantLineageText', () => {
  it('uses From for standard generations and Re-shot from for reshoots', () => {
    expect(parentVariantLineageText(v1, variants)).toBe('From OG')
    expect(
      parentVariantLineageText(
        image({ id: 'rs', role: 'generated', source_image_id: 'og', metadata: { mode: 'reshoot' } }),
        variants,
      ),
    ).toBe('Re-shot from OG')
    expect(
      parentVariantLineageText(
        image({ id: 'rs2', role: 'generated', source_image_id: 'v1', metadata: { mode: 'reshoot' } }),
        variants,
      ),
    ).toBe('Re-shot from V1')
  })
})
