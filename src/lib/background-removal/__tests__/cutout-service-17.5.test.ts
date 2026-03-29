/**
 * Property Tests: Per-Item Cutout URL Resolution (Task 17.5)
 *
 * Tests three properties of `CutoutGenerationService.resolveImageUrl` covering
 * the explicit per-item cutout mode introduced in Task 17.2.
 *
 * **Property: Explicit Cutout Selection**
 * FOR ALL inputs where `itemUsesCutout` is true AND `cutout_status = 'succeeded'`
 * AND `cutout_url` is non-null, `resolveImageUrl` must return `cutout_url`.
 *
 * **Property: Explicit Cutout Unavailable**
 * FOR ALL inputs where `itemUsesCutout` is true AND `cutout_status` is NOT
 * `succeeded` (or `cutout_url` is null), `resolveImageUrl` must return `null` —
 * never the original URL.
 *
 * **Property: Unselected Items Unchanged**
 * FOR ALL inputs where `itemUsesCutout` is false or absent, `resolveImageUrl`
 * must return a non-null string and produce output identical to pre-17 behaviour
 * (original URL as fallback).
 *
 * Validates: Requirements 13.2, 13.3
 */

import fc from 'fast-check'
import { CutoutGenerationService } from '../cutout-service'
import type { CutoutStatus } from '@/types'

// ── Mock logger to suppress output ──────────────────────────────────────────
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// ── Mock local-image-proxy to avoid @google-cloud/storage ESM import ────────
jest.mock('../local-image-proxy', () => ({
  resolvePublicImageUrl: jest.fn().mockResolvedValue({
    url: 'https://example.com/image.jpg',
    cleanup: jest.fn().mockResolvedValue(undefined),
  }),
}))

// ── Arbitraries ──────────────────────────────────────────────────────────────

const urlArb = fc.webUrl().filter((u) => u.length > 0)

const cutoutStatusArb = fc.constantFrom<CutoutStatus>(
  'not_requested',
  'pending',
  'succeeded',
  'failed',
  'timed_out'
)

const nonSucceededStatusArb = fc.constantFrom<CutoutStatus>(
  'not_requested',
  'pending',
  'failed',
  'timed_out'
)

// ── Property 1: Explicit Cutout Selection ────────────────────────────────────

describe('Property: Explicit Cutout Selection', () => {
  /**
   * When the user has explicitly selected cutout style for an item
   * AND the cutout is available (succeeded + non-null URL),
   * resolveImageUrl must return the cutout URL.
   *
   * Validates: Requirement 13.3
   */
  it('returns cutout_url when itemUsesCutout=true, status=succeeded, cutout_url is non-null', () => {
    fc.assert(
      fc.property(
        urlArb,       // originalUrl
        urlArb,       // cutoutUrl (non-null, succeeded)
        fc.boolean(), // templateSupportsCutouts (should not affect explicit mode)
        fc.boolean(), // featureEnabled (should not affect explicit mode)
        (originalUrl, cutoutUrl, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl,
            cutoutStatus: 'succeeded',
            templateSupportsCutouts,
            featureEnabled,
            itemUsesCutout: true,
          })

          expect(result).toBe(cutoutUrl)
        }
      ),
      { numRuns: 300 }
    )
  })
})

// ── Property 2: Explicit Cutout Unavailable ──────────────────────────────────

