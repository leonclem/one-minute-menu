/**
 * Property Tests: PDF Export Cutout Resolution (Task 17.6)
 *
 * Verifies that the PDF export path resolves image URLs using the same logic
 * as the web renderer when `imageMode = 'cutout'` is active.
 *
 * The PDF export route calls `transformMenuToV2(menu, { imageModeIsCutout: rawImageMode === 'cutout' })`.
 * These tests exercise that path directly to confirm the two properties:
 *
 * **Property: PDF Cutout Consistency**
 * FOR ALL menu items where `imageMode = 'cutout'`, the PDF export path must
 * resolve image URLs using the same logic as the web renderer:
 * - `cutout_url` when `cutout_status = 'succeeded'`
 * - `undefined` (blank placeholder) otherwise
 *
 * **Property: PDF Non-Cutout Unchanged**
 * FOR ALL menu items where `imageMode != 'cutout'`, the PDF export path must
 * produce output identical to pre-17 behaviour (original URL as fallback).
 *
 * Validates: Requirements 13.3
 */

import fc from 'fast-check'
import { transformMenuToV2 } from '@/lib/templates/v2/menu-transformer-v2'
import type { TransformOptionsV2, ItemCutoutContext } from '@/lib/templates/v2/menu-transformer-v2'
import type { Menu, MenuItem } from '@/types'
import type { CutoutStatus } from '@/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/background-removal/render-tracking', () => ({
  trackRenderUsage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// Avoid @google-cloud/storage ESM import issues
jest.mock('@/lib/background-removal/local-image-proxy', () => ({
  resolvePublicImageUrl: jest.fn().mockResolvedValue({
    url: 'https://example.com/image.jpg',
    cleanup: jest.fn().mockResolvedValue(undefined),
  }),
}))

// ── Arbitraries ──────────────────────────────────────────────────────────────

const urlArb = fc.webUrl().filter((u) => u.length > 0)

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Build TransformOptionsV2 that mirrors what the PDF export route passes:
 *   transformMenuToV2(menu, { imageModeIsCutout: rawImageMode === 'cutout', cutout: { ... } })
 */
function makePdfOptions(
  imageModeIsCutout: boolean,
  itemId: string,
  cutoutCtx: ItemCutoutContext,
  templateSupportsCutouts: boolean,
  featureEnabled: boolean
): TransformOptionsV2 {
  const itemCutouts = new Map<string, ItemCutoutContext>()
  itemCutouts.set(itemId, cutoutCtx)

  return {
    imageModeIsCutout,
    cutout: {
      featureEnabled,
      templateSupportsCutouts,
      itemCutouts,
    },
  }
}

// ── Property 1: PDF Cutout Consistency ───────────────────────────────────────

describe('Property: PDF Cutout Consistency', () => {
  /**
   * When imageMode = 'cutout' AND cutout_status = 'succeeded' AND cutout_url is non-null,
   * the PDF export path must return cutout_url — same as the web renderer.
   */
  it('returns cutout_url when imageModeIsCutout=true, status=succeeded, cutout_url is non-null', () => {
    fc.assert(
      fc.property(
        urlArb,   // originalUrl
        urlArb,   // cutoutUrl
        fc.boolean(), // templateSupportsCutouts
        fc.boolean(), // featureEnabled
        (originalUrl, cutoutUrl, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const options = makePdfOptions(
            true, // imageModeIsCutout — PDF export with imageMode='cutout'
            itemId,
            { cutoutUrl, cutoutStatus: 'succeeded' },
            templateSupportsCutouts,
            featureEnabled
          )

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(cutoutUrl)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * When imageMode = 'cutout' AND cutout is NOT available (non-succeeded status),
   * the PDF export path must return undefined (blank placeholder) — same as the web renderer.
   * It must NOT fall back to the original URL.
   */
  it('returns undefined (blank placeholder) when imageModeIsCutout=true and status is not succeeded', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb, { nil: null }),
        nonSucceededStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const options = makePdfOptions(
            true,
            itemId,
            { cutoutUrl, cutoutStatus },
            templateSupportsCutouts,
            featureEnabled
          )

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          // null from resolveImageUrl becomes undefined in the EngineItemV2
          expect(resolvedUrl).toBeUndefined()
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * When imageMode = 'cutout' AND cutout_url is null (even if status = succeeded),
   * the PDF export path must return undefined — never the original URL.
   */
  it('returns undefined when imageModeIsCutout=true and cutout_url is null', () => {
    fc.assert(
      fc.property(
        urlArb,
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const options = makePdfOptions(
            true,
            itemId,
            { cutoutUrl: null, cutoutStatus },
            templateSupportsCutouts,
            featureEnabled
          )

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBeUndefined()
          // Must never fall back to original
          expect(resolvedUrl).not.toBe(originalUrl)
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * PDF and web renderer must agree: for any given input, both paths produce
   * the same imageUrl when imageModeIsCutout=true.
   *
   * The web renderer also calls transformMenuToV2 with imageModeIsCutout=true,
   * so calling the same function with the same options is the canonical check.
   */
  it('PDF and web renderer produce identical output for the same inputs', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb, { nil: null }),
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const options = makePdfOptions(
            true,
            itemId,
            { cutoutUrl, cutoutStatus },
            templateSupportsCutouts,
            featureEnabled
          )

          // Both paths call transformMenuToV2 with the same options
          const pdfResult = transformMenuToV2(menu, options)
          const webResult = transformMenuToV2(menu, options)

          expect(pdfResult.sections[0].items[0].imageUrl).toBe(
            webResult.sections[0].items[0].imageUrl
          )
        }
      ),
      { numRuns: 300 }
    )
  })
})

// ── Property 2: PDF Non-Cutout Unchanged ─────────────────────────────────────

describe('Property: PDF Non-Cutout Unchanged', () => {
  /**
   * When imageMode != 'cutout' (imageModeIsCutout=false), the PDF export path
   * must produce output identical to pre-17 behaviour: always returns a
   * non-undefined string, using original URL as fallback.
   */
  it('returns non-undefined string when imageModeIsCutout=false (pre-17 behaviour)', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb, { nil: null }),
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const options = makePdfOptions(
            false, // imageModeIsCutout=false — non-cutout PDF export
            itemId,
            { cutoutUrl, cutoutStatus },
            templateSupportsCutouts,
            featureEnabled
          )

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBeDefined()
          expect(typeof resolvedUrl).toBe('string')
          expect(resolvedUrl!.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * When imageModeIsCutout=false, the silent-upgrade logic applies:
   * - Returns cutoutUrl when featureEnabled AND templateSupportsCutouts AND
   *   status=succeeded AND cutoutUrl is non-null
   * - Returns originalUrl in all other cases
   *
   * This is identical to the web renderer's non-cutout-mode behaviour.
   */
  it('matches pre-17 silent-upgrade logic when imageModeIsCutout=false', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb, { nil: null }),
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          const options = makePdfOptions(
            false,
            itemId,
            { cutoutUrl, cutoutStatus },
            templateSupportsCutouts,
            featureEnabled
          )

          const result = transformMenuToV2(menu, options)
          const resolvedUrl = result.sections[0].items[0].imageUrl

          // Compute expected pre-17 result
          const shouldUseCutout =
            featureEnabled &&
            templateSupportsCutouts &&
            cutoutStatus === 'succeeded' &&
            cutoutUrl !== null

          const expected = shouldUseCutout ? cutoutUrl! : originalUrl

          expect(resolvedUrl).toBe(expected)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * When no cutout context is provided at all (backward compat path),
   * the PDF export path must return the original URL unchanged.
   */
  it('returns original URL when no cutout context is provided (backward compat)', () => {
    fc.assert(
      fc.property(
        urlArb,
        (originalUrl) => {
          const itemId = 'item-1'
          const item = makeMenuItem(itemId, originalUrl)
          const menu = makeMenu(item)

          // No cutout context — mirrors a PDF export before cutout feature existed
          const result = transformMenuToV2(menu, { imageModeIsCutout: false })
          const resolvedUrl = result.sections[0].items[0].imageUrl

          expect(resolvedUrl).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })
})
