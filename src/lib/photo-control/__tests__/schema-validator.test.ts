/**
 * Unit Tests for the Minimal Schema Validator — Result Shape & Array Handling
 *
 * Feature: photo-control, Task 2.3
 *
 * These example-based unit tests complement the property test
 * (`schema-validator.property.test.ts`, Property 3) by pinning down two
 * concrete behaviors with representative cases:
 *
 *  - The validation result shape `{ strictConformance, data, warnings }` has the
 *    correct keys and value types. (Requirement 3.8)
 *  - `food_components.garnishes` and `food_components.sides` are normalized to
 *    arrays of strings: in-set string arrays are preserved verbatim, non-string
 *    members are dropped, and a missing / non-array value coerces to an empty
 *    array. (Requirement 3.7)
 *
 * Library: Jest (no property generators here)
 *
 * Validates: Requirements 3.7, 3.8
 */

import {
  MinimalSchemaValidator,
  validateMinimalSchema,
  type MinimalValidationResult,
  type MinimalValidationWarning,
} from '../schema-validator'
import {
  ANGLE_VALUES,
  FRAMING_VALUES,
  ENUM_DEFAULTS,
  MinimalSchemaZ,
} from '../minimal-schema'

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A fully-conformant Minimal_Schema input (every enum already in-set). */
function fullyConformantInput() {
  return {
    scene_setup: {
      angle: 'top-down',
      framing: 'medium',
      lighting: 'bright-and-airy',
    },
    canvas: {
      background: 'rustic wooden table',
      main_vessel: 'white ceramic plate',
    },
    food_components: {
      main_item: 'grilled salmon fillet',
      garnishes: ['lemon wedge', 'dill sprig'],
      sides: ['roasted potatoes', 'steamed asparagus'],
    },
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** All warnings whose path matches the given dotted schema path. */
function warningsFor(
  result: MinimalValidationResult,
  path: string,
): MinimalValidationWarning[] {
  return result.warnings.filter((w) => w.path === path)
}

/** Warnings concerning Enum_Fields (angle/framing; lighting is a free style key). */
function enumWarnings(result: MinimalValidationResult): MinimalValidationWarning[] {
  const enumPaths = ['scene_setup.angle', 'scene_setup.framing']
  return result.warnings.filter((w) => enumPaths.includes(w.path))
}

// ── Requirement 3.8: result shape ────────────────────────────────────────────

describe('MinimalSchemaValidator — result shape (Req 3.8)', () => {
  it('returns exactly the { strictConformance, data, warnings } keys', () => {
    const result = validateMinimalSchema(fullyConformantInput())

    expect(Object.keys(result).sort()).toEqual(
      ['data', 'strictConformance', 'warnings'].sort(),
    )
  })

  it('types each field correctly: boolean flag, schema-valid data, warnings array', () => {
    const result = validateMinimalSchema(fullyConformantInput())

    expect(typeof result.strictConformance).toBe('boolean')
    expect(Array.isArray(result.warnings)).toBe(true)

    // `data` always satisfies the Minimal_Schema so the UI can hydrate.
    expect(MinimalSchemaZ.safeParse(result.data).success).toBe(true)
  })

  it('every warning has a string path, string message, and valid severity', () => {
    // Use an input that triggers both enum and non-enum warnings.
    const result = validateMinimalSchema({
      scene_setup: { angle: 'drone-shot', framing: 'medium', lighting: 'low-key' },
      canvas: { background: 'table' /* main_vessel missing → warning */ },
      food_components: { main_item: 'steak', garnishes: 'not-an-array', sides: [] },
    })

    expect(result.warnings.length).toBeGreaterThan(0)
    for (const warning of result.warnings) {
      expect(typeof warning.path).toBe('string')
      expect(typeof warning.message).toBe('string')
      expect(warning.message.length).toBeGreaterThan(0)
      expect(['low', 'medium', 'high']).toContain(warning.severity)
    }
  })

  it('the class API and the convenience function return equivalent results', () => {
    const input = fullyConformantInput()
    const fromClass = new MinimalSchemaValidator().validate(input)
    const fromFn = validateMinimalSchema(input)

    expect(fromFn).toEqual(fromClass)
  })

  // Representative case: fully-conformant input → strictConformance true, no enum warnings.
  it('fully-conformant input → strictConformance true and no enum warnings', () => {
    const result = validateMinimalSchema(fullyConformantInput())

    expect(result.strictConformance).toBe(true)
    expect(enumWarnings(result)).toHaveLength(0)
    expect(result.data.scene_setup).toEqual({
      angle: 'top-down',
      framing: 'medium',
      lighting: 'bright-and-airy',
      spin: '0',
    })
  })

  // Representative case: coerced enum input → strictConformance false, one warning per coerced field.
  it('coerced enum input → strictConformance false with coerced defaults', () => {
    const result = validateMinimalSchema({
      scene_setup: {
        angle: 'birds-eye', // out-of-set → default
        framing: 'panoramic', // out-of-set → default
        lighting: 'bright-and-airy', // in-set → preserved
      },
      canvas: { background: 'slate', main_vessel: 'bowl' },
      food_components: { main_item: 'ramen', garnishes: [], sides: [] },
    })

    expect(result.strictConformance).toBe(false)

    // Coerced fields fall back to their defined defaults; in-set field preserved.
    expect(result.data.scene_setup.angle).toBe(ENUM_DEFAULTS['scene_setup.angle'])
    expect(result.data.scene_setup.framing).toBe(ENUM_DEFAULTS['scene_setup.framing'])
    expect(result.data.scene_setup.lighting).toBe('bright-and-airy')

    // Exactly one warning per coerced enum field, naming the field + original value.
    expect(warningsFor(result, 'scene_setup.angle')).toHaveLength(1)
    expect(warningsFor(result, 'scene_setup.framing')).toHaveLength(1)
    expect(warningsFor(result, 'scene_setup.lighting')).toHaveLength(0)
    expect(warningsFor(result, 'scene_setup.angle')[0].message).toContain('birds-eye')
  })

  it('coerced defaults are always members of their allowed enum sets', () => {
    const result = validateMinimalSchema({
      scene_setup: { angle: 1, framing: null, lighting: {} },
      canvas: {},
      food_components: {},
    })

    expect(result.strictConformance).toBe(false)
    expect(ANGLE_VALUES).toContain(result.data.scene_setup.angle)
    expect(FRAMING_VALUES).toContain(result.data.scene_setup.framing)
    // Lighting falls back to the default style key when non-string.
    expect(result.data.scene_setup.lighting).toBe('bright-and-airy')
    expect(result.data.canvas.background_style).toBe('')
  })

  it('accepts arbitrary lighting style keys without failing strictConformance', () => {
    const result = validateMinimalSchema({
      scene_setup: {
        angle: '45-degree',
        framing: 'close-up',
        lighting: 'soft-natural-window',
      },
      canvas: { background: 'table', main_vessel: 'plate', background_style: '' },
      food_components: { main_item: 'salad', garnishes: [], sides: [] },
    })

    expect(result.strictConformance).toBe(true)
    expect(result.data.scene_setup.lighting).toBe('soft-natural-window')
  })

  it('accepts arbitrary surface style keys without failing strictConformance', () => {
    const result = validateMinimalSchema({
      scene_setup: {
        angle: '45-degree',
        framing: 'close-up',
        lighting: 'bright-and-airy',
      },
      canvas: { background: 'table', main_vessel: 'plate', background_style: '', surface_style: 'granite-light' },
      food_components: { main_item: 'salad', garnishes: [], sides: [] },
    })

    expect(result.strictConformance).toBe(true)
    expect(result.data.canvas.surface_style).toBe('granite-light')
  })

  // Representative case: non-enum repair does not affect strictConformance.
  it('non-enum repairs warn but keep strictConformance true when enums are in-set', () => {
    const result = validateMinimalSchema({
      scene_setup: { angle: 'eye-level', framing: 'wide', lighting: 'low-key' },
      canvas: {}, // both non-enum strings missing → warnings, not conformance failures
      food_components: { main_item: 42, garnishes: ['chive'], sides: ['fries'] },
    })

    // All enum fields were in-set, so the flag stays true despite repairs.
    expect(result.strictConformance).toBe(true)
    expect(enumWarnings(result)).toHaveLength(0)

    // Non-enum repairs are recorded as warnings and produce hydratable fallbacks.
    expect(warningsFor(result, 'canvas.background')).toHaveLength(1)
    expect(warningsFor(result, 'canvas.main_vessel')).toHaveLength(1)
    expect(warningsFor(result, 'food_components.main_item')).toHaveLength(1)
    expect(result.data.canvas.background).toBe('')
    expect(result.data.canvas.main_vessel).toBe('')
    expect(result.data.food_components.main_item).toBe('')
  })

  it('unparseable input still returns a hydratable result with all-default enums', () => {
    const result = validateMinimalSchema('this is not json at all')

    expect(typeof result.strictConformance).toBe('boolean')
    expect(MinimalSchemaZ.safeParse(result.data).success).toBe(true)
    // No structure to read enums from → everything coerces → flag is false.
    expect(result.strictConformance).toBe(false)
    expect(warningsFor(result, 'root')).toHaveLength(1)
  })
})

// ── Requirement 3.7: garnishes / sides are arrays of strings ─────────────────

describe('MinimalSchemaValidator — array-of-strings handling (Req 3.7)', () => {
  it('preserves arrays of strings verbatim for garnishes and sides', () => {
    const garnishes = ['microgreens', 'sesame seeds', 'chili oil']
    const sides = ['kimchi', 'pickled radish']
    const result = validateMinimalSchema({
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'low-key' },
      canvas: { background: 'stone', main_vessel: 'bowl' },
      food_components: { main_item: 'bibimbap', garnishes, sides },
    })

    expect(result.data.food_components.garnishes).toEqual(garnishes)
    expect(result.data.food_components.sides).toEqual(sides)
    // No drop warnings when every member is already a string.
    expect(warningsFor(result, 'food_components.garnishes')).toHaveLength(0)
    expect(warningsFor(result, 'food_components.sides')).toHaveLength(0)
  })

  it('drops non-string members, keeping only the strings in order', () => {
    const result = validateMinimalSchema({
      scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'low-key' },
      canvas: { background: 'linen', main_vessel: 'platter' },
      food_components: {
        main_item: 'charcuterie',
        garnishes: ['parsley', 42, null, 'thyme', { name: 'basil' }, true],
        sides: [undefined, 'crackers', ['nested'], 'olives'],
      },
    })

    expect(result.data.food_components.garnishes).toEqual(['parsley', 'thyme'])
    expect(result.data.food_components.sides).toEqual(['crackers', 'olives'])

    // A drop warning is recorded for each array that lost members.
    expect(warningsFor(result, 'food_components.garnishes')).toHaveLength(1)
    expect(warningsFor(result, 'food_components.sides')).toHaveLength(1)

    // Every retained member is a string.
    for (const item of result.data.food_components.garnishes) {
      expect(typeof item).toBe('string')
    }
    for (const item of result.data.food_components.sides) {
      expect(typeof item).toBe('string')
    }
  })

  it('coerces a missing garnishes/sides value to an empty array', () => {
    const result = validateMinimalSchema({
      scene_setup: { angle: 'eye-level', framing: 'wide', lighting: 'bright-and-airy' },
      canvas: { background: 'marble', main_vessel: 'plate' },
      food_components: { main_item: 'omelette' }, // garnishes & sides missing
    })

    expect(result.data.food_components.garnishes).toEqual([])
    expect(result.data.food_components.sides).toEqual([])
    expect(warningsFor(result, 'food_components.garnishes')).toHaveLength(1)
    expect(warningsFor(result, 'food_components.sides')).toHaveLength(1)
  })

  it('coerces a non-array garnishes/sides value to an empty array', () => {
    const result = validateMinimalSchema({
      scene_setup: { angle: 'macro-close-up', framing: 'close-up', lighting: 'low-key' },
      canvas: { background: 'wood', main_vessel: 'skillet' },
      food_components: {
        main_item: 'paella',
        garnishes: 'lemon', // string, not an array
        sides: { a: 1 }, // object, not an array
      },
    })

    expect(result.data.food_components.garnishes).toEqual([])
    expect(result.data.food_components.sides).toEqual([])
    expect(warningsFor(result, 'food_components.garnishes')).toHaveLength(1)
    expect(warningsFor(result, 'food_components.sides')).toHaveLength(1)
  })

  it('keeps an empty array as empty without recording a drop warning', () => {
    const result = validateMinimalSchema({
      scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'low-key' },
      canvas: { background: 'table', main_vessel: 'bowl' },
      food_components: { main_item: 'soup', garnishes: [], sides: [] },
    })

    expect(result.data.food_components.garnishes).toEqual([])
    expect(result.data.food_components.sides).toEqual([])
    expect(warningsFor(result, 'food_components.garnishes')).toHaveLength(0)
    expect(warningsFor(result, 'food_components.sides')).toHaveLength(0)
  })
})
