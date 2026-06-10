/**
 * Property-Based Tests for the UI_State_Hydrator
 *
 * Feature: photo-control, Property 4: Hydration round-trip
 *
 * Property 4 (Hydration round-trip): For any valid `Minimal_Schema` instance,
 * hydrating the controls and then serializing the controllable subset of
 * `Editor_State` (angle, lighting, garnishes, sides) reproduces the controllable
 * subset of the original schema, including one removable component entry per
 * garnish and per side.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * Validates: Requirements 4.2, 4.3, 4.4, 3.7
 */

import fc from 'fast-check'
import { hydrate, hydrateFromSchema } from '../hydrator'
import { validateMinimalSchema } from '../schema-validator'
import {
  ANGLE_VALUES,
  LIGHTING_VALUES,
  FRAMING_VALUES,
  CENTER,
  MinimalSchemaZ,
  type MinimalSchema,
} from '../minimal-schema'

// ── Arbitraries ──────────────────────────────────────────────────────────────

/** Pick one value uniformly from a readonly tuple. */
function oneOf<T>(values: readonly T[]): fc.Arbitrary<T> {
  return fc.constantFrom(...values)
}

/** An arbitrary string suitable for a garnish or side label. */
const componentStringArb = fc.string({ minLength: 1, maxLength: 24 })

/**
 * An arbitrary array of distinct component strings (garnishes or sides).
 * Distinctness mirrors the set semantics used by the editor.
 */
const componentArrayArb: fc.Arbitrary<string[]> = fc
  .array(componentStringArb, { minLength: 0, maxLength: 8 })
  .map((arr) => [...new Set(arr)])

