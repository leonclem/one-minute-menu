/**
 * Property-Based Tests for the Prompt Composer — Composition-Failure Signaling
 *
 * Feature: photo-control, Property 15: Composition-failure signaling
 *
 * Property 15 (Composition-failure signaling): For any `CompositionInput`
 * where a required component is missing or invalid, `composePrompt` returns
 * `{ ok: false, code: 'COMPOSITION_FAILURE', error: <non-empty string> }`.
 * The function never returns `ok: true` when a required component is absent
 * or unencodable.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * Validates: Requirements 10.6
 */

import fc from 'fast-check'
import {
  composePrompt,
  type CompositionInput,
  type CompositionResult,
} from '../prompt-composer'
import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  FRAMING_VALUES,
  type MinimalSchema,
} from '../minimal-schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Assert that a `CompositionResult` is a well-formed composition failure:
 *  - `ok` is `false`
 *  - `code` is `'COMPOSITION_FAILURE'`
 *  - `error` is a non-empty string
 */
function expectCompositionFailure(result: CompositionResult): void {
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.code).toBe('COMPOSITION_FAILURE')
    expect(typeof result.error).toBe('string')
    expect(result.error.length).toBeGreaterThan(0)
  }
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * A valid `MinimalSchema` object with all required fields populated using
 * values drawn from the canonical enum sets.
 */
const validMinimalSchemaArb: fc.Arbitrary<MinimalSchema> = fc.record({
  scene_setup: fc.record({
    angle: fc.constantFrom(...ANGLE_VALUES),
    framing: fc.constantFrom(...FRAMING_VALUES),
    lighting: fc.constantFrom(...LIGHTING_VALUES),
  }),
  canvas: fc.record({
    background: fc.string({ minLength: 1, maxLength: 40 }),
    main_vessel: fc.string({ minLength: 1, maxLength: 40 }),
  }),
  food_components: fc.record({
    main_item: fc.string({ minLength: 1, maxLength: 40 }),
    garnishes: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
    sides: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
  }),
})

/**
 * A valid directive string — non-empty, non-whitespace-only.
 */
const validDirectiveArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)

/**
 * Invalid directive values: empty string, whitespace-only strings, and
 * non-string primitives (null, undefined, number, boolean).
 */
const invalidDirectiveArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t\n'),
  fc.constant('\n\n\n'),
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.boolean(),
)

// ── Property 15: Composition-failure signaling ────────────────────────────────

describe('Feature: photo-control, Property 15: Composition-failure signaling', () => {
  /**
   * Missing/empty directive signals failure (Requirement 10.6):
   *
   * For any `CompositionInput` where `directive` is empty, whitespace-only,
   * or a non-string value (null, undefined, number, boolean), `composePrompt`
   * returns `{ ok: false, code: 'COMPOSITION_FAILURE' }` with a non-empty
   * error message.
   */
  it('returns COMPOSITION_FAILURE for any missing or empty directive', () => {
    fc.assert(
      fc.property(
        invalidDirectiveArb,
        validMinimalSchemaArb,
        validMinimalSchemaArb,
        (directive, originalState, targetState) => {
          const input = {
            directive,
            originalState,
            targetState,
          } as unknown as CompositionInput

          const result = composePrompt(input)
          expectCompositionFailure(result)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Missing originalState signals failure (Requirement 10.6):
   *
   * For any `CompositionInput` where `originalState` is null or undefined
   * (but directive is valid and targetState is valid), `composePrompt` returns
   * `{ ok: false, code: 'COMPOSITION_FAILURE' }` with a non-empty error message.
   */
  it('returns COMPOSITION_FAILURE when originalState is null or undefined', () => {
    const missingOriginalStateArb: fc.Arbitrary<null | undefined> = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
    )

    fc.assert(
      fc.property(
        validDirectiveArb,
        missingOriginalStateArb,
        validMinimalSchemaArb,
        (directive, originalState, targetState) => {
          const input = {
            directive,
            originalState,
            targetState,
          } as unknown as CompositionInput

          const result = composePrompt(input)
          expectCompositionFailure(result)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Missing targetState signals failure (Requirement 10.6):
   *
   * For any `CompositionInput` where `targetState` is null or undefined
   * (but directive is valid and originalState is valid), `composePrompt` returns
   * `{ ok: false, code: 'COMPOSITION_FAILURE' }` with a non-empty error message.
   */
  it('returns COMPOSITION_FAILURE when targetState is null or undefined', () => {
    const missingTargetStateArb: fc.Arbitrary<null | undefined> = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
    )

    fc.assert(
      fc.property(
        validDirectiveArb,
        validMinimalSchemaArb,
        missingTargetStateArb,
        (directive, originalState, targetState) => {
          const input = {
            directive,
            originalState,
            targetState,
          } as unknown as CompositionInput

          const result = composePrompt(input)
          expectCompositionFailure(result)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Failure result shape invariant (Requirement 10.6):
   *
   * For any input that produces a failure, the result always has:
   *  - `ok` === `false`
   *  - `code` === `'COMPOSITION_FAILURE'`
   *  - `error` is a non-empty string
   *
   * The result never has `ok: true` when a required component is missing.
   * This property exercises all failure-inducing input combinations together.
   */
  it('failure result always has ok=false, code=COMPOSITION_FAILURE, and a non-empty error string', () => {
    // Combine all failure-inducing input shapes into one arbitrary.
    const failureInputArb: fc.Arbitrary<CompositionInput> = fc.oneof(
      // Missing directive
      fc.record({
        directive: invalidDirectiveArb as fc.Arbitrary<string>,
        originalState: validMinimalSchemaArb,
        targetState: validMinimalSchemaArb,
      }) as unknown as fc.Arbitrary<CompositionInput>,
      // Missing originalState
      fc.record({
        directive: validDirectiveArb,
        originalState: fc.oneof(fc.constant(null), fc.constant(undefined)) as fc.Arbitrary<MinimalSchema>,
        targetState: validMinimalSchemaArb,
      }) as unknown as fc.Arbitrary<CompositionInput>,
      // Missing targetState
      fc.record({
        directive: validDirectiveArb,
        originalState: validMinimalSchemaArb,
        targetState: fc.oneof(fc.constant(null), fc.constant(undefined)) as fc.Arbitrary<MinimalSchema>,
      }) as unknown as fc.Arbitrary<CompositionInput>,
    )

    fc.assert(
      fc.property(failureInputArb, (input) => {
        const result = composePrompt(input)

        // The result must always be a failure — never ok: true.
        expect(result.ok).toBe(false)

        if (!result.ok) {
          expect(result.code).toBe('COMPOSITION_FAILURE')
          expect(typeof result.error).toBe('string')
          expect(result.error.length).toBeGreaterThan(0)
          // Confirm the result does NOT have ok: true
          expect(result).not.toMatchObject({ ok: true })
        }
      }),
      { numRuns: 200 },
    )
  })
})
