/**
 * Property-Based Tests for the Minimal Schema Validator
 *
 * Feature: photo-control, Property 3: Enum-validation invariant
 *
 * Property 3 (Enum-validation invariant): For any extracted JSON input, every
 * Enum_Field (`scene_setup.angle`, `scene_setup.lighting`, `scene_setup.framing`)
 * in the validated output is a member of its allowed set; any input value outside
 * the set is replaced by that field's defined default and produces exactly one
 * warning naming that field and its original value; the advisory
 * strict-conformance flag is true if and only if no coercion occurred (every
 * Enum_Field input was already a member of its allowed set) and false when any
 * coercion occurred; non-enum issues add warnings without affecting that flag;
 * and whenever the input is structurally parseable the returned `data` is always
 * populated and hydratable (validates against `MinimalSchemaZ`) regardless of the
 * flag.
 *
 * Test inputs deliberately include heavily malformed nested objects, trailing
 * whitespace, and markdown-fenced JSON blocks to validate validator resilience.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property (configured at 200)
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10
 */

import fc from 'fast-check'
import { validateMinimalSchema } from '../schema-validator'
import {
  ANGLE_VALUES,
  FRAMING_VALUES,
  ENUM_DEFAULTS,
  DEFAULT_LIGHTING_KEY,
  MinimalSchemaZ,
} from '../minimal-schema'

// ── Constants ────────────────────────────────────────────────────────────────

/** Enum_Field dotted paths (lighting is a free style-key string since Chunk 4). */
const ENUM_PATHS = ['scene_setup.angle', 'scene_setup.framing'] as const

const ALLOWED_BY_PATH: Record<(typeof ENUM_PATHS)[number], readonly string[]> = {
  'scene_setup.angle': ANGLE_VALUES,
  'scene_setup.framing': FRAMING_VALUES,
}

// ── Shared assertion helpers ─────────────────────────────────────────────────

/**
 * Mirrors the validator's private `describeValue`, so we can assert that a
 * coercion warning names the *original* value exactly. (Requirement 3.5)
 */
function describeOriginal(raw: unknown): string {
  if (raw === undefined) {
    return 'undefined'
  }
  try {
    return JSON.stringify(raw)
  } catch {
    return String(raw)
  }
}

/**
 * Universal invariants that MUST hold for the result of `validate(input)` for
 * ANY input whatsoever. These encode Requirements 3.1–3.4, 3.7, 3.9, 3.10.
 */
function assertUniversalInvariants(result: ReturnType<typeof validateMinimalSchema>): void {
  // 3.10 — `data` is ALWAYS populated and hydratable: it validates against the
  // Minimal_Schema regardless of the strict-conformance flag.
  expect(MinimalSchemaZ.safeParse(result.data).success).toBe(true)

  // 3.2/3.4 — every output Enum_Field is a member of its allowed set.
  expect(ANGLE_VALUES).toContain(result.data.scene_setup.angle)
  expect(FRAMING_VALUES).toContain(result.data.scene_setup.framing)
  // Lighting is a style-key string (Chunk 4) — only require non-empty.
  expect(typeof result.data.scene_setup.lighting).toBe('string')
  expect(result.data.scene_setup.lighting.trim().length).toBeGreaterThan(0)
  expect(typeof result.data.canvas.background_style).toBe('string')

  // 3.7 — garnishes/sides are arrays of strings.
  expect(Array.isArray(result.data.food_components.garnishes)).toBe(true)
  expect(Array.isArray(result.data.food_components.sides)).toBe(true)
  for (const g of result.data.food_components.garnishes) {
    expect(typeof g).toBe('string')
  }
  for (const s of result.data.food_components.sides) {
    expect(typeof s).toBe('string')
  }

  // The flag is a strict boolean.
  expect(typeof result.strictConformance).toBe('boolean')

  // Every warning has the documented shape.
  for (const w of result.warnings) {
    expect(typeof w.path).toBe('string')
    expect(typeof w.message).toBe('string')
    expect(['low', 'medium', 'high']).toContain(w.severity)
  }

  // 3.9 — the strict-conformance flag is true IFF no enum field was coerced.
  // The validator emits exactly one enum-path warning per coerced enum field,
  // so "no coercion" is equivalent to "no enum-path warnings".
  const enumWarnings = result.warnings.filter((w) =>
    (ENUM_PATHS as readonly string[]).includes(w.path),
  )
  expect(result.strictConformance).toBe(enumWarnings.length === 0)
  // At most one coercion warning can exist per enum field (three total).
  expect(enumWarnings.length).toBeLessThanOrEqual(ENUM_PATHS.length)
  for (const path of ENUM_PATHS) {
    const perField = enumWarnings.filter((w) => w.path === path)
    expect(perField.length).toBeLessThanOrEqual(1)
  }
}

