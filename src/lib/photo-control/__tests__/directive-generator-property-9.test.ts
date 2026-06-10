/**
 * Property-Based Tests for the Directive_Generator — Directive Determinism
 *
 * Feature: photo-control, Property 9: Directive determinism
 *
 * Property 9 (Directive determinism): For any delta `d` and context
 * `EditorState`, calling `generateDirective(d, context)` twice always returns
 * the exact same result — both null (for an empty delta) or both the same
 * non-empty string (for a non-empty delta). The function is a pure mapping
 * with no randomness, no I/O, and no mutable state.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * Validates: Requirements 9.6
 */

import fc from 'fast-check'
import { generateDirective } from '../directive-generator'
import { computeDelta } from '../state-delta'
import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  FRAMING_VALUES,
  CENTER,
  type AbstractCoordinate,
  type EditorState,
  type MinimalSchema,
  type StateDelta,
} from '../minimal-schema'

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** Pick one value uniformly from a readonly tuple. */
function oneOf<T>(values: readonly T[]): fc.Arbitrary<T> {
  return fc.constantFrom(...values)
}

/**
 * An arbitrary AbstractCoordinate with both components clamped to [-1, 1].
 */
const coordArb: fc.Arbitrary<AbstractCoordinate> = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true }),
})

/**
 * An arbitrary string suitable for use as a garnish or side label.
 */
const componentStringArb = fc.string({ minLength: 1, maxLength: 20 })

/**
 * An arbitrary array of distinct component strings (garnishes or sides).
 * Distinctness mirrors the set semantics used by the delta engine.
 */
const componentArrayArb: fc.Arbitrary<string[]> = fc
  .array(componentStringArb, { minLength: 0, maxLength: 6 })
  .map((arr) => [...new Set(arr)])

/**
 * An arbitrary MinimalSchema with valid enum values and arbitrary string fields.
 */
const minimalSchemaArb: fc.Arbitrary<MinimalSchema> = fc.record({
  scene_setup: fc.record({
    angle: oneOf(ANGLE_VALUES),
    framing: oneOf(FRAMING_VALUES),
    lighting: oneOf(LIGHTING_VALUES),
  }),
  canvas: fc.record({
    background: fc.string({ minLength: 0, maxLength: 30 }),
    main_vessel: fc.string({ minLength: 0, maxLength: 30 }),
  }),
  food_components: fc.record({
    main_item: fc.string({ minLength: 0, maxLength: 30 }),
    garnishes: componentArrayArb,
    sides: componentArrayArb,
  }),
})

/** An arbitrary EditorState (schema + position). */
const editorStateArb: fc.Arbitrary<EditorState> = fc.record({
  schema: minimalSchemaArb,
  position: coordArb,
})

/**
 * An arbitrary (delta, context) pair derived from two EditorStates.
 * The delta is computed from (original, target) so it is always structurally
 * consistent. The context is the original state (as used in production).
 */
const deltaContextPairArb: fc.Arbitrary<{ delta: StateDelta; context: EditorState }> =
  fc.tuple(editorStateArb, editorStateArb).map(([original, target]) => ({
    delta: computeDelta(original, target),
    context: original,
  }))

// ── Property 9: Directive determinism ────────────────────────────────────────