describe('Property: Explicit Cutout Unavailable', () => {
  /**
   * When the user has explicitly selected cutout style for an item
   * BUT the cutout is not available (non-succeeded status),
   * resolveImageUrl must return null — never the original URL.
   *
   * Validates: Requirement 13.3
   */
  it('returns null when itemUsesCutout=true and cutout_status is not succeeded', () => {
    fc.assert(
      fc.property(
        urlArb,                // originalUrl
        fc.option(urlArb, { nil: null }), // cutoutUrl (may or may not exist)
        nonSucceededStatusArb, // any non-succeeded status
        fc.boolean(),          // templateSupportsCutouts
        fc.boolean(),          // featureEnabled
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
            itemUsesCutout: true,
          })

          expect(result).toBeNull()
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * When the user has explicitly selected cutout style for an item
   * BUT cutout_url is null (even if status is succeeded),
   * resolveImageUrl must return null — never the original URL.
   *
   * Validates: Requirement 13.3
   */
  it('returns null when itemUsesCutout=true and cutout_url is null (regardless of status)', () => {
    fc.assert(
      fc.property(
        urlArb,           // originalUrl
        cutoutStatusArb,  // any status (including succeeded)
        fc.boolean(),     // templateSupportsCutouts
        fc.boolean(),     // featureEnabled
        (originalUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: null,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
            itemUsesCutout: true,
          })

          expect(result).toBeNull()
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * When itemUsesCutout=true and cutout is unavailable, the result must
   * never equal the original URL — blank placeholder (null) is required.
   *
   * Validates: Requirement 13.3 — "renderer SHALL display a blank placeholder
   * space" when cutout style is selected but no valid cutout exists.
   */
  it('never returns originalUrl when itemUsesCutout=true and cutout is unavailable', () => {
    fc.assert(
      fc.property(
        urlArb,                // originalUrl
        fc.option(urlArb, { nil: null }), // cutoutUrl
        nonSucceededStatusArb, // non-succeeded status
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
            itemUsesCutout: true,
          })

          // Must be null, not the original URL
          expect(result).not.toBe(originalUrl)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 500 }
    )
  })
})

// ── Property 3: Unselected Items Unchanged ───────────────────────────────────

describe('Property: Unselected Items Unchanged', () => {
  /**
   * When itemUsesCutout is false, resolveImageUrl must behave identically
   * to pre-17 behaviour: always returns a non-null string, using original
   * URL as fallback.
   *
   * Validates: Requirements 13.2, 13.3
   */
  it('returns non-null string when itemUsesCutout=false (identical to pre-17 behaviour)', () => {
    fc.assert(
      fc.property(
        urlArb,                // originalUrl
        fc.option(urlArb, { nil: null }), // cutoutUrl
        cutoutStatusArb,       // any status
        fc.boolean(),          // templateSupportsCutouts
        fc.boolean(),          // featureEnabled
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
            itemUsesCutout: false,
          })

          expect(result).not.toBeNull()
          expect(typeof result).toBe('string')
          expect(result!.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * When itemUsesCutout is absent (undefined), resolveImageUrl must behave
   * identically to pre-17 behaviour: always returns a non-null string.
   *
   * Validates: Requirements 13.2, 13.3
   */
  it('returns non-null string when itemUsesCutout is absent (identical to pre-17 behaviour)', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb, { nil: null }),
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
            // itemUsesCutout intentionally omitted
          })

          expect(result).not.toBeNull()
          expect(typeof result).toBe('string')
          expect(result!.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * When itemUsesCutout is false/absent, the output must match the pre-17
   * silent-upgrade logic exactly:
   * - Returns cutoutUrl when featureEnabled AND templateSupportsCutouts AND
   *   status=succeeded AND cutoutUrl is non-null
   * - Returns originalUrl in all other cases
   *
   * Validates: Requirements 13.2, 13.3
   */
  it('output matches pre-17 silent-upgrade logic when itemUsesCutout is false or absent', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb, { nil: null }),
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        fc.option(fc.constant(false), { nil: undefined }), // false or undefined
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled, itemUsesCutout) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
            itemUsesCutout,
          })

          // Compute expected pre-17 result
          const expectedCutout =
            featureEnabled &&
            templateSupportsCutouts &&
            cutoutStatus === 'succeeded' &&
            cutoutUrl !== null

          const expected = expectedCutout ? cutoutUrl : originalUrl

          expect(result).toBe(expected)
        }
      ),
      { numRuns: 500 }
    )
  })
})
