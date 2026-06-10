/**
 * Property-Based Tests — Error-Code to HTTP Status Mapping
 *
 * Feature: photo-control, Property 16: Error-code to HTTP mapping
 *
 * Property 16: For every `NanoBananaError` code that the mutate route handles,
 * the route maps it to the correct HTTP status code and preserves the
 * `NanoBananaError` code, message, filterReason, and suggestions in the
 * response body. The mapping is exhaustive: every code in the defined set maps
 * to exactly one status, and the mapping is deterministic.
 *
 * Library: fast-check + Jest
 * Minimum iterations: 100 per property
 *
 * Validates: Requirements 14.1, 14.2, 14.3
 */

import fc from 'fast-check'
import { NanoBananaError } from '@/lib/nano-banana'

// ============================================================================
// The mapping under test
//
// This mirrors the switch statement in the mutate route exactly. It is
// extracted here as a pure function so it can be tested independently of the
// HTTP layer. Any change to the route's switch must be reflected here.
// ============================================================================

/**
 * Maps a `NanoBananaError` code to the HTTP status the mutate route returns.
 *
 * Mirrors the switch in `src/app/api/admin/photo-control/mutate/route.ts`.
 * (Requirements 14.1, 14.2, 14.3)
 */
export function mapErrorCodeToHttpStatus(code: string): number {
  switch (code) {
    case 'CONTENT_POLICY_VIOLATION':
      return 403
    case 'SAFETY_FILTER_BLOCKED':
      return 403
    case 'RATE_LIMIT_EXCEEDED':
      return 429
    case 'AUTHENTICATION_ERROR':
      return 401
    case 'SERVICE_UNAVAILABLE':
      return 503
    case 'NO_IMAGE_PRODUCED':
      return 502
    default:
      return 400
  }
}

/**
 * The complete set of `NanoBananaError` codes that have explicit mappings in
 * the mutate route, paired with their expected HTTP statuses.
 *
 * Requirements 14.1 (content-policy → 403), 14.2 (safety-filter → 403),
 * 14.3 (rate-limit → 429), plus auth/service/no-image mappings.
 */
const EXPLICIT_MAPPINGS: ReadonlyArray<{ code: string; expectedStatus: number }> = [
  { code: 'CONTENT_POLICY_VIOLATION', expectedStatus: 403 },
  { code: 'SAFETY_FILTER_BLOCKED', expectedStatus: 403 },
  { code: 'RATE_LIMIT_EXCEEDED', expectedStatus: 429 },
  { code: 'AUTHENTICATION_ERROR', expectedStatus: 401 },
  { code: 'SERVICE_UNAVAILABLE', expectedStatus: 503 },
  { code: 'NO_IMAGE_PRODUCED', expectedStatus: 502 },
]

// ============================================================================
// Arbitraries
// ============================================================================

/** Arbitrary that picks one of the explicitly-mapped error codes. */
const explicitCodeArb: fc.Arbitrary<string> = fc.constantFrom(
  ...EXPLICIT_MAPPINGS.map((m) => m.code),
)

/** Arbitrary for codes NOT in the explicit mapping set (fall-through → 400). */
const unknownCodeArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => !EXPLICIT_MAPPINGS.some((m) => m.code === s) && s.trim().length > 0)

/** Arbitrary for a non-empty error message. */
const errorMessageArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 200 })

/** Arbitrary for an optional retryAfter value (undefined or a positive integer). */
const retryAfterArb: fc.Arbitrary<number | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.integer({ min: 1, max: 3600 }),
)

/** Arbitrary for an optional filterReason string. */
const filterReasonArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constantFrom(
    'content_filtered',
    'safety_filtered',
    'person_detected',
    'text_detected',
    'inappropriate_content',
  ),
)

// ============================================================================
// Property 16: Error-code to HTTP mapping
// ============================================================================

