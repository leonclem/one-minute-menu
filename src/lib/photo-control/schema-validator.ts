/**
 * Photo Control — Minimal Schema Validator
 *
 * Validates extracted Phase A JSON against the `Minimal_Schema`, mirroring the
 * Zod, class-based patterns of `src/lib/extraction/schema-validator.ts`.
 *
 * Unlike the extraction validator (which rejects invalid data), this validator
 * is COERCIVE and resilient: out-of-set `Enum_Field` values are coerced to
 * their defined defaults, non-enum issues are repaired with hydratable
 * fallbacks, and the result always carries populated, hydratable `data`
 * whenever the input is structurally parseable. Coercion is never a blocking
 * validity failure; instead the advisory `strictConformance` flag signals
 * whether any enum coercion occurred. (Requirements 3.1–3.10)
 *
 * Key semantics:
 *  - `strictConformance` is `true` if and only if every `Enum_Field` input value
 *    was already a member of its allowed set (no coercion). Any coercion — an
 *    out-of-set value OR a missing/non-string enum value — flips it to `false`
 *    and records exactly one warning naming the field and the original value.
 *    (Requirements 3.5, 3.9)
 *  - Non-enum issues (missing/invalid `canvas` or `food_components` fields) add
 *    warnings but do NOT affect `strictConformance` when all enum fields are
 *    in-set. (Requirement 3.6)
 *  - `food_components.garnishes` and `food_components.sides` are normalized to
 *    arrays of strings. (Requirement 3.7)
 *  - `data` is ALWAYS populated and validates against `MinimalSchemaZ`, so the
 *    UI can hydrate regardless of `strictConformance`. (Requirement 3.10)
 */

import {
  ANGLE_VALUES,
  FRAMING_VALUES,
  SPIN_VALUES,
  ENUM_DEFAULTS,
  DEFAULT_LIGHTING_KEY,
  MinimalSchemaZ,
  type MinimalSchema,
  type EnumFieldPath,
} from './minimal-schema'

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * A non-blocking advisory note produced during validation. Mirrors the
 * `ValidationWarning` shape of the extraction validator (path/message/severity).
 */
export interface MinimalValidationWarning {
  /** Dotted schema path the warning concerns, e.g. `scene_setup.angle`. */
  path: string
  /** Human-readable message; for enum coercion it names the field + original value. */
  message: string
  severity: 'low' | 'medium' | 'high'
}

/**
 * The result of validating extracted JSON against the `Minimal_Schema`.
 * (Requirement 3.8)
 */
export interface MinimalValidationResult {
  /**
   * Advisory `Strict_Conformance_Flag`. `true` if and only if every `Enum_Field`
   * input value was already a member of its allowed set (no coercion). It does
   * NOT block hydration. (Requirements 3.9, 3.10)
   */
  strictConformance: boolean
  /** Validated/coerced data — ALWAYS present and hydratable. (Requirement 3.10) */
  data: MinimalSchema
  /** Non-blocking warnings, including one per coerced enum field. */
  warnings: MinimalValidationWarning[]
}

// ============================================================================
// Internal coercion defaults for non-enum string fields
// ============================================================================

/**
 * Hydratable fallbacks for the non-enum string fields. Empty strings keep the
 * result a valid `MinimalSchema` (the Zod string fields accept `''`) so the UI
 * can always hydrate. (Requirement 3.10)
 */
const STRING_FIELD_DEFAULT = ''

// ============================================================================
// Schema Validator Class
// ============================================================================

/**
 * Coercive, Zod-backed validator for the `Minimal_Schema`.
 *
 * Mirrors the class-based shape of `SchemaValidator` in
 * `src/lib/extraction/schema-validator.ts`, but coerces rather than rejects so
 * the editor always receives hydratable data.
 */
