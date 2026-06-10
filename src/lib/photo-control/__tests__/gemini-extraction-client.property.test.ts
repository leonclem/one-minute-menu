/**
 * Property-Based Tests for the Gemini Extraction Client — Parse Helper
 *
 * Feature: photo-control, Property 2: Unparseable extraction response is signaled
 *
 * Property 2 (Unparseable extraction response is signaled): For any model
 * response body that is not parseable as JSON, `parseExtractionResponse` throws
 * an `UnparseableExtractionResponseError` that identifies the failure as an
 * unparseable response (and never returns a partial schema). For any response
 * body that IS valid JSON with an object at the root, the helper returns the
 * parsed object without throwing.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200+)
 *
 * Validates: Requirements 2.4
 */

import fc from 'fast-check'
import {
  parseExtractionResponse,
  UnparseableExtractionResponseError,
} from '../gemini-extraction-client'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Assert that calling `parseExtractionResponse(body)` throws an
 * `UnparseableExtractionResponseError` with the canonical error code.
 */
function expectUnparseableError(body: unknown): void {
  let threw = false
  try {
    parseExtractionResponse(body)
  } catch (err) {
    threw = true
    expect(err).toBeInstanceOf(UnparseableExtractionResponseError)
    expect((err as UnparseableExtractionResponseError).code).toBe(
      'UNPARSEABLE_EXTRACTION_RESPONSE',
    )
    expect((err as UnparseableExtractionResponseError).message).toBeTruthy()
  }
  expect(threw).toBe(true)
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Strings that are definitely NOT valid JSON.
 *
 * Covers the main categories of non-JSON text a model might return:
 *  - Arbitrary strings that are not valid JSON (filtered)
 *  - Prose / natural-language text
 *  - Partial / truncated JSON
 *  - Strings with only whitespace
 *  - Strings that look like JSON but have syntax errors
 *  - Markdown without a fenced code block
 */
const nonJsonStringArb: fc.Arbitrary<string> = fc.oneof(
  // Arbitrary strings that fail JSON.parse (filtered to exclude valid JSON).
  fc.string({ minLength: 1, maxLength: 200 }).filter((s) => {
    try {
      JSON.parse(s.trim())
      return false
    } catch {
      return true
    }
  }),
  // Prose text that is clearly not JSON.
  fc.constantFrom(
    'Here is the extracted scene data for your image.',
    'I cannot process this image.',
    'The food item appears to be a grilled salmon fillet.',
    'Error: model overloaded, please retry.',
    '',
    '   ',
    '\t\n\r',
    'undefined',
    'null',          // JSON null is not an object — should throw
    'true',          // JSON boolean is not an object — should throw
    'false',
    '42',            // JSON number is not an object — should throw
    '"a string"',    // JSON string is not an object — should throw
    '[1, 2, 3]',     // JSON array is not an object — should throw
    '{ bad json',
    '{ "key": }',
    '{ "key": "value"',
    '```\nnot json\n```',
    '```json\nnot json\n```',
    '```json\n{ bad }\n```',
  ),
  // Partial / truncated JSON objects (filtered to exclude accidentally valid JSON objects).
  fc.string({ minLength: 1, maxLength: 50 })
    .map((s) => '{' + s)
    .filter((s) => {
      try {
        const parsed = JSON.parse(s)
        // Exclude strings that parse to a plain object (those are valid and should be accepted)
        return parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
      } catch {
        return true // not valid JSON — keep it
      }
    }),
  // Strings with leading/trailing garbage around otherwise-valid JSON.
  fc.record({ a: fc.integer() }).map((obj) => 'prefix ' + JSON.stringify(obj) + ' suffix'),
)

/**
 * Non-string, non-object values that are not parseable as JSON objects.
 * Includes null, numbers, booleans, arrays, and undefined.
 */
const nonObjectPrimitiveArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.float(),
  fc.boolean(),
  fc.array(fc.anything()),
)