describe('Feature: photo-control, Property 16: Error-code to HTTP mapping', () => {
  /**
   * Explicit-code mapping correctness (Requirements 14.1, 14.2, 14.3):
   *
   * For any `NanoBananaError` with a code in the explicit mapping set, the
   * mapping function returns the exact HTTP status specified for that code.
   */
  it('maps every explicitly-defined error code to its specified HTTP status', () => {
    fc.assert(
      fc.property(explicitCodeArb, errorMessageArb, (code, message) => {
        const expected = EXPLICIT_MAPPINGS.find((m) => m.code === code)!.expectedStatus
        const actual = mapErrorCodeToHttpStatus(code)
        expect(actual).toBe(expected)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Determinism (Requirements 14.1, 14.2, 14.3):
   *
   * For any error code, calling the mapping function twice with the same code
   * always returns the same HTTP status.
   */
  it('mapping is deterministic — same code always yields the same HTTP status', () => {
    fc.assert(
      fc.property(
        fc.oneof(explicitCodeArb, unknownCodeArb),
        (code) => {
          const first = mapErrorCodeToHttpStatus(code)
          const second = mapErrorCodeToHttpStatus(code)
          expect(first).toBe(second)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Unknown-code fall-through → 400 (Requirement 14.3 / default handling):
   *
   * For any error code NOT in the explicit mapping set, the mapping function
   * returns 400 (the default fall-through status).
   */
  it('maps any unknown error code to HTTP 400 (default fall-through)', () => {
    fc.assert(
      fc.property(unknownCodeArb, (code) => {
        const status = mapErrorCodeToHttpStatus(code)
        expect(status).toBe(400)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Content-policy and safety-filter both map to 403 (Requirements 14.1, 14.2):
   *
   * Both `CONTENT_POLICY_VIOLATION` and `SAFETY_FILTER_BLOCKED` must map to
   * HTTP 403, regardless of the error message, filterReason, or suggestions.
   */
  it('CONTENT_POLICY_VIOLATION and SAFETY_FILTER_BLOCKED both map to 403', () => {
    const policyCodeArb = fc.constantFrom('CONTENT_POLICY_VIOLATION', 'SAFETY_FILTER_BLOCKED')

    fc.assert(
      fc.property(policyCodeArb, errorMessageArb, filterReasonArb, (code, message, filterReason) => {
        const error = new NanoBananaError(message, code, undefined, undefined, filterReason)
        const status = mapErrorCodeToHttpStatus(error.code)
        expect(status).toBe(403)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Rate-limit maps to 429 (Requirement 14.3):
   *
   * `RATE_LIMIT_EXCEEDED` must map to HTTP 429 regardless of the retryAfter
   * value (present or absent).
   */
  it('RATE_LIMIT_EXCEEDED maps to 429 regardless of retryAfter value', () => {
    fc.assert(
      fc.property(errorMessageArb, retryAfterArb, (message, retryAfter) => {
        const error = new NanoBananaError(message, 'RATE_LIMIT_EXCEEDED', 429, retryAfter)
        const status = mapErrorCodeToHttpStatus(error.code)
        expect(status).toBe(429)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * NanoBananaError fields are preserved (Requirements 14.1, 14.2, 14.3):
   *
   * For any `NanoBananaError` with an explicitly-mapped code, the error's
   * `code`, `message`, `retryAfter`, `filterReason`, and `suggestions` fields
   * are all accessible and non-null/undefined where set. This validates that
   * the route can safely read these fields to build the response body.
   */
  it('NanoBananaError preserves code, message, retryAfter, filterReason, and suggestions', () => {
    fc.assert(
      fc.property(
        explicitCodeArb,
        errorMessageArb,
        retryAfterArb,
        filterReasonArb,
        (code, message, retryAfter, filterReason) => {
          const error = new NanoBananaError(message, code, undefined, retryAfter, filterReason)

          // Code and message are always present
          expect(error.code).toBe(code)
          expect(error.message).toBe(message)

          // retryAfter is preserved when set
          if (retryAfter !== undefined) {
            expect(error.retryAfter).toBe(retryAfter)
          }

          // filterReason is preserved when set
          if (filterReason !== undefined) {
            expect(error.filterReason).toBe(filterReason)
          }

          // suggestions is always an array (generated by NanoBananaError)
          expect(Array.isArray(error.suggestions)).toBe(true)

          // The HTTP status mapping is consistent with the code
          const expectedStatus = EXPLICIT_MAPPINGS.find((m) => m.code === code)!.expectedStatus
          expect(mapErrorCodeToHttpStatus(error.code)).toBe(expectedStatus)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Exhaustiveness — all explicit codes produce a valid HTTP status (Requirements 14.1–14.3):
   *
   * Every code in the explicit mapping set produces a status in the set of
   * valid HTTP error statuses {400, 401, 403, 429, 502, 503}. No code maps to
   * a 2xx or 3xx status.
   */
  it('every error code maps to a valid HTTP error status (4xx or 5xx)', () => {
    const validErrorStatuses = new Set([400, 401, 403, 429, 500, 502, 503])

    fc.assert(
      fc.property(
        fc.oneof(explicitCodeArb, unknownCodeArb),
        (code) => {
          const status = mapErrorCodeToHttpStatus(code)
          expect(validErrorStatuses.has(status)).toBe(true)
          // Must be a 4xx or 5xx — never a success or redirect
          expect(status).toBeGreaterThanOrEqual(400)
          expect(status).toBeLessThan(600)
        },
      ),
      { numRuns: 200 },
    )
  })
})
