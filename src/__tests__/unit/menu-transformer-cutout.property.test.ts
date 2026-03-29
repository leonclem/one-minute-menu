/**
 * Property-Based Tests for Menu Transformer Cut-Out Resolution
 *
 * Property: Fallback Consistency — FOR ALL items where cutout is unavailable,
 * the transformer must return the original image URL.
 *
 * Property: Cut-Out Preference — FOR ALL items where cutout succeeded and
 * template supports cutouts and feature is enabled, the transformer must
 * return the cutout URL.
 *
 * **Validates: Requirements 3.1–3.5, 4.2–4.4**
 */

import * as fc from 'fast-check'
import { transformMenuToV2 } from '@/lib/templates/v2/menu-transformer-v2'
import type { TransformOptionsV2, ItemCutoutContext } from '@/lib/templates/v2/menu-transformer-v2'
import type { Menu, MenuItem } from '@/types'
import type { CutoutStatus } from '@/types'

// Mock trackRenderUsage so it doesn't hit the DB
jest.mock('@/lib/background-removal/render-tracking', () => ({
  trackRenderUsage: jest.fn().mockResolvedValue(undefined),
}))

// Mock local-image-proxy to avoid @google-cloud/storage ESM import issues
jest.mock('@/lib/background-removal/local-image-proxy', () => ({
  resolvePublicImageUrl: jest.fn().mockImplementation((url: string) =>
    Promise.resolve({ url, cleanup: jest.fn().mockResolvedValue(undefined) })
  ),
}))

// ── Generators ──────────────────────────────────────────────────────────────

const urlArb = fc.webUrl()

const cutoutStatusArb: fc.Arbitrary<CutoutStatus> = fc.constantFrom(
  'not_requested',
  'pending',
  'succeeded',
  'failed',
  'timed_out'
)

const nonSucceededStatusArb: fc.Arbitrary<CutoutStatus> = fc.constantFrom(
  'not_requested',
  'pending',
  'failed',
  'timed_out'
)

/** Build a minimal MenuItem with an AI image */
function makeMenuItem(id: string, imageUrl: string): MenuItem {
  return {
    id,
    name: `Item ${id}`,
    price: 10,
    available: true,
    order: 0,
    imageSource: 'ai',
    customImageUrl: imageUrl,
  }
}

/** Build a minimal Menu containing a single item */
function makeMenu(item: MenuItem): Menu {
  return {
    id: 'menu-1',
    name: 'Test Menu',
    userId: 'user-1',
    items: [item],
    categories: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
  } as Menu
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Property: Menu Transformer Cut-Out Resolution', () => {

  // ── Property 1: Fallback Consistency ────────────────────────────────────
  // When cutout is unavailable (status !== succeeded, or no cutoutUrl),
  // the transformer must return the original image URL.

  it('returns original URL when cutout status is not succeeded', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb),
        nonSucceededStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const itemCutouts = new Map<string, ItemCutoutContext>()
          itemCutouts.set(itemId, {
            cutoutUrl: cutoutUrl ?? null,
            cutoutStatus,
          })

          const options: TransformOptionsV2 = {
            cutout: {
              featureEnabled,
              templateSupportsCutouts,
              itemCutouts,
            },
          }

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns original URL when cutoutUrl is null even if status is succeeded', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const itemCutouts = new Map<string, ItemCutoutContext>()
          itemCutouts.set(itemId, {
            cutoutUrl: null,
            cutoutStatus: 'succeeded',
          })

          const options: TransformOptionsV2 = {
            cutout: {
              featureEnabled,
              templateSupportsCutouts,
              itemCutouts,
            },
          }

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns original URL when feature is disabled regardless of cutout availability', () => {
    fc.assert(
      fc.property(
        urlArb,
        urlArb,
        cutoutStatusArb,
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const itemCutouts = new Map<string, ItemCutoutContext>()
          itemCutouts.set(itemId, {
            cutoutUrl,
            cutoutStatus,
          })

          const options: TransformOptionsV2 = {
            cutout: {
              featureEnabled: false,
              templateSupportsCutouts,
              itemCutouts,
            },
          }

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns original URL when template does not support cutouts', () => {
    fc.assert(
      fc.property(
        urlArb,
        urlArb,
        cutoutStatusArb,
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const itemCutouts = new Map<string, ItemCutoutContext>()
          itemCutouts.set(itemId, {
            cutoutUrl,
            cutoutStatus,
          })

          const options: TransformOptionsV2 = {
            cutout: {
              featureEnabled,
              templateSupportsCutouts: false,
              itemCutouts,
            },
          }

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns original URL when item has no cutout context entry', () => {
    fc.assert(
      fc.property(
        urlArb,
        (originalUrl) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const options: TransformOptionsV2 = {
            cutout: {
              featureEnabled: true,
              templateSupportsCutouts: true,
              itemCutouts: new Map(), // empty — no entry for this item
            },
          }

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 2: Cut-Out Preference ─────────────────────────────────────
  // When cutout succeeded, template supports cutouts, and feature is enabled,
  // the transformer must return the cutout URL.

  it('returns cutout URL when all conditions are met', () => {
    fc.assert(
      fc.property(
        urlArb,
        urlArb,
        (originalUrl, cutoutUrl) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const itemCutouts = new Map<string, ItemCutoutContext>()
          itemCutouts.set(itemId, {
            cutoutUrl,
            cutoutStatus: 'succeeded',
          })

          const options: TransformOptionsV2 = {
            cutout: {
              featureEnabled: true,
              templateSupportsCutouts: true,
              itemCutouts,
            },
          }

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(cutoutUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 3: Backward compatibility ─────────────────────────────────
  // When no cutout context is provided, behavior is identical to before.

  it('returns original URL when no cutout context is provided (backward compat)', () => {
    fc.assert(
      fc.property(
        urlArb,
        (originalUrl) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const result = transformMenuToV2(menu)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })
})
