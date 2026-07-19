/**
 * Photo Control — Minimal Schema, Enums, Defaults, and Core Types
 *
 * This is the foundational data model for the Photo Control (AI Food Image
 * Editor) feature. It defines:
 *
 *  - The enum value tuples for the three `Enum_Field`s and their coercion
 *    defaults (`ANGLE_VALUES`, `LIGHTING_VALUES`, `FRAMING_VALUES`,
 *    `ENUM_DEFAULTS`).
 *  - The hyper-minimal, enum-constrained `Minimal_Schema` as a Zod object
 *    (`MinimalSchemaZ`) plus the inferred `MinimalSchema` type.
 *  - The in-memory `EditorState`.
 *  - The state-diff types (`ArrayDiff`, `StateDelta`).
 *
 * Design notes:
 *  - The `Minimal_Schema` shape is intentionally FIXED and carries NO positional
 *    data. (Requirements 15.1, 15.5)
 *  - Enum membership mirrors the Zod, enum-constrained patterns of
 *    `src/lib/extraction/schema-validator.ts`. (Requirements 3.2, 3.3, 3.4)
 *  - `food_components.garnishes` and `food_components.sides` are arrays of
 *    strings. (Requirement 3.7)
 */

import { z } from 'zod'

// ============================================================================
// Enum value tuples (Enum_Field allowed sets)
// ============================================================================

/**
 * Allowed `scene_setup.angle` values.
 *
 * Per the requirements' assumed set (OD-2), pending confirmation.
 * (Requirement 3.2)
 */
export const ANGLE_VALUES = [
  'top-down',
  '45-degree',
  'eye-level',
  'macro-close-up',
] as const

/**
 * Allowed `scene_setup.lighting` values. (Requirement 3.3)
 */
export const LIGHTING_VALUES = ['low-key', 'bright-and-airy', 'studio'] as const

/**
 * Allowed `scene_setup.framing` values. (Requirement 3.4)
 */
export const FRAMING_VALUES = ['close-up', 'medium', 'wide'] as const

/** Union of allowed camera-angle values. */
export type AngleValue = (typeof ANGLE_VALUES)[number]
/** Union of allowed lighting values. */
export type LightingValue = (typeof LIGHTING_VALUES)[number]
/** Union of allowed framing values. */
export type FramingValue = (typeof FRAMING_VALUES)[number]

/**
 * Coercion defaults for each `Enum_Field`, keyed by dotted schema path.
 *
 * When the `MinimalSchemaValidator` encounters an out-of-set enum value it
 * coerces to these defaults and records exactly one warning. (Requirement 3.5)
 */
export const ENUM_DEFAULTS = {
  'scene_setup.angle': '45-degree', // most-dishes default per best-practices guide
  'scene_setup.lighting': 'bright-and-airy',
  'scene_setup.framing': 'close-up',
} as const satisfies {
  'scene_setup.angle': AngleValue
  'scene_setup.lighting': LightingValue
  'scene_setup.framing': FramingValue
}

/** Dotted path identifier for an `Enum_Field`. */
export type EnumFieldPath = keyof typeof ENUM_DEFAULTS

// ============================================================================
// Editor-only position
// ============================================================================

/**
 * Normalized editor coordinate used for future drag/touch subject positioning.
 * `x` and `y` are in the abstract editor range [-1, 1].
 */
export interface AbstractCoordinate {
  x: number
  y: number
}

/** Neutral subject position. */
export const CENTER: AbstractCoordinate = { x: 0, y: 0 }

/** Standard small position step used by tests and any future touch fallback. */
export const POSITION_STEP = 0.25

// ============================================================================
// Minimal_Schema (Zod)
// ============================================================================

/**
 * The hyper-minimal, enum-constrained JSON structure with three top-level keys:
 * `scene_setup`, `canvas`, and `food_components`.
 *
 * The shape is fixed and free of positional data; position lives on
 * `EditorState` as editor-only metadata. (Requirements 15.1, 15.5)
 */
export const MinimalSchemaZ = z.object({
  scene_setup: z.object({
    angle: z.enum(ANGLE_VALUES),
    framing: z.enum(FRAMING_VALUES),
    lighting: z.enum(LIGHTING_VALUES),
  }),
  canvas: z.object({
    background: z.string(),
    main_vessel: z.string(),
  }),
  food_components: z.object({
    main_item: z.string(),
    garnishes: z.array(z.string()),
    sides: z.array(z.string()),
  }),
})

/** The validated/coerced Minimal_Schema data shape. */
export type MinimalSchema = z.infer<typeof MinimalSchemaZ>

// ============================================================================
// Editor state (in-memory / session only)
// ============================================================================

/**
 * The client-side current state of the photo being edited.
 *
 * Held in memory/session only; database persistence is out of scope for v1.
 */
export interface EditorState {
  schema: MinimalSchema
  /** Editor-only subject position; intentionally excluded from Minimal_Schema. */
  position: AbstractCoordinate
}

// ============================================================================
// State delta
// ============================================================================

/**
 * The added/removed members of a string-array field between two states.
 * `added = target \ original`, `removed = original \ target`.
 */
export interface ArrayDiff {
  added: string[]
  removed: string[]
}

/**
 * The difference between an original and a target `EditorState`.
 *
 * `scalarChanges` records changed `Enum_Field`s with previous/target values;
 * `arrays` records garnish/side additions and removals; `isEmpty` is true when
 * the states are equal.
 */
export interface StateDelta {
  scalarChanges: Array<{ path: string; from: string; to: string }>
  arrays: { garnishes: ArrayDiff; sides: ArrayDiff }
  position?: { from: AbstractCoordinate; to: AbstractCoordinate }
  isEmpty: boolean
}