// ── Structured generators (known coercion outcome) ───────────────────────────

/**
 * A "safe" string arbitrary whose values never contain characters that would
 * break JSON round-tripping through markdown fences or surrounding text
 * (backticks, braces, quotes, backslashes). Used for the structured generator
 * so that every wrap mode parses back to the exact same logical object.
 */
const safeStringArb = fc
  .string({ maxLength: 14 })
  .map((s) => s.replace(/[`{}[\]"\\]/g, ''))

/**
 * A single Enum_Field choice with a KNOWN coercion outcome.
 *  - `raw` is the value the validator will observe (omitted keys → `undefined`).
 *  - `coerced` records whether this value triggers coercion to the default.
 *  - `omit` indicates the key should be absent from the built object.
 */
interface FieldChoice {
  coerced: boolean
  omit: boolean
  raw: unknown
  embed: unknown
}

function fieldChoiceArb(allowed: readonly string[]): fc.Arbitrary<FieldChoice> {
  const outOfSetString = safeStringArb.filter((s) => !allowed.includes(s))
  return fc.oneof(
    // In-set: already valid, no coercion.
    fc.constantFrom(...allowed).map<FieldChoice>((v) => ({
      coerced: false,
      omit: false,
      raw: v,
      embed: v,
    })),
    // Out-of-set string → coerced.
    outOfSetString.map<FieldChoice>((v) => ({
      coerced: true,
      omit: false,
      raw: v,
      embed: v,
    })),
    // Non-string (number) → coerced.
    fc.integer().map<FieldChoice>((v) => ({
      coerced: true,
      omit: false,
      raw: v,
      embed: v,
    })),
    // Explicit null → coerced.
    fc.constant<FieldChoice>({ coerced: true, omit: false, raw: null, embed: null }),
    // Missing key → coerced (validator observes `undefined`).
    fc.constant<FieldChoice>({ coerced: true, omit: true, raw: undefined, embed: undefined }),
  )
}

/** How the structured object is presented to the validator. */
type WrapMode = 'object' | 'json' | 'json-trailing-ws' | 'fence-json' | 'fence-plain' | 'surrounded'

const wrapModeArb = fc.constantFrom<WrapMode>(
  'object',
  'json',
  'json-trailing-ws',
  'fence-json',
  'fence-plain',
  'surrounded',
)

/**
 * Present a plain object to the validator through one of several structurally
 * parseable forms, including markdown-fenced JSON blocks and trailing
 * whitespace. Inner string values are constrained (see `safeStringArb`) so each
 * form round-trips to the identical logical object.
 */
function buildInput(obj: unknown, mode: WrapMode): unknown {
  switch (mode) {
    case 'object':
      return obj
    case 'json':
      return JSON.stringify(obj)
    case 'json-trailing-ws':
      return JSON.stringify(obj) + '\n\t   \n  '
    case 'fence-json':
      return '```json\n' + JSON.stringify(obj, null, 2) + '\n```'
    case 'fence-plain':
      return '```\n' + JSON.stringify(obj) + '\n```'
    case 'surrounded':
      return 'Here is the extracted scene:\n' + JSON.stringify(obj) + '\nThat is all.'
  }
}

interface StructuredCase {
  angle: FieldChoice
  framing: FieldChoice
  malformNonEnum: boolean
  wrap: WrapMode
}

const structuredCaseArb: fc.Arbitrary<StructuredCase> = fc.record({
  angle: fieldChoiceArb(ANGLE_VALUES),
  framing: fieldChoiceArb(FRAMING_VALUES),
  malformNonEnum: fc.boolean(),
  wrap: wrapModeArb,
})

/** Build the `scene_setup` object, omitting keys flagged for omission. */
function buildSceneSetup(c: StructuredCase): Record<string, unknown> {
  const scene: Record<string, unknown> = {
    // Lighting is a free style key — keep a stable in-set value for enum tests.
    lighting: DEFAULT_LIGHTING_KEY,
  }
  if (!c.angle.omit) scene['angle'] = c.angle.embed
  if (!c.framing.omit) scene['framing'] = c.framing.embed
  return scene
}

// ── Adversarial generators (universal invariants only) ───────────────────────

/**
 * A broad adversarial input space: arbitrary values, heavily nested/malformed
 * objects, schema-shaped junk, raw JSON strings, and markdown-fenced or
 * trailing-whitespace wrappers around arbitrary content. Used to confirm the
 * validator never throws and always returns hydratable data. (Req 3.10)
 */
const adversarialArb = fc.oneof(
  fc.anything(),
  fc.anything({ maxDepth: 4 }),
  fc.object(),
  // Schema-shaped, but with arbitrary junk at every position.
  fc.record({
    scene_setup: fc.anything(),
    canvas: fc.anything(),
    food_components: fc.anything(),
  }),
  // Deeply malformed scene_setup: enum positions hold nested objects/arrays.
  fc.record({
    scene_setup: fc.record({
      angle: fc.anything(),
      framing: fc.anything(),
      lighting: fc.anything(),
    }),
    canvas: fc.anything(),
    food_components: fc.record({
      garnishes: fc.anything(),
      sides: fc.anything(),
    }),
  }),
  // Raw JSON strings and markdown-fenced / trailing-whitespace wrappers.
  fc.json(),
  fc.json().map((j) => '```json\n' + j + '\n```'),
  fc.json().map((j) => '```\n' + j + '\n```'),
  fc.json().map((j) => j + '   \n\t\n'),
  fc.string().map((s) => '```json\n' + s + '\n```'),
  fc.string().map((s) => s + '   \n\t'),
)

// ── Property 3: Enum-validation invariant ────────────────────────────────────

describe('Feature: photo-control, Property 3: Enum-validation invariant', () => {
  /**
   * Core structured property: for a generated input with a KNOWN coercion
   * outcome per enum field — presented as a plain object, a JSON string, a
   * trailing-whitespace string, or a markdown-fenced JSON block — the validator:
   *  - coerces each out-of-set / missing / non-string enum value to its default,
   *  - leaves in-set enum values untouched,
   *  - records exactly one warning per coerced enum field naming the field and
   *    its original value,
   *  - sets `strictConformance` true iff no enum coercion occurred,
   *  - always returns hydratable `data`.
   * (Requirements 3.2, 3.3, 3.4, 3.5, 3.9, 3.10)
   */
  it('coerces out-of-set enums to defaults with one warning each and the correct strict-conformance flag', () => {
    fc.assert(
      fc.property(structuredCaseArb, (c) => {
        const scene = buildSceneSetup(c)

        const canvas = c.malformNonEnum
          ? { background: 12345 } // missing main_vessel, non-string background
          : { background: 'soft linen tablecloth', main_vessel: 'white ceramic plate' }

        const foodComponents = c.malformNonEnum
          ? { main_item: 99, garnishes: 'not-an-array', sides: [1, 'fries', true] }
          : {
              main_item: 'grilled salmon',
              garnishes: ['parsley', 'lemon wedge'],
              sides: ['rice', 'salad'],
            }

        const obj = {
          scene_setup: scene,
          canvas,
          food_components: foodComponents,
        }

        const input = buildInput(obj, c.wrap)
        const result = validateMinimalSchema(input)

        // Universal invariants always hold.
        assertUniversalInvariants(result)

        // Expected per-field coercion outcome (angle/framing enums only).
        const fields: Array<{
          name: 'angle' | 'framing'
          path: (typeof ENUM_PATHS)[number]
          choice: FieldChoice
        }> = [
          { name: 'angle', path: 'scene_setup.angle', choice: c.angle },
          { name: 'framing', path: 'scene_setup.framing', choice: c.framing },
        ]

        const anyCoerced = fields.some((f) => f.choice.coerced)

        // 3.9 — strict conformance is true IFF no enum coercion occurred.
        expect(result.strictConformance).toBe(!anyCoerced)

        for (const f of fields) {
          const outValue = result.data.scene_setup[f.name]
          const fieldWarnings = result.warnings.filter((w) => w.path === f.path)

          if (f.choice.coerced) {
            // 3.5 — coerced to the field's defined default.
            expect(outValue).toBe(ENUM_DEFAULTS[f.path])
            // 3.5 — exactly one warning, naming the field and the original value.
            expect(fieldWarnings).toHaveLength(1)
            expect(fieldWarnings[0].message).toContain(f.path)
            expect(fieldWarnings[0].message).toContain(describeOriginal(f.choice.raw))
          } else {
            // In-set value preserved verbatim, with no coercion warning.
            expect(outValue).toBe(f.choice.raw)
            expect(fieldWarnings).toHaveLength(0)
          }
        }

        // 3.6 — when only non-enum fields are malformed (no enum coercion), the
        // strict-conformance flag stays true even though non-enum warnings exist.
        if (c.malformNonEnum && !anyCoerced) {
          expect(result.strictConformance).toBe(true)
          const nonEnumWarnings = result.warnings.filter(
            (w) => !(ENUM_PATHS as readonly string[]).includes(w.path),
          )
          expect(nonEnumWarnings.length).toBeGreaterThan(0)
        }

        // When non-enum fields are well-formed, arrays survive intact.
        if (!c.malformNonEnum) {
          expect(result.data.food_components.garnishes).toEqual(['parsley', 'lemon wedge'])
          expect(result.data.food_components.sides).toEqual(['rice', 'salad'])
        }
      }),
      { numRuns: 200 },
    )
  })

  /**
   * Resilience property: for ANY input at all — including heavily malformed
   * nested objects, arbitrary values, raw JSON, markdown-fenced blocks, and
   * trailing-whitespace strings — the validator never throws, always returns
   * `data` that validates against the Minimal_Schema (populated + hydratable),
   * keeps every output Enum_Field within its allowed set, and keeps the
   * strict-conformance flag consistent with the recorded enum coercions.
   * (Requirements 3.1, 3.10 validator resilience; 3.9 flag consistency)
   */
  it('never throws and always returns hydratable data for adversarial inputs', () => {
    fc.assert(
      fc.property(adversarialArb, (input) => {
        const result = validateMinimalSchema(input)
        assertUniversalInvariants(result)
      }),
      { numRuns: 300 },
    )
  })

  /**
   * Targeted resilience: a fully-malformed input that is NOT structurally
   * parseable (a non-object root) still yields hydratable defaults with every
   * enum field coerced and the flag set to false. (Requirements 3.9, 3.10)
   */
  it('falls back to coerced defaults for non-parseable input', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant('not json at all !!!'),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.anything()),
        ),
        (input) => {
          const result = validateMinimalSchema(input)
          assertUniversalInvariants(result)
          // No enum field could be read, so all three are coerced to defaults.
          expect(result.strictConformance).toBe(false)
          expect(result.data.scene_setup.angle).toBe(ENUM_DEFAULTS['scene_setup.angle'])
          expect(result.data.scene_setup.framing).toBe(ENUM_DEFAULTS['scene_setup.framing'])
          expect(result.data.scene_setup.lighting).toBe(DEFAULT_LIGHTING_KEY)
        },
      ),
      { numRuns: 100 },
    )
  })
})
