/**
 * Property-Based Tests for the State_Delta_Engine — Delta Round-Trip
 *
 * Feature: photo-control, Property 6: Delta round-trip
 *
 * Property 6 (Delta round-trip): For any two arbitrary EditorState values
 * (original, target), `applyDelta(original, computeDelta(original, target))`
 * produces a state whose editable subset (angle, framing, lighting, garnishes,
 * sides, position) equals that of `target`. Non-editable fields
 * (`canvas.background`, `canvas.main_vessel`, `food_components.main_item`) are
 * carried over from `original` unchanged. The `isEmpty` flag on the delta is
 * true if and only if original and target have identical editable subsets.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property
 *
 * Validates: Requirements 9.1, 9.4
 */

import fc from 'fast-check'
import { computeDelta, applyDelta } from '../state-delta'
import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  FRAMING_VALUES,
  type AbstractCoordinate,
  type EditorState,
  type MinimalSchema,
} from '../minimal-schema'

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** Pick one value uniformly from a readonly tuple. */
function oneOf<T>(values: readonly T[]): fc.Arbitrary<T> {
  return fc.constantFrom(...values)
}

/**
 * An arbitrary AbstractCoordinate with both components clamped to [-1, 1].
 * We generate from the full [-1, 1] range (the valid editor space) so the
 * round-trip invariant is not confused by clamping side-effects.
 */
const coordArb: fc.Arbitrary<AbstractCoordinate> = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true }),
})

/**
 * An arbitrary string suitable for use as a garnish or side label.
 * Kept short and printable to keep test output readable.
 */
const componentStringArb = fc.string({ minLength: 1, maxLength: 20 })

/**
 * An arbitrary array of distinct component strings (garnishes or sides).
 * Distinctness mirrors the set semantics used by the delta engine.
 */
const componentArrayArb: fc.Arbitrary<string[]> = fc
  .array(componentStringArb, { minLength: 0, maxLength: 8 })
  .map((arr) => [...new Set(arr)])

/**
 * An arbitrary MinimalSchema. The non-editable fields (`canvas.background`,
 * `canvas.main_vessel`, `food_components.main_item`) are generated as
 * arbitrary strings so the round-trip test can verify they are carried over
 * from `original` unchanged.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the editable subset of an EditorState: the three enum scalars, the
 * two component arrays, and the position. This is the subset that
 * `computeDelta` / `applyDelta` operate on.
 */
function editableSubset(state: EditorState) {
  return {
    angle: state.schema.scene_setup.angle,
    framing: state.schema.scene_setup.framing,
    lighting: state.schema.scene_setup.lighting,
    garnishes: [...state.schema.food_components.garnishes].sort(),
    sides: [...state.schema.food_components.sides].sort(),
    position: state.position,
  }
}

/**
 * Whether two EditorStates have identical editable subsets (set-equal arrays,
 * component-wise equal position).
 */
function editableSubsetsEqual(a: EditorState, b: EditorState): boolean {
  const ea = editableSubset(a)
  const eb = editableSubset(b)
  return (
    ea.angle === eb.angle &&
    ea.framing === eb.framing &&
    ea.lighting === eb.lighting &&
    ea.garnishes.length === eb.garnishes.length &&
    ea.garnishes.every((v, i) => v === eb.garnishes[i]) &&
    ea.sides.length === eb.sides.length &&
    ea.sides.every((v, i) => v === eb.sides[i]) &&
    ea.position.x === eb.position.x &&
    ea.position.y === eb.position.y
  )
}

// ── Property 6: Delta round-trip ─────────────────────────────────────────────