/**
 * An arbitrary valid `MinimalSchema` — all enum fields are in-set, all string
 * fields are non-empty strings, and garnishes/sides are arrays of distinct
 * strings. (Requirement 3.7)
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

// ── Feature: photo-control, Property 4: Hydration round-trip ─────────────────

describe('Feature: photo-control, Property 4: Hydration round-trip', () => {
  /**
   * Core round-trip invariant (Requirements 4.2, 4.3, 4.4):
   *
   * For any valid `MinimalSchema`, hydrating it and reading back the
   * controllable subset of `EditorState` (angle, lighting, garnishes, sides)
   * reproduces the original schema values exactly.
   */
  it('hydrating a schema reproduces the controllable subset of the original schema', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        const { editorState, components } = hydrateFromSchema(schema)

        // Requirement 4.2 — Camera_Control = scene_setup.angle
        expect(editorState.schema.scene_setup.angle).toBe(schema.scene_setup.angle)

        // Requirement 4.3 — Lighting_Control = scene_setup.lighting
        expect(editorState.schema.scene_setup.lighting).toBe(schema.scene_setup.lighting)

        // Requirement 4.4 — one entry per garnish and per side
        const garnishEntries = components.filter((c) => c.kind === 'garnish')
        const sideEntries = components.filter((c) => c.kind === 'side')

        expect(garnishEntries).toHaveLength(schema.food_components.garnishes.length)
        expect(sideEntries).toHaveLength(schema.food_components.sides.length)

        // Labels match the original arrays in order.
        for (let i = 0; i < schema.food_components.garnishes.length; i++) {
          expect(garnishEntries[i].label).toBe(schema.food_components.garnishes[i])
        }
        for (let i = 0; i < schema.food_components.sides.length; i++) {
          expect(sideEntries[i].label).toBe(schema.food_components.sides[i])
        }

        // Total component count = garnishes + sides.
        expect(components).toHaveLength(
          schema.food_components.garnishes.length + schema.food_components.sides.length,
        )
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Position defaults to CENTER (Design: hydrator initializes position to
   * center { x: 0, y: 0 }):
   *
   * For any valid schema, the hydrated `EditorState.position` is always `CENTER`.
   */
  it('initializes position to CENTER for any schema', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        const { editorState } = hydrateFromSchema(schema)

        expect(editorState.position.x).toBe(CENTER.x)
        expect(editorState.position.y).toBe(CENTER.y)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Hydrated EditorState validates against MinimalSchemaZ (Requirement 3.7,
   * 4.2, 4.3, 4.4):
   *
   * The schema embedded in the hydrated `EditorState` must always satisfy the
   * `MinimalSchemaZ` Zod schema, confirming it is always hydratable.
   */
  it('the hydrated EditorState schema always satisfies MinimalSchemaZ', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        const { editorState } = hydrateFromSchema(schema)

        const parseResult = MinimalSchemaZ.safeParse(editorState.schema)
        expect(parseResult.success).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Garnishes and sides are arrays of strings (Requirement 3.7):
   *
   * The hydrated `EditorState.schema.food_components.garnishes` and `.sides`
   * are always arrays of strings.
   */
  it('garnishes and sides in the hydrated state are arrays of strings', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        const { editorState } = hydrateFromSchema(schema)

        expect(Array.isArray(editorState.schema.food_components.garnishes)).toBe(true)
        expect(Array.isArray(editorState.schema.food_components.sides)).toBe(true)

        for (const g of editorState.schema.food_components.garnishes) {
          expect(typeof g).toBe('string')
        }
        for (const s of editorState.schema.food_components.sides) {
          expect(typeof s).toBe('string')
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Component entries are ordered: garnishes first, then sides (Requirement 4.4):
   *
   * The `components` array always lists all garnish entries before any side
   * entries, preserving the original array order within each group.
   */
  it('component entries list garnishes before sides in original order', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        const { components } = hydrateFromSchema(schema)

        const garnishCount = schema.food_components.garnishes.length
        const sideCount = schema.food_components.sides.length

        // First `garnishCount` entries are garnishes.
        for (let i = 0; i < garnishCount; i++) {
          expect(components[i].kind).toBe('garnish')
          expect(components[i].label).toBe(schema.food_components.garnishes[i])
        }
        // Remaining `sideCount` entries are sides.
        for (let i = 0; i < sideCount; i++) {
          expect(components[garnishCount + i].kind).toBe('side')
          expect(components[garnishCount + i].label).toBe(schema.food_components.sides[i])
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * hydrate() and hydrateFromSchema() produce identical results (Requirement 4.1):
   *
   * `hydrate(validated)` must produce the same result as
   * `hydrateFromSchema(validated.data)` for any valid `MinimalValidationResult`.
   * This confirms that `hydrate` ignores `strictConformance` and reads only
   * `data`. (Requirement 4.1)
   */
  it('hydrate(validated) produces the same result as hydrateFromSchema(validated.data)', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        // Build a MinimalValidationResult by running the real validator on the
        // schema (which is already valid, so strictConformance will be true).
        const validated = validateMinimalSchema(schema)

        const fromValidated = hydrate(validated)
        const fromSchema = hydrateFromSchema(validated.data)

        // EditorState must be identical.
        expect(fromValidated.editorState.schema).toEqual(fromSchema.editorState.schema)
        expect(fromValidated.editorState.position).toEqual(fromSchema.editorState.position)

        // Component entries must be identical.
        expect(fromValidated.components).toEqual(fromSchema.components)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * hydrate() ignores strictConformance (Requirement 4.1):
   *
   * When the validator coerces enum values (strictConformance = false), hydration
   * still proceeds from the coerced `data` and produces a valid EditorState.
   */
  it('hydrate() initializes EditorState from coerced data regardless of strictConformance', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        // Inject an out-of-set angle to force coercion (strictConformance = false).
        const inputWithBadAngle = {
          ...schema,
          scene_setup: { ...schema.scene_setup, angle: 'not-a-valid-angle' },
        }

        const validated = validateMinimalSchema(inputWithBadAngle)

        // Confirm coercion occurred.
        expect(validated.strictConformance).toBe(false)

        // Hydration must still succeed and produce a valid EditorState.
        const { editorState, components } = hydrate(validated)

        const parseResult = MinimalSchemaZ.safeParse(editorState.schema)
        expect(parseResult.success).toBe(true)

        // The coerced angle (the default) is reflected in the EditorState.
        expect(ANGLE_VALUES).toContain(editorState.schema.scene_setup.angle)

        // Components are still produced correctly.
        expect(Array.isArray(components)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * hydrateFromSchema does not mutate the input schema:
   *
   * The `MinimalSchema` passed to `hydrateFromSchema` must be unchanged after
   * the call, confirming the hydrator is non-mutating.
   */
  it('hydrateFromSchema does not mutate the input schema', () => {
    fc.assert(
      fc.property(minimalSchemaArb, (schema) => {
        const snapshotAngle = schema.scene_setup.angle
        const snapshotLighting = schema.scene_setup.lighting
        const snapshotFraming = schema.scene_setup.framing
        const snapshotGarnishes = [...schema.food_components.garnishes]
        const snapshotSides = [...schema.food_components.sides]

        hydrateFromSchema(schema)

        expect(schema.scene_setup.angle).toBe(snapshotAngle)
        expect(schema.scene_setup.lighting).toBe(snapshotLighting)
        expect(schema.scene_setup.framing).toBe(snapshotFraming)
        expect(schema.food_components.garnishes).toEqual(snapshotGarnishes)
        expect(schema.food_components.sides).toEqual(snapshotSides)
      }),
      { numRuns: 200 },
    )
  })
})
