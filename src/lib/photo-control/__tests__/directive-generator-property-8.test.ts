/**
 * Property-Based Tests for the Directive_Generator — Empty-Delta Idempotence
 *
 * Feature: photo-control, Property 8: Empty-delta idempotence
 *
 * Property 8 (Empty-delta idempotence): For any EditorState `s`,
 * `computeDelta(s, s)` yields an empty delta, and `generateDirective` returns
 * `null` for it. More broadly, whenever `delta.isEmpty` is true —
 * including selecting the current angle (Req 5.4), a layout action that
 * resolves to the same coordinate (Req 7.4), or a no-op add/remove (Req 8.6) —
 * `generateDirective` must return `null` and no mutation request is dispatched.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property
 *
 * **Validates: Requirements 5.4, 7.4, 8.6, 9.5**
 */

import fc from 'fast-check'
import { computeDelta } from '../state-delta'
import { generateDirective } from '../directive-generator'
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
 * An arbitrary AbstractCoordinate with both components in [-1, 1].
 */
const coordArb: fc.Arbitrary<AbstractCoordinate> = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true }),
})

/**
 * An arbitrary string suitable for a garnish or side label.
 */
const componentStringArb = fc.string({ minLength: 1, maxLength: 20 })

/**
 * An arbitrary array of distinct component strings (set semantics).
 */
const componentArrayArb: fc.Arbitrary<string[]> = fc
  .array(componentStringArb, { minLength: 0, maxLength: 8 })
  .map((arr) => [...new Set(arr)])

/**
 * An arbitrary MinimalSchema.
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
    main_item: fc.string({ minLength: 1, maxLength: 30 }),
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
 * Build a minimal but valid EditorState from explicit values.
 */
function makeState(overrides: {
  angle?: (typeof ANGLE_VALUES)[number]
  lighting?: (typeof LIGHTING_VALUES)[number]
  framing?: (typeof FRAMING_VALUES)[number]
  garnishes?: string[]
  sides?: string[]
  position?: AbstractCoordinate
  mainItem?: string
}): EditorState {
  const schema: MinimalSchema = {
    scene_setup: {
      angle: overrides.angle ?? '45-degree',
      lighting: overrides.lighting ?? 'low-key',
      framing: overrides.framing ?? 'close-up',
    },
    canvas: { background: 'white', main_vessel: 'plate' },
    food_components: {
      main_item: overrides.mainItem ?? 'salmon',
      garnishes: overrides.garnishes ?? [],
      sides: overrides.sides ?? [],
    },
  }
  return { schema, position: overrides.position ?? { ...CENTER } }
}

/**
 * Build an explicitly empty StateDelta (isEmpty = true).
 * Used to test that generateDirective returns null for any empty delta,
 * regardless of how it was constructed.
 */
function makeEmptyDelta(): StateDelta {
  return {
    scalarChanges: [],
    arrays: {
      garnishes: { added: [], removed: [] },
      sides: { added: [], removed: [] },
    },
    isEmpty: true,
  }
}

// ── Property 8: Empty-delta idempotence ──────────────────────────────────────

