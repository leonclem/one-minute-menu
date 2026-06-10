/**
 * Property-Based Tests for Directive_Generator — Subject-Identity-Preservation Presence
 *
 * Feature: photo-control, Property 11: Subject-identity-preservation presence
 *
 * Property 11 (Subject-identity-preservation presence): For any non-empty delta,
 * the generated directive contains the subject-identity-preservation instruction
 * referencing the physical texture, shape, and structure of the main dish.
 *
 * Sub-properties verified:
 *  1. Every non-null directive contains the identity-preservation language
 *     ("Preserve the identity", "texture", "shape", "structure").
 *  2. When `context.schema.food_components.main_item` is a non-empty string,
 *     the directive references that item name.
 *  3. When `context.schema.food_components.main_item` is empty (or whitespace),
 *     the directive falls back to the generic subject reference "the main dish".
 *  4. `generateDirective` returns null for empty deltas (no identity clause
 *     is emitted for no-ops).
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * **Validates: Requirements 11.1**
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

/** An arbitrary AbstractCoordinate with both components in [-1, 1]. */
const coordArb: fc.Arbitrary<AbstractCoordinate> = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true }),
})

/** Short printable strings for component labels. */
const componentStringArb = fc.string({ minLength: 1, maxLength: 20 })

/** An array of distinct component strings (set semantics). */
const componentArrayArb: fc.Arbitrary<string[]> = fc
  .array(componentStringArb, { minLength: 0, maxLength: 6 })
  .map((arr) => [...new Set(arr)])

/**
 * An arbitrary MinimalSchema with a configurable `main_item`.
 * The non-editable fields are generated as arbitrary strings so the
 * identity-preservation clause can be verified against them.
 */
function minimalSchemaArb(mainItemArb: fc.Arbitrary<string>): fc.Arbitrary<MinimalSchema> {
  return fc.record({
    scene_setup: fc.record({
      angle: oneOf(ANGLE_VALUES),
      framing: oneOf(FRAMING_VALUES),
      lighting: oneOf(LIGHTING_VALUES),
    }),
    canvas: fc.record({
      background: fc.string({ minLength: 0, maxLength: 20 }),
      main_vessel: fc.string({ minLength: 0, maxLength: 20 }),
    }),
    food_components: fc.record({
      main_item: mainItemArb,
      garnishes: componentArrayArb,
      sides: componentArrayArb,
    }),
  })
}

/** An arbitrary EditorState with a non-empty main_item. */
const editorStateWithNamedItemArb: fc.Arbitrary<EditorState> = fc.record({
  schema: minimalSchemaArb(fc.string({ minLength: 1, maxLength: 30 }).map((s) => s.trim()).filter((s) => s.length > 0)),
  position: coordArb,
})

/** An arbitrary EditorState with an empty (or whitespace-only) main_item. */
const editorStateWithEmptyItemArb: fc.Arbitrary<EditorState> = fc.record({
  schema: minimalSchemaArb(
    fc.oneof(
      fc.constant(''),
      fc.string({ minLength: 1, maxLength: 10 }).map((s) => s.replace(/\S/g, ' ')), // whitespace-only
    ),
  ),
  position: coordArb,
})

/** An arbitrary EditorState with any main_item (empty or non-empty). */
const editorStateArb: fc.Arbitrary<EditorState> = fc.record({
  schema: minimalSchemaArb(fc.string({ minLength: 0, maxLength: 30 })),
  position: coordArb,
})

// ── Non-empty delta builders ─────────────────────────────────────────────────

/**
 * Build a non-empty StateDelta by computing the delta between two EditorStates
 * that differ in at least one editable field. We guarantee non-emptiness by
 * constructing a target that differs from the original in exactly one scalar
 * field (angle), so the delta is always non-empty.
 */
function makeNonEmptyDelta(context: EditorState): StateDelta {
  // Pick a different angle from the current one.
  const currentAngle = context.schema.scene_setup.angle
  const differentAngle = ANGLE_VALUES.find((v) => v !== currentAngle) ?? ANGLE_VALUES[0]

  const targetSchema: MinimalSchema = {
    ...context.schema,
    scene_setup: {
      ...context.schema.scene_setup,
      angle: differentAngle,
    },
    food_components: { ...context.schema.food_components },
    canvas: { ...context.schema.canvas },
  }
  const target: EditorState = { schema: targetSchema, position: { ...context.position } }
  return computeDelta(context, target)
}

