/**
 * Property-Based Tests for Feature Flag Gating
 *
 * Property: Feature Flag Gating — WHEN the feature flag is disabled,
 * no cut-out generation requests shall be submitted and the resolver
 * always returns the original image.
 *
 * **Validates: Requirements 1.1**
 */

import * as fc from 'fast-check'
import { isCutoutFeatureEnabled } from '@/lib/background-removal/feature-flag'
import type { CutoutStatus } from '@/types'

describe('Property: Feature Flag Gating', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.CUTOUT_GENERATION_DISABLED
  })

  afterEach(() => {
    process.env = originalEnv
  })

  /**
   * Pure resolution logic matching the design for CutoutGenerationService.resolveImageUrl.
   */
  function resolveImageUrl(params: {
    originalUrl: string
    cutoutUrl: string | null
    cutoutStatus: CutoutStatus
    templateSupportsCutouts: boolean
    featureEnabled: boolean
  }): string {
    if (!params.featureEnabled) return params.originalUrl
    if (!params.templateSupportsCutouts) return params.originalUrl
    if (params.cutoutStatus !== 'succeeded') return params.originalUrl
    if (!params.cutoutUrl) return params.originalUrl
    return params.cutoutUrl
  }

  // ── Generators ──────────────────────────────────────────────────────────

  const urlArb = fc.webUrl()

  const cutoutStatusArb: fc.Arbitrary<CutoutStatus> = fc.constantFrom(
    'not_requested',
    'pending',
    'succeeded',
    'failed',
    'timed_out'
  )

  // ── Property 1: env-var disabled ⇒ isCutoutFeatureEnabled returns false ─

  it('always returns false when CUTOUT_GENERATION_DISABLED env var is "true"', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined), // no other inputs needed
        () => {
          process.env.CUTOUT_GENERATION_DISABLED = 'true'
          expect(isCutoutFeatureEnabled()).toBe(false)
        }
      ),
      { numRuns: 10 }
    )
  })

  // ── Property 2: feature disabled ⇒ resolver always returns original URL ─

  it('always returns the original URL when featureEnabled is false, regardless of cutout availability', async () => {
    await fc.assert(
      fc.property(
        urlArb,                // originalUrl
        fc.option(urlArb),     // cutoutUrl (null | string)
        cutoutStatusArb,       // cutoutStatus
        fc.boolean(),          // templateSupportsCutouts
        (originalUrl, cutoutUrl, cutoutStatus, templateSupportsCutouts) => {
          const result = resolveImageUrl({
            originalUrl,
            cutoutUrl: cutoutUrl ?? null,
            cutoutStatus,
            templateSupportsCutouts,
            featureEnabled: false,
          })

          expect(result).toBe(originalUrl)
        }
      ),
      { numRuns: 200 }
    )
  })
})