export class MinimalSchemaValidator {
  /**
   * Validate and coerce extracted JSON against the `Minimal_Schema`.
   *
   * Accepts any input: a parsed object, or a raw string (including
   * markdown-fenced JSON blocks and JSON with surrounding text / trailing
   * whitespace). Always returns populated, hydratable `data`. (Requirement 3.10)
   */
  validate(input: unknown): MinimalValidationResult {
    const warnings: MinimalValidationWarning[] = []

    // Resilient structural parse: unwrap strings / markdown fences into an object.
    const root = this.parseToObject(input)
    if (root === null) {
      warnings.push({
        path: 'root',
        message: 'Input was not structurally parseable as a JSON object; using defaults.',
        severity: 'high',
      })
    }

    const sceneSetup = this.asRecord(root?.['scene_setup'])
    const canvas = this.asRecord(root?.['canvas'])
    const foodComponents = this.asRecord(root?.['food_components'])

    // --- Enum fields: coerce out-of-set values, tracking conformance. ---
    const angle = this.coerceEnum(
      sceneSetup?.['angle'],
      ANGLE_VALUES,
      'scene_setup.angle',
      warnings,
    )
    const framing = this.coerceEnum(
      sceneSetup?.['framing'],
      FRAMING_VALUES,
      'scene_setup.framing',
      warnings,
    )
    const spin = this.coerceEnum(
      sceneSetup?.['spin'] ?? '0',
      SPIN_VALUES,
      'scene_setup.spin',
      warnings,
    )
    // Lighting is a style-key string (Chunk 4). Accept any non-empty string;
    // default when missing. Not part of enum strictConformance.
    const lighting = this.coerceLightingKey(sceneSetup?.['lighting'], warnings)

    // strictConformance is true iff NO enum field was coerced. (Requirement 3.9)
    const strictConformance = !angle.coerced && !framing.coerced && !spin.coerced

    // --- Non-enum fields: repair with hydratable fallbacks; warn only. ---
    const background = this.coerceString(
      canvas?.['background'],
      'canvas.background',
      warnings,
    )
    const backgroundStyle = this.coerceString(
      canvas?.['background_style'] ?? '',
      'canvas.background_style',
      warnings,
    )
    const surfaceStyle = this.coerceString(
      canvas?.['surface_style'] ?? '',
      'canvas.surface_style',
      warnings,
    )
    const mainVessel = this.coerceString(
      canvas?.['main_vessel'],
      'canvas.main_vessel',
      warnings,
    )
    const mainItem = this.coerceString(
      foodComponents?.['main_item'],
      'food_components.main_item',
      warnings,
    )
    const garnishes = this.coerceStringArray(
      foodComponents?.['garnishes'],
      'food_components.garnishes',
      warnings,
    )
    const sides = this.coerceStringArray(
      foodComponents?.['sides'],
      'food_components.sides',
      warnings,
    )

    const candidate: MinimalSchema = {
      scene_setup: {
        angle: angle.value,
        framing: framing.value,
        lighting,
        spin: spin.value,
      },
      canvas: {
        background,
        background_style: backgroundStyle,
        surface_style: surfaceStyle,
        main_vessel: mainVessel,
      },
      food_components: {
        main_item: mainItem,
        garnishes,
        sides,
      },
    }

    // Final structural guarantee: the coerced candidate always satisfies the
    // Minimal_Schema, so the UI can hydrate from it. (Requirements 3.1, 3.10)
    const parsed = MinimalSchemaZ.safeParse(candidate)
    const data = parsed.success ? parsed.data : candidate

    return {
      strictConformance,
      data,
      warnings,
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Coerce a single `Enum_Field` value to a member of its allowed set.
   *
   * Returns the original value when it is already a member (no coercion); for
   * any other value — out-of-set, missing, or non-string — coerces to the
   * field's default, records exactly one warning naming the field and the
   * original value, and flags coercion. (Requirements 3.5, 3.9)
   */
  private coerceEnum<T extends string>(
    rawValue: unknown,
    allowed: readonly T[],
    path: EnumFieldPath,
    warnings: MinimalValidationWarning[],
  ): { value: T; coerced: boolean } {
    if (typeof rawValue === 'string' && (allowed as readonly string[]).includes(rawValue)) {
      return { value: rawValue as T, coerced: false }
    }

    const defaultValue = ENUM_DEFAULTS[path] as T
    warnings.push({
      path,
      message: `Coerced ${path} from ${this.describeValue(rawValue)} to default "${defaultValue}" (not a member of [${allowed.join(', ')}]).`,
      severity: 'medium',
    })
    return { value: defaultValue, coerced: true }
  }

  /**
   * Coerce `scene_setup.lighting` to a non-empty style-key string.
   * Missing/non-string values default to {@link DEFAULT_LIGHTING_KEY}.
   */
  private coerceLightingKey(
    rawValue: unknown,
    warnings: MinimalValidationWarning[],
  ): string {
    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      return rawValue.trim()
    }
    warnings.push({
      path: 'scene_setup.lighting',
      message: `Missing or non-string scene_setup.lighting; defaulted to "${DEFAULT_LIGHTING_KEY}".`,
      severity: 'low',
    })
    return DEFAULT_LIGHTING_KEY
  }

  /**
   * Coerce a non-enum string field. Records a (non-conformance-affecting)
   * warning when the value is missing or not a string. (Requirement 3.6)
   */
  private coerceString(
    rawValue: unknown,
    path: string,
    warnings: MinimalValidationWarning[],
  ): string {
    if (typeof rawValue === 'string') {
      return rawValue
    }
    warnings.push({
      path,
      message: `Missing or non-string ${path}; defaulted to an empty string.`,
      severity: 'low',
    })
    return STRING_FIELD_DEFAULT
  }

  /**
   * Coerce a string-array field (garnishes / sides) to an array of strings,
   * dropping any non-string members. Records a (non-conformance-affecting)
   * warning when the value is missing, not an array, or contains non-strings.
   * (Requirements 3.6, 3.7)
   */
  private coerceStringArray(
    rawValue: unknown,
    path: string,
    warnings: MinimalValidationWarning[],
  ): string[] {
    if (!Array.isArray(rawValue)) {
      warnings.push({
        path,
        message: `Missing or non-array ${path}; defaulted to an empty array.`,
        severity: 'low',
      })
      return []
    }

    const strings = rawValue.filter((item): item is string => typeof item === 'string')
    if (strings.length !== rawValue.length) {
      warnings.push({
        path,
        message: `Dropped ${rawValue.length - strings.length} non-string member(s) from ${path}.`,
        severity: 'low',
      })
    }
    return strings
  }

  /**
   * Best-effort structural parse of arbitrary input into a plain object.
   *
   * Handles parsed objects directly, and for strings strips markdown code
   * fences / surrounding text and tolerates trailing whitespace before parsing.
   * Returns `null` when the input cannot be resolved to a JSON object.
   * (Requirement 3.10 — validator resilience)
   */
  private parseToObject(input: unknown): Record<string, unknown> | null {
    if (typeof input === 'string') {
      return this.parseStringToObject(input)
    }
    return this.asRecord(input) ?? null
  }

  /**
   * Parse a raw string into an object, unwrapping markdown-fenced JSON blocks
   * and tolerating surrounding text / trailing whitespace.
   */
  private parseStringToObject(raw: string): Record<string, unknown> | null {
    const trimmed = raw.trim()

    // Unwrap a ```json ... ``` or ``` ... ``` fenced block if present.
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

    const direct = this.tryParseJsonObject(candidate)
    if (direct !== null) {
      return direct
    }

    // Fallback: extract the first balanced-looking { ... } region and retry.
    const firstBrace = candidate.indexOf('{')
    const lastBrace = candidate.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sliced = candidate.slice(firstBrace, lastBrace + 1)
      return this.tryParseJsonObject(sliced)
    }

    return null
  }

  /** Parse a string with `JSON.parse`, returning an object or `null`. */
  private tryParseJsonObject(text: string): Record<string, unknown> | null {
    try {
      return this.asRecord(JSON.parse(text)) ?? null
    } catch {
      return null
    }
  }

  /** Narrow an unknown value to a plain (non-array, non-null) object. */
  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    return undefined
  }

  /** Render an arbitrary original value for inclusion in a warning message. */
  private describeValue(value: unknown): string {
    if (value === undefined) {
      return 'undefined'
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Quick validation helper that validates and coerces extracted JSON against the
 * `Minimal_Schema` using a default `MinimalSchemaValidator`.
 */
export function validateMinimalSchema(input: unknown): MinimalValidationResult {
  return new MinimalSchemaValidator().validate(input)
}