describe('Feature: photo-control, Property 6: Delta round-trip', () => {
  /**
   * Core round-trip invariant (Requirements 9.1, 9.4):
   *
   * For any two EditorState values (original, target),
   * `applyDelta(original, computeDelta(original, target))` produces a state
   * whose editable subset equals that of `target`.
   *
   * This verifies that `computeDelta` captures ALL editable changes (Req 9.1)
   * and that `applyDelta` faithfully reproduces the target's editable subset
   * (Req 9.4).
   */
  it('applyDelta(original, computeDelta(original, target)) reproduces the editable subset of target', () => {
    fc.assert(
      fc.property(editorStateArb, editorStateArb, (original, target) => {
        const delta = computeDelta(original, target)
        const result = applyDelta(original, delta)

        const targetEditable = editableSubset(target)
        const resultEditable = editableSubset(result)

        // Enum scalars must match target.
        expect(resultEditable.angle).toBe(targetEditable.angle)
        expect(resultEditable.framing).toBe(targetEditable.framing)
        expect(resultEditable.lighting).toBe(targetEditable.lighting)

        // Component arrays must be set-equal to target (order-independent).
        expect(resultEditable.garnishes).toEqual(targetEditable.garnishes)
        expect(resultEditable.sides).toEqual(targetEditable.sides)

        // Position must match target component-wise.
        expect(resultEditable.position.x).toBe(targetEditable.position.x)
        expect(resultEditable.position.y).toBe(targetEditable.position.y)
      }),
      { numRuns: 300 },
    )
  })

  /**
   * Non-editable fields are carried over from `original` unchanged (Req 9.4):
   *
   * `canvas.background`, `canvas.main_vessel`, and
   * `food_components.main_item` are never touched by any control, so
   * `applyDelta` must preserve them from `original` regardless of `target`.
   */
  it('applyDelta carries non-editable fields from original unchanged', () => {
    fc.assert(
      fc.property(editorStateArb, editorStateArb, (original, target) => {
        const delta = computeDelta(original, target)
        const result = applyDelta(original, delta)

        expect(result.schema.canvas.background).toBe(original.schema.canvas.background)
        expect(result.schema.canvas.main_vessel).toBe(original.schema.canvas.main_vessel)
        expect(result.schema.food_components.main_item).toBe(
          original.schema.food_components.main_item,
        )
      }),
      { numRuns: 300 },
    )
  })

  /**
   * isEmpty is true if and only if the editable subsets are identical (Req 9.5):
   *
   * When original and target have the same angle, framing, lighting, garnishes
   * (set-equal), sides (set-equal), and position, the delta must be empty.
   * When they differ in any editable field, the delta must not be empty.
   */
  it('isEmpty is true iff original and target have identical editable subsets', () => {
    fc.assert(
      fc.property(editorStateArb, editorStateArb, (original, target) => {
        const delta = computeDelta(original, target)
        const subsetsEqual = editableSubsetsEqual(original, target)

        expect(delta.isEmpty).toBe(subsetsEqual)
      }),
      { numRuns: 300 },
    )
  })

  /**
   * Self-delta is always empty (Req 9.5 — idempotence):
   *
   * For any EditorState `s`, `computeDelta(s, s)` must produce an empty delta,
   * and `applyDelta(s, computeDelta(s, s))` must reproduce `s`'s editable
   * subset exactly.
   */
  it('computeDelta(s, s) is always empty and applyDelta reproduces s', () => {
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

        const result = applyDelta(s, delta)
        const original = editableSubset(s)
        const reproduced = editableSubset(result)

        expect(reproduced.angle).toBe(original.angle)
        expect(reproduced.framing).toBe(original.framing)
        expect(reproduced.lighting).toBe(original.lighting)
        expect(reproduced.garnishes).toEqual(original.garnishes)
        expect(reproduced.sides).toEqual(original.sides)
        expect(reproduced.position.x).toBe(original.position.x)
        expect(reproduced.position.y).toBe(original.position.y)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * applyDelta never mutates the original state:
   *
   * The original EditorState passed to `applyDelta` must be unchanged after
   * the call, confirming the engine is non-mutating.
   */
  it('applyDelta does not mutate the original state', () => {
    fc.assert(
      fc.property(editorStateArb, editorStateArb, (original, target) => {
        // Snapshot the original's editable subset before the call.
        const snapshotAngle = original.schema.scene_setup.angle
        const snapshotFraming = original.schema.scene_setup.framing
        const snapshotLighting = original.schema.scene_setup.lighting
        const snapshotGarnishes = [...original.schema.food_components.garnishes]
        const snapshotSides = [...original.schema.food_components.sides]
        const snapshotMainItem = original.schema.food_components.main_item
        const snapshotBackground = original.schema.canvas.background
        const snapshotMainVessel = original.schema.canvas.main_vessel
        const snapshotPosX = original.position.x
        const snapshotPosY = original.position.y

        const delta = computeDelta(original, target)
        applyDelta(original, delta)

        // Original must be unchanged.
        expect(original.schema.scene_setup.angle).toBe(snapshotAngle)
        expect(original.schema.scene_setup.framing).toBe(snapshotFraming)
        expect(original.schema.scene_setup.lighting).toBe(snapshotLighting)
        expect(original.schema.food_components.garnishes).toEqual(snapshotGarnishes)
        expect(original.schema.food_components.sides).toEqual(snapshotSides)
        expect(original.schema.food_components.main_item).toBe(snapshotMainItem)
        expect(original.schema.canvas.background).toBe(snapshotBackground)
        expect(original.schema.canvas.main_vessel).toBe(snapshotMainVessel)
        expect(original.position.x).toBe(snapshotPosX)
        expect(original.position.y).toBe(snapshotPosY)
      }),
      { numRuns: 200 },
    )
  })
})