/**
 * Plain JavaScript objects (not arrays, not null) — these should be accepted
 * directly without throwing, since the HTTP layer may already have parsed them.
 */
const plainObjectArb: fc.Arbitrary<Record<string, unknown>> = fc
  .object({ maxDepth: 3 })
  .filter((o) => o !== null && typeof o === 'object' && !Array.isArray(o)) as fc.Arbitrary<
  Record<string, unknown>
>

/**
 * Valid JSON strings whose root value is a plain object.
 * These should be accepted and returned as the parsed object.
 */
const validJsonObjectStringArb: fc.Arbitrary<string> = plainObjectArb.map((obj) =>
  JSON.stringify(obj),
)

/**
 * Valid JSON strings whose root value is a plain object, wrapped in a markdown
 * fence. These should also be accepted (the helper strips fences).
 */
const fencedJsonObjectStringArb: fc.Arbitrary<string> = plainObjectArb.chain((obj) =>
  fc.constantFrom(
    '```json\n' + JSON.stringify(obj, null, 2) + '\n```',
    '```\n' + JSON.stringify(obj) + '\n```',
    '```json\n' + JSON.stringify(obj) + '\n```\n',
    '\n```json\n' + JSON.stringify(obj) + '\n```\n',
  ),
)

/**
 * A well-formed extraction response object with the three required top-level
 * keys. Used to confirm that a structurally correct response is accepted.
 */
const wellFormedExtractionObjectArb: fc.Arbitrary<Record<string, unknown>> = fc.record({
  scene_setup: fc.record({
    angle: fc.constantFrom('top-down', '45-degree', 'eye-level', 'macro-close-up'),
    framing: fc.constantFrom('close-up', 'medium', 'wide'),
    lighting: fc.constantFrom('low-key', 'bright-and-airy'),
  }),
  canvas: fc.record({
    background: fc.string({ maxLength: 40 }),
    main_vessel: fc.string({ maxLength: 40 }),
  }),
  food_components: fc.record({
    main_item: fc.string({ maxLength: 40 }),
    garnishes: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
    sides: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
  }),
})

// ── Property 2: Unparseable extraction response is signaled ──────────────────

