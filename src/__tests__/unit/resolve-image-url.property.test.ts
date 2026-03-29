/**
 * Property-Based Tests for Image URL Resolution
 *
 * Property: Image URL Resolution — generate all combinations of feature flag,
 * template support, cutout status, and cutout URL; verify the function returns
 * the correct URL for every combination and never throws.
 *
 * **Validates: Requirements 3.1–3.3, 4.2–4.4**
 */

import * as fc from 'fast-check'
import { CutoutGenerationService } from '@/lib/background-removal/cutout-service'
import type { CutoutStatus } from '@/types'

// Mock local-image-proxy to avoid @google-cloud/storage ESM import issues
jest.mock('@/lib/background-removal/local-image-proxy', () => ({
  resolvePublicImageUrl: jest.fn().mockImplementation((url: string) =>
    Promise.resolve({ url, cleanup: jest.fn().mockResolvedValue(undefined) })
  ),
}))

describe('Property: Image URL Resolution', () => {
  // ── Generators ──────────────────────────────────────────────────────────

  const urlArb = fc.webUrl()

  const cutoutStatusArb: fc.Arbitrary<CutoutStatus> = fc.constantFrom(
    'not_requested',
    'pending',
    'succeeded',
    'failed',
    'timed_out'
  )

  // ── Property 1: Never throws, always returns a string ──────────────────

  it('never throws and always returns a string for all input combinations', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb),
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: cutoutUrl ?? null,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
          })

          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 2: featureEnabled=false ⇒ always returns originalUrl ──────

  it('always returns originalUrl when featureEnabled is false', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb),
        cutoutStatusArb,
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: cutoutUrl ?? null,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled: false,
          })

          expect(result).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 3: templateSupportsCutouts=false ⇒ always returns originalUrl ─

  it('always returns originalUrl when templateSupportsCutouts is false', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb),
        cutoutStatusArb,
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: cutoutUrl ?? null,
            cutoutStatus,
            templateSupportsCutouts: false,
            featureEnabled,
          })

          expect(result).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 4: cutoutStatus !== 'succeeded' ⇒ always returns originalUrl ─

  it('always returns originalUrl when cutoutStatus is not succeeded', () => {
    const nonSucceededStatusArb: fc.Arbitrary<CutoutStatus> = fc.constantFrom(
      'not_requested',
      'pending',
      'failed',
      'timed_out'
    )

    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb),
        nonSucceededStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: cutoutUrl ?? null,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
          })

          expect(result).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 5: cutoutUrl is null ⇒ always returns originalUrl ─────────

  it('always returns originalUrl when cutoutUrl is null', () => {
    fc.assert(
      fc.property(
        urlArb,
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: null,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
          })

          expect(result).toBe(originalUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 6: All four conditions met ⇒ returns cutoutUrl ────────────

  it('returns cutoutUrl when all four conditions are met', () => {
    fc.assert(
      fc.property(
        urlArb,
        urlArb,
        (originalUrl, cutoutUrl) => {
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl,
            cutoutStatus: 'succeeded',
            templateSupportsCutouts: true,
            featureEnabled: true,
          })

          expect(result).toBe(cutoutUrl)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ── Property 7: Return value is always originalUrl or cutoutUrl ────────

  it('always returns either originalUrl or cutoutUrl, never a third value', () => {
    fc.assert(
      fc.property(
        urlArb,
        fc.option(urlArb),
        cutoutStatusArb,
        fc.boolean(),
        fc.boolean(),
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts, featureEnabled) => {
          const resolvedCutoutUrl = cutoutUrl ?? null
          const result = CutoutGenerationService.resolveImageUrl({
            originalUrl,
            cutoutUrl: resolvedCutoutUrl,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled,
          })

          const validValues = [originalUrl]
          if (resolvedCutoutUrl !== null) {
            validValues.push(resolvedCutoutUrl)
          }
          expect(validValues).toContain(result)
        }
      ),
      { numRuns: 100 }
    )
  })
})
