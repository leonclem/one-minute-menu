/**
 * Property Test: Stale Cut-Out Invalidation
 *
 * Property: FOR ALL menu items where the source image has been regenerated,
 * any previously succeeded cut-out must not be used for rendering.
 *
 * This validates that:
 * 1. After invalidation, resolveImageUrl always returns the original URL
 * 2. After a new cutout request replaces the old one, the old cutout is not used
 * 3. The combination of invalidation + re-request never leaks a stale cutout URL
 *
 * Validates: Requirements 10.1–10.4
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

// ── Arbitraries ─────────────────────────────────────────────────────────────

const urlArb = fc.webUrl().filter((u) => u.length > 0)

const cutoutStatusArb = fc.constantFrom<CutoutStatus>(
  'not_requested',
  'pending',
  'succeeded',
  'failed',
  'timed_out'
)

describe('Property: Stale Cut-Out Invalidation', () => {
  /**
   * After a source image is regenerated (invalidated), the resolver must
   * return the original URL regardless of any prior cutout data.
   *
   * We model invalidation as: cutoutStatus becomes 'not_requested' and
   * cutoutUrl becomes null — which is exactly what invalidateCutout() does.
   */
  it('after invalidation, resolveImageUrl always returns original URL for any template/feature combo', () => {
    fc.assert(
      fc.property(
        urlArb,                // originalUrl
        fc.boolean(),          // templateSupportsCutouts
        fc.boolean(),          // featureEnabled
        (originalUrl, templateSupportsCutouts, featureEnabled) => {
          // Post-invalidation state: status = not_requested, cutoutUrl = null
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: null,
            cutoutStatus: 'not_requested',
            templateSupportsCutouts,
            featureEnabled,
          })

          expect(result).toBe(originalUrl)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * A previously succeeded cutout must not be returned by the resolver
   * when the cutout status is anything other than 'succeeded'.
   *
   * This models the scenario where a source image was regenerated:
   * the old cutout URL may still exist in memory/cache, but the status
   * has been reset, so the resolver must ignore it.
   */
  it('stale cutout URL is never returned when status is not succeeded', () => {
    fc.assert(
      fc.property(
        urlArb,                // originalUrl
        urlArb,                // staleCutoutUrl (from a previous succeeded cutout)
        cutoutStatusArb.filter((s) => s !== 'succeeded'), // any non-succeeded status
        fc.boolean(),          // templateSupportsCutouts
        fc.boolean(),          // featureEnabled
        (originalUrl, staleCutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: staleCutoutUrl,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
          })

          // Must always return original when status is not succeeded
          expect(result).toBe(originalUrl)
        }
      ),
      { numRuns: 500 }
    )
  })

  /**
   * When a new image is generated and the old cutout is invalidated,
   * the new original URL must be returned — never the old cutout URL.
   *
   * Models: old image had succeeded cutout → regeneration → invalidation →
   * new image with not_requested status.
   */
  it('after regeneration, new original URL is returned, never old cutout URL', () => {
    fc.assert(
      fc.property(
        urlArb,                // oldOriginalUrl
        urlArb,                // oldCutoutUrl (previously succeeded)
        urlArb,                // newOriginalUrl (after regeneration)
        fc.boolean(),          // templateSupportsCutouts
        fc.boolean(),          // featureEnabled
        (oldOriginalUrl, oldCutoutUrl, newOriginalUrl, templateSupportsCutouts, featureEnabled) => {
          // Before regeneration: old cutout was succeeded
          const beforeRegen = CutoutGenerationService.resolveImageUrl({
            originalUrl: oldOriginalUrl,
            cutoutUrl: oldCutoutUrl,
            cutoutStatus: 'succeeded',
            templateSupportsCutouts,
            featureEnabled,
          })

          // After regeneration + invalidation: new original, no cutout
          const afterRegen = CutoutGenerationService.resolveImageUrl({
            originalUrl: newOriginalUrl,
            cutoutUrl: null,
            cutoutStatus: 'not_requested',
            templateSupportsCutouts,
            featureEnabled,
          })

          // After regeneration, must return the new original URL
          expect(afterRegen).toBe(newOriginalUrl)

          // The old cutout URL must never appear in the post-regeneration result
          expect(afterRegen).not.toBe(oldCutoutUrl)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * During the window between invalidation and new cutout completion,
   * the resolver must return the original URL for any intermediate status.
   */
  it('during pending re-processing after regeneration, original URL is always returned', () => {
    fc.assert(
      fc.property(
        urlArb,                // newOriginalUrl
        fc.constantFrom<CutoutStatus>('not_requested', 'pending', 'failed', 'timed_out'),
        fc.boolean(),          // templateSupportsCutouts
        fc.boolean(),          // featureEnabled
        (newOriginalUrl, intermediateStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl: newOriginalUrl,
            cutoutUrl: null,
            cutoutStatus: intermediateStatus,
            templateSupportsCutouts,
            featureEnabled,
          })

          expect(result).toBe(newOriginalUrl)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * The resolver never throws and never returns null/undefined,
   * regardless of the combination of inputs after invalidation.
   */
  it('resolveImageUrl never throws or returns nullish after invalidation', () => {
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
          })

          expect(result).toBeDefined()
          expect(result).not.toBeNull()
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 500 }
    )
  })
})
