/**
 * @jest-environment node
 */

import type { StudioImageRecord } from '@/lib/studio/types'
import {
  deepestBranchGen,
  generativeDepth,
  neighboringShots,
  shotForest,
  shotLibraryBadge,
  shotLibraryBadgeLine,
  shotRoots,
  shotShortLabel,
  shotTitle,
  sourceRootLabel,
  sourceRoots,
} from '../lineage'

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

const original = image({ id: 'og', role: 'source', created_at: '2026-08-15T00:00:00.000Z' })
const lighting = image({
  id: 'v1',
  role: 'generated',
  source_image_id: 'og',
  created_at: '2026-08-15T01:00:00.000Z',
  metadata: { changeSummary: ['Lighting → Bright & Clean'] },
})
const mustard = image({
  id: 'v2',
  role: 'generated',
  source_image_id: 'v1',
  created_at: '2026-08-15T02:00:00.000Z',
  metadata: { changeSummary: ['Background → Mustard Yellow'] },
})
const cropped = image({
  id: 'crop',
  role: 'generated',
  source_image_id: 'v2',
  created_at: '2026-08-15T03:00:00.000Z',
  metadata: { mode: 'crop', crop: { aspectPreset: '4:5' } },
})
const afterCrop = image({
  id: 'v3',
  role: 'generated',
  source_image_id: 'crop',
  created_at: '2026-08-15T04:00:00.000Z',
  metadata: { changeSummary: ['Lighting → Dark & Moody'] },
})
const uploadTwo = image({
  id: 'og2',
  role: 'source',
  created_at: '2026-08-16T00:00:00.000Z',
})
const goldenHour = image({
  id: 'gh',
  role: 'generated',
  source_image_id: 'og',
  created_at: '2026-08-15T01:30:00.000Z',
  metadata: { changeSummary: ['Lighting → Golden Hour'] },
})

const gallery = [original, lighting, mustard, cropped, afterCrop, uploadTwo, goldenHour]

describe('source roots', () => {
  it('labels the first upload Original and later uploads Upload N', () => {
    expect(sourceRoots(gallery).map((item) => item.id)).toEqual(['og', 'og2'])
    expect(sourceRootLabel(original, gallery)).toBe('Original')
    expect(sourceRootLabel(uploadTwo, gallery)).toBe('Upload 2')
  })
})

describe('shotRoots', () => {
  it('includes source uploads and generated shots whose parent is missing', () => {
    const orphan = image({
      id: 'orphan',
      role: 'generated',
      source_image_id: 'gone',
      created_at: '2026-08-17T00:00:00.000Z',
    })
    expect(shotRoots([...gallery, orphan]).map((item) => item.id)).toEqual(['og', 'og2', 'orphan'])
  })
})

describe('generativeDepth', () => {
  it('counts AI hops from the root and ignores lossless crops', () => {
    expect(generativeDepth(original, gallery)).toBe(0)
    expect(generativeDepth(lighting, gallery)).toBe(1)
    expect(generativeDepth(mustard, gallery)).toBe(2)
    expect(generativeDepth(cropped, gallery)).toBe(2)
    expect(generativeDepth(afterCrop, gallery)).toBe(3)
    expect(generativeDepth(goldenHour, gallery)).toBe(1)
    expect(generativeDepth(uploadTwo, gallery)).toBe(0)
    expect(deepestBranchGen(gallery)).toBe(3)
  })
})

describe('shotLibraryBadge', () => {
  it('labels originals, later uploads, gens, and lossless crops', () => {
    expect(shotLibraryBadge(original, gallery)).toBe('ORIGINAL')
    expect(shotLibraryBadge(uploadTwo, gallery)).toBe('UPLOAD 2')
    expect(shotLibraryBadge(lighting, gallery)).toBe('GEN 1')
    expect(shotLibraryBadge(cropped, gallery)).toBe('GEN 2')
    expect(shotLibraryBadgeLine(cropped, gallery)).toBe('GEN 2 · LOSSLESS')
    expect(shotLibraryBadge(afterCrop, gallery)).toBe('GEN 3')
  })
})

describe('shotForest', () => {
  it('nests children under each root including a second upload', () => {
    const forest = shotForest(gallery)
    expect(forest.map((node) => node.image.id)).toEqual(['og', 'og2'])
    expect(forest[0].children.map((node) => node.image.id)).toEqual(['v1', 'gh'])
    const lightingNode = forest[0].children.find((node) => node.image.id === 'v1')
    expect(lightingNode?.children.map((node) => node.image.id)).toEqual(['v2'])
    expect(forest[1].children).toEqual([])
  })
})

describe('shotShortLabel', () => {
  it('uses OG / Un for sources and Gn for generative depth', () => {
    expect(shotShortLabel(original, gallery)).toBe('OG')
    expect(shotShortLabel(uploadTwo, gallery)).toBe('U2')
    expect(shotShortLabel(lighting, gallery)).toBe('G1')
    expect(shotShortLabel(cropped, gallery)).toBe('G2')
    expect(shotShortLabel(afterCrop, gallery)).toBe('G3')
  })
})

describe('shotTitle', () => {
  it('uses the change line, crop aspect, or root label', () => {
    expect(shotTitle(original, gallery)).toBe('Original')
    expect(shotTitle(uploadTwo, gallery)).toBe('Upload 2')
    expect(shotTitle(lighting, gallery)).toBe('Lighting → Bright & Clean')
    expect(shotTitle(cropped, gallery)).toBe('Cropped 4:5')
    expect(
      shotTitle(
        image({
          id: 'rm',
          role: 'generated',
          source_image_id: 'og',
          metadata: { objectEdit: { operation: 'remove' } },
        }),
        gallery,
      ),
    ).toBe('Removed object')
    expect(
      shotTitle(
        image({
          id: 'rs',
          role: 'generated',
          source_image_id: 'og',
          metadata: { mode: 'reshoot' },
        }),
        gallery,
      ),
    ).toBe('Re-shot')
  })
})

describe('neighboringShots', () => {
  it('walks chronological order without wrapping', () => {
    const ordered = [original, lighting, goldenHour, mustard]
    expect(neighboringShots('lighting', ordered)).toEqual({ prev: null, next: null })
    expect(neighboringShots(lighting.id, ordered)).toEqual({
      prev: original,
      next: goldenHour,
    })
    expect(neighboringShots(original.id, ordered).prev).toBeNull()
    expect(neighboringShots(mustard.id, ordered).next).toBeNull()
  })
})