describe('Feature: photo-control, Property 8: Empty-delta idempotence', () => {
  /**
   * Core idempotence: computeDelta(s, s) is always empty (Requirement 9.5).
   *
   * For any EditorState `s`, diffing the state against itself must produce a
   * delta with isEmpty = true and no recorded changes in any field.
   */
  it('computeDelta(s, s) always produces an empty delta', () => {
    fc.assert(
      fc.property(editorStateArb, (s) => {
        const delta = computeDelta(s, s)

        expect(delta.isEmpty).toBe(true)
        expect(delta.scalarChanges).toHaveLength(0)
        expect(delta.arrays.garnishes.added).toHaveLength(0)
        expect(delta.arrays.garnishes.removed).toHaveLength(0)
        expect(delta.arrays.sides.added).toHaveLength(0)
        expect(delta.arrays.sides.removed).toHaveLength(0)
        expect(delta.position).toBeUndefined()
      }),
      { numRuns: 200 },
    )
  })

  /**
   * generateDirective returns null for computeDelta(s, s) (Requirements 9.5, 5.4, 7.4, 8.6).
   *
   * For any EditorState `s`, the self-delta is empty, and generateDirective
   * must return null — no directive is generated for a no-op change.
   */
  it('generateDirective returns null for computeDelta(s, s)', () => {
    fc.assert(
      fc.property(editorStateArb, (s) => {
        const delta = computeDelta(s, s)
        const directive = generateDirective(delta, s)

        expect(directive).toBeNull()
      }),
      { numRuns: 200 },
    )
  })

  /**
   * generateDirective returns null for any delta with isEmpty = true (Requirement 9.5).
   *
   * The isEmpty flag is the authoritative signal. Regardless of how the empty
   * delta was produced, generateDirective must return null whenever isEmpty is
   * true.
   */
  it('generateDirective returns null for any delta where isEmpty is true', () => {
    fc.assert(
      fc.property(editorStateArb, (context) => {
        const emptyDelta = makeEmptyDelta()
        const directive = generateDirective(emptyDelta, context)

        expect(directive).toBeNull()
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Requirement 5.4 — no directive for same angle.
   *
   * When the user selects the angle value already set on the current state,
   * computeDelta produces an empty delta and generateDirective returns null.
   */
  it('selecting the current angle produces an empty delta and null directive (Req 5.4)', () => {
    fc.assert(
      fc.property(editorStateArb, (s) => {
        // Build a target state identical to the original — same angle.
        const target = makeState({
          angle: s.schema.scene_setup.angle,
          lighting: s.schema.scene_setup.lighting,
          framing: s.schema.scene_setup.framing,
          garnishes: [...s.schema.food_components.garnishes],
          sides: [...s.schema.food_components.sides],
          position: { ...s.position },
          mainItem: s.schema.food_components.main_item,
        })

        const delta = computeDelta(s, target)
        expect(delta.isEmpty).toBe(true)

        const directive = generateDirective(delta, s)
        expect(directive).toBeNull()
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Requirement 5.4 — angle-only same-value selection.
   *
   * Directly: for any angle value, building original and target with the same
   * angle (and all other fields equal) yields isEmpty = true and null directive.
   */
  it('angle-only same-value: isEmpty = true and directive = null (Req 5.4)', () => {
    fc.assert(
      fc.property(oneOf(ANGLE_VALUES), oneOf(LIGHTING_VALUES), oneOf(FRAMING_VALUES), (angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing })
        const target = makeState({ angle, lighting, framing })

        const delta = computeDelta(original, target)
        expect(delta.isEmpty).toBe(true)

        const directive = generateDirective(delta, original)
        expect(directive).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Requirement 7.4 — no directive when layout action resolves to same coordinate.
   *
   * When the target position equals the original position, the delta has no
   * position change, isEmpty is true (assuming no other changes), and
   * generateDirective returns null.
   */
  it('same-position layout action produces an empty delta and null directive (Req 7.4)', () => {
    fc.assert(
      fc.property(coordArb, oneOf(ANGLE_VALUES), oneOf(LIGHTING_VALUES), oneOf(FRAMING_VALUES), (pos, angle, lighting, framing) => {
        const original = makeState({ angle, lighting, framing, position: pos })
        // Target has the same position — simulates a layout action that resolves
        // to the current coordinate (e.g. pressing Center when already centered).
        const target = makeState({ angle, lighting, framing, position: { ...pos } })

        const delta = computeDelta(original, target)
        expect(delta.isEmpty).toBe(true)
        expect(delta.position).toBeUndefined()

        const directive = generateDirective(delta, original)
        expect(directive).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Requirement 8.6 — no directive for a no-op add/remove.
   *
   * When the garnishes and sides arrays are identical between original and
   * target (and all other fields are equal), the delta is empty and
   * generateDirective returns null.
   */
  it('no-op array operation produces an empty delta and null directive (Req 8.6)', () => {
    fc.assert(
      fc.property(
        componentArrayArb,
        componentArrayArb,
        oneOf(ANGLE_VALUES),
        oneOf(LIGHTING_VALUES),
        oneOf(FRAMING_VALUES),
        (garnishes, sides, angle, lighting, framing) => {
          const original = makeState({ angle, lighting, framing, garnishes, sides })
          // Target has the same arrays — no add or remove occurred.
          const target = makeState({
            angle,
            lighting,
            framing,
            garnishes: [...garnishes],
            sides: [...sides],
          })

          const delta = computeDelta(original, target)
          expect(delta.isEmpty).toBe(true)
          expect(delta.arrays.garnishes.added).toHaveLength(0)
          expect(delta.arrays.garnishes.removed).toHaveLength(0)
          expect(delta.arrays.sides.added).toHaveLength(0)
          expect(delta.arrays.sides.removed).toHaveLength(0)

          const directive = generateDirective(delta, original)
          expect(directive).toBeNull()
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Sanity check: non-empty deltas do NOT return null.
   *
   * When the angle actually changes, generateDirective must return a non-null
   * string. This guards against a trivially-passing implementation that always
   * returns null.
   */
  it('generateDirective returns a non-null string for a non-empty angle-change delta', () => {
    fc.assert(
      fc.property(oneOf(ANGLE_VALUES), oneOf(LIGHTING_VALUES), oneOf(FRAMING_VALUES), (fromAngle, lighting, framing) => {
        // Pick a different angle.
        const toAngle = ANGLE_VALUES.find((v) => v !== fromAngle)
        if (toAngle === undefined) return // only one angle value — skip (shouldn't happen)

        const original = makeState({ angle: fromAngle, lighting, framing })
        const target = makeState({ angle: toAngle, lighting, framing })

        const delta = computeDelta(original, target)
        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, original)
        expect(directive).not.toBeNull()
        expect(typeof directive).toBe('string')
        expect((directive as string).length).toBeGreaterThan(0)
      }),
      { numRuns: 100 },
    )
  })
})
