/**
 * Property-Based Tests for the Image_Uploader
 *
 * Feature: photo-control, Property 1: Upload validation by type and size
 *
 * Property 1 (Upload validation by type and size): For any file with an
 * arbitrary MIME type and byte size, `validateAndAcceptImage` accepts it if and
 * only if its MIME type is one of `image/png`, `image/jpeg`, `image/webp` AND
 * its size is at most 7 MB; every rejection returns a non-empty error message,
 * and the message names the allowed types when rejection is due to type and
 * states the 7 MB limit when rejection is due to size.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import fc from 'fast-check'
import {
  validateAndAcceptImage,
  ALLOWED_MIME,
  MAX_IMAGE_BYTES,
  type AllowedMimeType,
} from '../image-uploader'

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME)
const MAX_MB = MAX_IMAGE_BYTES / (1024 * 1024)

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** An arbitrary valid MIME type (one of the three accepted types). */
const allowedMimeArb: fc.Arbitrary<AllowedMimeType> = fc.constantFrom(...ALLOWED_MIME)

/**
 * An arbitrary MIME type string that is NOT in the allowed set.
 * We generate from a broad set of realistic and unrealistic MIME strings.
 */
const disallowedMimeArb: fc.Arbitrary<string> = fc
  .oneof(
    fc.constantFrom(
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/svg+xml',
      'image/avif',
      'image/heic',
      'video/mp4',
      'application/pdf',
      'text/plain',
      'application/octet-stream',
      '',
    ),
    // Arbitrary strings that are very unlikely to be in the allowed set.
    fc.string({ minLength: 1, maxLength: 40 }).filter((s) => !ALLOWED_MIME_SET.has(s)),
  )

/** An arbitrary file size within the allowed range (0 to MAX_IMAGE_BYTES inclusive). */
const validSizeArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: MAX_IMAGE_BYTES })

/**
 * An arbitrary file size that exceeds the limit.
 * We cap at 100 MB to keep the test fast.
 */
const oversizedArb: fc.Arbitrary<number> = fc.integer({
  min: MAX_IMAGE_BYTES + 1,
  max: 100 * 1024 * 1024,
})

/** A minimal data URL placeholder (content is irrelevant for validation). */
const dataUrlArb: fc.Arbitrary<string> = fc.constant('data:image/png;base64,abc123')

// ── Feature: photo-control, Property 1: Upload validation by type and size ──

describe('Feature: photo-control, Property 1: Upload validation by type and size', () => {
  /**
   * Acceptance invariant (Requirements 1.1):
   *
   * For any allowed MIME type and any size within the limit, the file is
   * accepted (`ok: true`) and `sourceImage` is populated with the correct
   * mimeType and bytes.
   */
  it('accepts files with an allowed MIME type and size within the limit', () => {
    fc.assert(
      fc.property(allowedMimeArb, validSizeArb, dataUrlArb, (mimeType, size, dataUrl) => {
        const result = validateAndAcceptImage({ type: mimeType, size }, dataUrl)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.sourceImage.mimeType).toBe(mimeType)
          expect(result.sourceImage.bytes).toBe(size)
          expect(result.sourceImage.dataUrl).toBe(dataUrl)
          expect(result.error).toBeUndefined()
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Type-rejection invariant (Requirement 1.2):
   *
   * For any disallowed MIME type (regardless of size), the file is rejected
   * (`ok: false`) with a non-empty error message that names the allowed types.
   */
  it('rejects files with a disallowed MIME type and names the allowed types in the error', () => {
    fc.assert(
      fc.property(disallowedMimeArb, validSizeArb, dataUrlArb, (mimeType, size, dataUrl) => {
        const result = validateAndAcceptImage({ type: mimeType, size }, dataUrl)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(typeof result.error).toBe('string')
          expect(result.error.length).toBeGreaterThan(0)
          expect(result.sourceImage).toBeUndefined()

          // The error message must name each of the allowed types. (Req 1.2)
          for (const allowed of ALLOWED_MIME) {
            expect(result.error).toContain(allowed)
          }
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Size-rejection invariant (Requirement 1.3):
   *
   * For any allowed MIME type and any size exceeding the limit, the file is
   * rejected (`ok: false`) with a non-empty error message that states the 7 MB
   * limit.
   */
  it('rejects oversized files and states the 7 MB limit in the error', () => {
    fc.assert(
      fc.property(allowedMimeArb, oversizedArb, dataUrlArb, (mimeType, size, dataUrl) => {
        const result = validateAndAcceptImage({ type: mimeType, size }, dataUrl)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(typeof result.error).toBe('string')
          expect(result.error.length).toBeGreaterThan(0)
          expect(result.sourceImage).toBeUndefined()

          // The error message must state the 7 MB limit. (Req 1.3)
          expect(result.error).toContain(`${MAX_MB}`)
          expect(result.error).toContain('MB')
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Accept-or-reject completeness (Requirements 1.1, 1.2, 1.3):
   *
   * For any combination of MIME type and size, the result is either accepted
   * (allowed type AND within limit) or rejected (disallowed type OR over limit).
   * There is no third outcome.
   */
  it('accepts iff MIME type is allowed AND size is within the limit', () => {
    fc.assert(
      fc.property(
        fc.oneof(allowedMimeArb, disallowedMimeArb),
        fc.oneof(validSizeArb, oversizedArb),
        dataUrlArb,
        (mimeType, size, dataUrl) => {
          const result = validateAndAcceptImage({ type: mimeType, size }, dataUrl)

          const typeAllowed = ALLOWED_MIME_SET.has(mimeType)
          const sizeAllowed = size <= MAX_IMAGE_BYTES
          const shouldAccept = typeAllowed && sizeAllowed

          expect(result.ok).toBe(shouldAccept)

          if (result.ok) {
            expect(result.sourceImage).toBeDefined()
            expect(result.error).toBeUndefined()
          } else {
            expect(result.error).toBeDefined()
            expect(typeof result.error).toBe('string')
            expect(result.error!.length).toBeGreaterThan(0)
            expect(result.sourceImage).toBeUndefined()
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Operational-rejection invariant (Requirement 1.7):
   *
   * When an `operationalReason` is supplied, an otherwise-valid file is still
   * rejected with a non-empty error message naming the reason.
   */
  it('rejects an otherwise-valid file when an operational reason is supplied', () => {
    fc.assert(
      fc.property(
        allowedMimeArb,
        validSizeArb,
        dataUrlArb,
        fc.string({ minLength: 1, maxLength: 80 }),
        (mimeType, size, dataUrl, reason) => {
          const result = validateAndAcceptImage({ type: mimeType, size }, dataUrl, reason)

          expect(result.ok).toBe(false)
          if (!result.ok) {
            expect(result.error).toBe(reason)
            expect(result.sourceImage).toBeUndefined()
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