describe('Feature: photo-control, Property 2: Unparseable extraction response is signaled', () => {
  /**
   * Core property — non-JSON strings always throw (Requirement 2.4):
   *
   * For any string that is not parseable as a JSON object (including empty
   * strings, prose, partial JSON, and strings that parse to non-object JSON
   * values), `parseExtractionResponse` throws an
   * `UnparseableExtractionResponseError` with the canonical error code.
   */
  it('throws UnparseableExtractionResponseError for any non-JSON string', () => {
    fc.assert(
      fc.property(nonJsonStringArb, (body) => {
        expectUnparseableError(body)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Non-string, non-object primitives always throw (Requirement 2.4):
   *
   * null, undefined, numbers, booleans, and arrays are not valid extraction
   * responses and must always produce an UnparseableExtractionResponseError.
   */
  it('throws UnparseableExtractionResponseError for non-string, non-object primitives', () => {
    fc.assert(
      fc.property(nonObjectPrimitiveArb, (body) => {
        expectUnparseableError(body)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * JSON strings whose root is not an object always throw (Requirement 2.4):
   *
   * Valid JSON that parses to null, a boolean, a number, a string, or an array
   * is not a valid extraction response and must throw.
   */
  it('throws UnparseableExtractionResponseError for JSON strings with non-object roots', () => {
    const nonObjectJsonArb = fc.oneof(
      fc.constant('null'),
      fc.constant('true'),
      fc.constant('false'),
      fc.integer().map(String),
      fc.float({ noNaN: true }).map((n) => JSON.stringify(n)),
      fc.string().map((s) => JSON.stringify(s)),
      fc.array(fc.anything()).map((a) => JSON.stringify(a)),
    )

    fc.assert(
      fc.property(nonObjectJsonArb, (body) => {
        expectUnparseableError(body)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Plain objects are accepted without throwing (Requirement 2.2):
   *
   * When the HTTP layer has already parsed the response body into a plain
   * JavaScript object, `parseExtractionResponse` returns it directly without
   * throwing. The returned value is the same object reference.
   */
  it('accepts plain objects without throwing and returns them', () => {
    fc.assert(
      fc.property(plainObjectArb, (body) => {
        let result: Record<string, unknown> | undefined
        expect(() => {
          result = parseExtractionResponse(body)
        }).not.toThrow()
        expect(result).toBe(body) // same reference — no copy
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Valid JSON object strings are accepted without throwing (Requirement 2.2):
   *
   * A JSON string whose root value is a plain object is parsed and returned as
   * the corresponding JavaScript object.
   */
  it('accepts valid JSON object strings without throwing and returns the parsed object', () => {
    fc.assert(
      fc.property(validJsonObjectStringArb, (body) => {
        let result: Record<string, unknown> | undefined
        expect(() => {
          result = parseExtractionResponse(body)
        }).not.toThrow()
        expect(result).toEqual(JSON.parse(body))
        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()
        expect(Array.isArray(result)).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Markdown-fenced JSON object strings are accepted without throwing:
   *
   * The Gemini model may wrap its JSON response in a markdown code fence.
   * `parseExtractionResponse` strips the fence and parses the inner JSON.
   */
  it('accepts markdown-fenced JSON object strings without throwing', () => {
    fc.assert(
      fc.property(fencedJsonObjectStringArb, (body) => {
        let result: Record<string, unknown> | undefined
        expect(() => {
          result = parseExtractionResponse(body)
        }).not.toThrow()
        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()
        expect(Array.isArray(result)).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Well-formed extraction responses are accepted and contain the three
   * required top-level keys (Requirement 2.2):
   *
   * For any well-formed extraction object (with scene_setup, canvas,
   * food_components), `parseExtractionResponse` returns the object with all
   * three keys present — both when passed as a plain object and as a JSON
   * string.
   */
  it('accepts well-formed extraction objects and preserves the three top-level keys', () => {
    fc.assert(
      fc.property(
        wellFormedExtractionObjectArb,
        fc.boolean(), // true = pass as object, false = pass as JSON string
        (obj, asObject) => {
          const body = asObject ? obj : JSON.stringify(obj)
          let result: Record<string, unknown> | undefined
          expect(() => {
            result = parseExtractionResponse(body)
          }).not.toThrow()
          expect(result).toHaveProperty('scene_setup')
          expect(result).toHaveProperty('canvas')
          expect(result).toHaveProperty('food_components')
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * The error is never swallowed — the function either returns a plain object
   * or throws; it never returns null, undefined, or a non-object value
   * (Requirement 2.4 — "never returns a partial schema"):
   *
   * For any input, the function either:
   *  (a) returns a non-null, non-array plain object, OR
   *  (b) throws an UnparseableExtractionResponseError.
   * There is no third outcome.
   */
  it('either returns a plain object or throws — never returns null, undefined, or a non-object', () => {
    const anyInputArb: fc.Arbitrary<unknown> = fc.oneof(
      fc.anything(),
      fc.string(),
      fc.json(),
      plainObjectArb,
    )

    fc.assert(
      fc.property(anyInputArb, (body) => {
        let result: unknown
        let threw = false
        let thrownError: unknown

        try {
          result = parseExtractionResponse(body)
        } catch (err) {
          threw = true
          thrownError = err
        }

        if (threw) {
          // Must be the canonical error type.
          expect(thrownError).toBeInstanceOf(UnparseableExtractionResponseError)
        } else {
          // Must be a non-null, non-array plain object.
          expect(result).not.toBeNull()
          expect(result).not.toBeUndefined()
          expect(typeof result).toBe('object')
          expect(Array.isArray(result)).toBe(false)
        }
      }),
      { numRuns: 300 },
    )
  })
})