/**
 * An arbitrary (non-empty delta, context) pair. The delta is guaranteed to be
 * non-empty because the target always differs from the original in angle.
 */
const nonEmptyDeltaWithContextArb: fc.Arbitrary<{ delta: StateDelta; context: EditorState }> =
  editorStateArb.map((context) => ({
    delta: makeNonEmptyDelta(context),
    context,
  }))

/** Same as above but with a named (non-empty) main_item. */
const nonEmptyDeltaWithNamedItemArb: fc.Arbitrary<{ delta: StateDelta; context: EditorState }> =
  editorStateWithNamedItemArb.map((context) => ({
    delta: makeNonEmptyDelta(context),
    context,
  }))

/** Same as above but with an empty/whitespace main_item. */
const nonEmptyDeltaWithEmptyItemArb: fc.Arbitrary<{ delta: StateDelta; context: EditorState }> =
  editorStateWithEmptyItemArb.map((context) => ({
    delta: makeNonEmptyDelta(context),
    context,
  }))

// ── Property 11: Subject-identity-preservation presence ──────────────────────

describe('Feature: photo-control, Property 11: Subject-identity-preservation presence', () => {
  /**
   * Sub-property 11.1a — Identity-preservation language is always present
   * (Requirement 11.1):
   *
   * For any non-empty delta, the generated directive is a non-null string that
   * contains all of the identity-preservation keywords: "Preserve the identity",
   * "texture", "shape", and "structure".
   */
  it('every non-null directive contains the identity-preservation language', () => {
    fc.assert(
      fc.property(nonEmptyDeltaWithContextArb, ({ delta, context }) => {
        // Precondition: the delta must be non-empty.
        expect(delta.isEmpty).toBe(false)

        const directive = generateDirective(delta, context)

        // A non-empty delta must produce a non-null directive.
        expect(directive).not.toBeNull()
        expect(typeof directive).toBe('string')
        expect((directive as string).length).toBeGreaterThan(0)

        // The directive must contain the identity-preservation keywords.
        expect(directive).toContain('Preserve the identity')
        expect(directive).toContain('texture')
        expect(directive).toContain('shape')
        expect(directive).toContain('structure')
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Sub-property 11.1b — Named main_item is referenced in the directive
   * (Requirement 11.1):
   *
   * When `context.schema.food_components.main_item` is a non-empty string,
   * the directive must reference that item name in the identity-preservation
   * clause.
   */
  it('directive references the main_item name when it is non-empty', () => {
    fc.assert(
      fc.property(nonEmptyDeltaWithNamedItemArb, ({ delta, context }) => {
        const mainItem = context.schema.food_components.main_item.trim()
        // Precondition: main_item is non-empty after trimming.
        expect(mainItem.length).toBeGreaterThan(0)

        const directive = generateDirective(delta, context)

        expect(directive).not.toBeNull()
        // The directive must contain the item name.
        expect(directive).toContain(mainItem)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Sub-property 11.1c — Falls back to "the main dish" when main_item is empty
   * (Requirement 11.1):
   *
   * When `context.schema.food_components.main_item` is empty or whitespace-only,
   * the directive must use the generic fallback "the main dish" in the
   * identity-preservation clause.
   */
  it('directive falls back to "the main dish" when main_item is empty or whitespace', () => {
    fc.assert(
      fc.property(nonEmptyDeltaWithEmptyItemArb, ({ delta, context }) => {
        const mainItem = context.schema.food_components.main_item.trim()
        // Precondition: main_item is empty after trimming.
        expect(mainItem.length).toBe(0)

        const directive = generateDirective(delta, context)

        expect(directive).not.toBeNull()
        // The directive must use the generic fallback.
        expect(directive).toContain('the main dish')
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Sub-property 11.1d — Empty delta produces null (no identity clause emitted
   * for no-ops):
   *
   * `generateDirective` must return null for an empty delta, so the
   * identity-preservation clause is never emitted for no-op changes.
   * (Requirements 5.4, 7.4, 8.6)
   */
  it('generateDirective returns null for an empty delta', () => {
    fc.assert(
      fc.property(editorStateArb, (state) => {
        // A self-delta is always empty.
        const emptyDelta = computeDelta(state, state)
        expect(emptyDelta.isEmpty).toBe(true)

        const directive = generateDirective(emptyDelta, state)
        expect(directive).toBeNull()
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Sub-property 11.1e — Identity clause is present across all change types:
   *
   * Verifies that the identity-preservation clause appears regardless of which
   * attribute changed (angle, lighting, position, garnish add/remove, side
   * add/remove). We exercise each change type individually to confirm the clause
   * is not accidentally omitted for any specific code path.
   */
  it('identity-preservation clause is present for every change type', () => {
    // Helper: build a base EditorState with a known main_item.
    const baseSchema: MinimalSchema = {
      scene_setup: { angle: '45-degree', framing: 'medium', lighting: 'low-key' },
      canvas: { background: 'dark wood', main_vessel: 'white plate' },
      food_components: { main_item: 'grilled salmon', garnishes: ['lemon'], sides: ['rice'] },
    }
    const base: EditorState = { schema: baseSchema, position: CENTER }

    const IDENTITY_KEYWORDS = ['Preserve the identity', 'texture', 'shape', 'structure']

    const assertIdentityPresent = (directive: string | null) => {
      expect(directive).not.toBeNull()
      for (const kw of IDENTITY_KEYWORDS) {
        expect(directive).toContain(kw)
      }
    }

    // Angle change
    const angleTarget: EditorState = {
      ...base,
      schema: { ...baseSchema, scene_setup: { ...baseSchema.scene_setup, angle: 'top-down' } },
    }
    assertIdentityPresent(generateDirective(computeDelta(base, angleTarget), base))

    // Lighting change (low-key → bright-and-airy)
    const lightingTarget: EditorState = {
      ...base,
      schema: {
        ...baseSchema,
        scene_setup: { ...baseSchema.scene_setup, lighting: 'bright-and-airy' },
      },
    }
    assertIdentityPresent(generateDirective(computeDelta(base, lightingTarget), base))

    // Lighting change (bright-and-airy → low-key)
    const brightBase: EditorState = {
      ...base,
      schema: {
        ...baseSchema,
        scene_setup: { ...baseSchema.scene_setup, lighting: 'bright-and-airy' },
      },
    }
    assertIdentityPresent(generateDirective(computeDelta(brightBase, base), brightBase))

    // Position change
    const posTarget: EditorState = { ...base, position: { x: 0.25, y: 0 } }
    assertIdentityPresent(generateDirective(computeDelta(base, posTarget), base))

    // Garnish removal
    const garnishRemoveTarget: EditorState = {
      ...base,
      schema: {
        ...baseSchema,
        food_components: { ...baseSchema.food_components, garnishes: [] },
      },
    }
    assertIdentityPresent(generateDirective(computeDelta(base, garnishRemoveTarget), base))

    // Garnish addition
    const garnishAddTarget: EditorState = {
      ...base,
      schema: {
        ...baseSchema,
        food_components: {
          ...baseSchema.food_components,
          garnishes: ['lemon', 'parsley'],
        },
      },
    }
    assertIdentityPresent(generateDirective(computeDelta(base, garnishAddTarget), base))

    // Side removal
    const sideRemoveTarget: EditorState = {
      ...base,
      schema: {
        ...baseSchema,
        food_components: { ...baseSchema.food_components, sides: [] },
      },
    }
    assertIdentityPresent(generateDirective(computeDelta(base, sideRemoveTarget), base))

    // Side addition
    const sideAddTarget: EditorState = {
      ...base,
      schema: {
        ...baseSchema,
        food_components: {
          ...baseSchema.food_components,
          sides: ['rice', 'salad'],
        },
      },
    }
    assertIdentityPresent(generateDirective(computeDelta(base, sideAddTarget), base))
  })
})