describe('Feature: photo-control, Property 9: Directive determinism', () => {
  /**
   * Core determinism property (Requirement 9.6):
   *
   * For any arbitrary (delta, context) pair, calling `generateDirective` twice
   * with the same arguments always returns the exact same value — both null or
   * both the same string.
   */
  it('generateDirective returns the same result on every call for any (delta, context) pair', () => {
    fc.assert(
      fc.property(deltaContextPairArb, ({ delta, context }) => {
        const first = generateDirective(delta, context)
        const second = generateDirective(delta, context)

        expect(first).toBe(second)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Determinism for empty deltas (Requirements 9.6, 5.4, 7.4, 8.6):
   *
   * For any EditorState `s`, the delta between `s` and `s` is empty, and
   * `generateDirective` returns null on every call — consistently.
   */
  it('generateDirective consistently returns null for any empty delta', () => {
    fc.assert(
      fc.property(editorStateArb, (s) => {
        const emptyDelta = computeDelta(s, s)

        expect(emptyDelta.isEmpty).toBe(true)

        const first = generateDirective(emptyDelta, s)
        const second = generateDirective(emptyDelta, s)

        expect(first).toBeNull()
        expect(second).toBeNull()
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Determinism for non-empty deltas (Requirement 9.6):
   *
   * For any pair of EditorStates that produce a non-empty delta, calling
   * `generateDirective` twice returns the same non-empty string both times.
   */
  it('generateDirective returns the same non-empty string on every call for non-empty deltas', () => {
    // Filter to pairs that produce a non-empty delta.
    const nonEmptyDeltaArb = fc
      .tuple(editorStateArb, editorStateArb)
      .filter(([original, target]) => !computeDelta(original, target).isEmpty)
      .map(([original, target]) => ({
        delta: computeDelta(original, target),
        context: original,
      }))

    fc.assert(
      fc.property(nonEmptyDeltaArb, ({ delta, context }) => {
        const first = generateDirective(delta, context)
        const second = generateDirective(delta, context)

        // Both calls must return the same non-null string.
        expect(first).not.toBeNull()
        expect(second).not.toBeNull()
        expect(first).toBe(second)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Same delta applied to the same context always produces the same directive
   * (Requirement 9.6):
   *
   * Calling `generateDirective` a third time still returns the same value,
   * confirming there is no hidden mutable state that degrades over repeated
   * calls.
   */
  it('repeated calls (3×) with the same inputs always return the same value', () => {
    fc.assert(
      fc.property(deltaContextPairArb, ({ delta, context }) => {
        const first = generateDirective(delta, context)
        const second = generateDirective(delta, context)
        const third = generateDirective(delta, context)

        expect(first).toBe(second)
        expect(second).toBe(third)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Determinism is independent of call interleaving (Requirement 9.6):
   *
   * Calling `generateDirective` with two different (delta, context) pairs in
   * alternating order still returns the same result for each pair as calling
   * them in sequence. This confirms no shared mutable state leaks between
   * invocations.
   */
  it('interleaved calls with different inputs do not affect each other', () => {
    fc.assert(
      fc.property(
        deltaContextPairArb,
        deltaContextPairArb,
        ({ delta: deltaA, context: contextA }, { delta: deltaB, context: contextB }) => {
          // Sequential baseline.
          const a1 = generateDirective(deltaA, contextA)
          const b1 = generateDirective(deltaB, contextB)

          // Interleaved: call B first, then A again.
          const b2 = generateDirective(deltaB, contextB)
          const a2 = generateDirective(deltaA, contextA)

          expect(a1).toBe(a2)
          expect(b1).toBe(b2)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Targeted: angle-change delta is deterministic (Requirement 9.6):
   *
   * A delta that changes only scene_setup.angle always produces the same
   * directive string regardless of how many times it is called.
   */
  it('angle-change directive is deterministic', () => {
    const angleChangeArb = fc
      .tuple(
        oneOf(ANGLE_VALUES),
        oneOf(ANGLE_VALUES),
        minimalSchemaArb,
      )
      .filter(([from, to]) => from !== to)
      .map(([fromAngle, toAngle, schema]) => {
        const original: EditorState = {
          schema: { ...schema, scene_setup: { ...schema.scene_setup, angle: fromAngle } },
          position: { ...CENTER },
        }
        const target: EditorState = {
          schema: { ...schema, scene_setup: { ...schema.scene_setup, angle: toAngle } },
          position: { ...CENTER },
        }
        return { delta: computeDelta(original, target), context: original }
      })

    fc.assert(
      fc.property(angleChangeArb, ({ delta, context }) => {
        const first = generateDirective(delta, context)
        const second = generateDirective(delta, context)

        expect(first).not.toBeNull()
        expect(first).toBe(second)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Targeted: lighting-change delta is deterministic (Requirement 9.6):
   *
   * A delta that changes only scene_setup.lighting always produces the same
   * directive string.
   */
  it('lighting-change directive is deterministic', () => {
    const [lightingA, lightingB] = LIGHTING_VALUES as unknown as [string, string]

    const lightingChangeArb = fc
      .tuple(fc.boolean(), minimalSchemaArb)
      .map(([flip, schema]) => {
        const fromLighting = flip ? lightingA : lightingB
        const toLighting = flip ? lightingB : lightingA
        const original: EditorState = {
          schema: {
            ...schema,
            scene_setup: {
              ...schema.scene_setup,
              lighting: fromLighting as (typeof LIGHTING_VALUES)[number],
            },
          },
          position: { ...CENTER },
        }
        const target: EditorState = {
          schema: {
            ...schema,
            scene_setup: {
              ...schema.scene_setup,
              lighting: toLighting as (typeof LIGHTING_VALUES)[number],
            },
          },
          position: { ...CENTER },
        }
        return { delta: computeDelta(original, target), context: original }
      })

    fc.assert(
      fc.property(lightingChangeArb, ({ delta, context }) => {
        const first = generateDirective(delta, context)
        const second = generateDirective(delta, context)

        expect(first).not.toBeNull()
        expect(first).toBe(second)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Targeted: array-change delta is deterministic (Requirement 9.6):
   *
   * A delta that adds or removes garnishes/sides always produces the same
   * directive string.
   */
  it('array-change directive is deterministic', () => {
    const arrayChangeArb = fc
      .tuple(editorStateArb, editorStateArb)
      .filter(([original, target]) => {
        const delta = computeDelta(original, target)
        return (
          delta.arrays.garnishes.added.length > 0 ||
          delta.arrays.garnishes.removed.length > 0 ||
          delta.arrays.sides.added.length > 0 ||
          delta.arrays.sides.removed.length > 0
        )
      })
      .map(([original, target]) => ({
        delta: computeDelta(original, target),
        context: original,
      }))

    fc.assert(
      fc.property(arrayChangeArb, ({ delta, context }) => {
        const first = generateDirective(delta, context)
        const second = generateDirective(delta, context)

        expect(first).not.toBeNull()
        expect(first).toBe(second)
      }),
      { numRuns: 100 },
    )
  })
})
