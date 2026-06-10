/**
 * Photo Control — State_Delta_Engine
 *
 * Pure, framework-free diffing between two `EditorState` values. Each control
 * change produces a target state; this engine computes the precise difference
 * (a `StateDelta`) so the model edits only what changed, and can apply that
 * delta back onto the original state. (Requirements 9.1–9.5)
 *
 * The engine also provides the single canonical positional intake point used by
 * a future Phase 2 interactive canvas: `setPositionFromCanvas` accepts a
 * continuous translation only through the canonical `position` field and rejects
 * any other field, so the `Minimal_Schema` never has to change shape when input
 * transitions from discrete position steps to continuous drag. (Requirements
 * 15.3, 15.4)
 *
 * ## Modeled (editable) subset
 *
 * The `StateDelta` captures exactly the state that the editor controls can
 * change:
 *  - the three `scene_setup` `Enum_Field`s (`angle`, `framing`, `lighting`) as
 *    scalar changes (Requirement 9.3);
 *  - `food_components.garnishes` and `food_components.sides` as set-based
 *    additions/removals (Requirement 9.2);
 *  - the editor-only `position` (`AbstractCoordinate`) when it changes.
 *
 * The non-editable schema fields (`canvas.background`, `canvas.main_vessel`,
 * `food_components.main_item`) are never touched by any control, so `applyDelta`
 * carries them over unchanged from the original. For every state reachable
 * through the controls this makes `applyDelta(original, computeDelta(original,
 * target))` reproduce `target` exactly. (Requirement 9.4)
 *
 * ## Set semantics for component arrays
 *
 * `garnishes` and `sides` are treated as SETS of distinct strings (you would not
 * list "parsley" twice). `added = target \ original` and `removed = original \
 * target` are set differences, so reordering the same members is not a change.
 * This matches the design's set notation and keeps the empty-delta contract
 * consistent (set-equal arrays yield no array change). (Requirements 9.2, 9.5)
 */

import {
  type AbstractCoordinate,
  type AngleValue,
  type ArrayDiff,
  type EditorState,
  type FramingValue,
  type LightingValue,
  type MinimalSchema,
  type StateDelta,
} from './minimal-schema'

// ============================================================================
// Enum scalar field descriptors
// ============================================================================

/**
 * The three `scene_setup` `Enum_Field` paths captured as scalar changes, in a
 * fixed, deterministic order. (Requirement 9.3)
 */
const ENUM_FIELD_PATHS = [
  'scene_setup.angle',
  'scene_setup.framing',
  'scene_setup.lighting',
] as const

type EnumScalarPath = (typeof ENUM_FIELD_PATHS)[number]

/** Read the current value of an enum scalar field from a schema. */
function readEnumField(schema: MinimalSchema, path: EnumScalarPath): string {
  switch (path) {
    case 'scene_setup.angle':
      return schema.scene_setup.angle
    case 'scene_setup.framing':
      return schema.scene_setup.framing
    case 'scene_setup.lighting':
      return schema.scene_setup.lighting
  }
}

/** Write an enum scalar field value onto a schema (mutates the passed schema). */
function writeEnumField(schema: MinimalSchema, path: string, value: string): void {
  switch (path) {
    case 'scene_setup.angle':
      schema.scene_setup.angle = value as AngleValue
      break
    case 'scene_setup.framing':
      schema.scene_setup.framing = value as FramingValue
      break
    case 'scene_setup.lighting':
      schema.scene_setup.lighting = value as LightingValue
      break
    default:
      // Unknown scalar path: ignore. computeDelta only ever emits the three
      // known enum paths, so this branch is defensive only.
      break
  }
}

// ============================================================================
// Array set-diff helpers
// ============================================================================

/**
 * Compute the set-based difference between two string arrays.
 * `added = target \ original`, `removed = original \ target`. Duplicates are
 * collapsed and the result preserves first-seen order for determinism.
 * (Requirement 9.2)
 */
function diffArrays(original: string[], target: string[]): ArrayDiff {
  const originalSet = new Set(original)
  const targetSet = new Set(target)

  // Iterate the source arrays (not the Sets) to stay es5-safe while deduping
  // and preserving first-seen order for determinism.
  const added = distinctNotIn(target, originalSet)
  const removed = distinctNotIn(original, targetSet)

  return { added, removed }
}

/**
 * Return the distinct members of `values` that are NOT present in `exclude`,
 * preserving first-seen order. Used to build set-difference results without
 * spreading a `Set` (which the project's es5 target disallows).
 */
function distinctNotIn(values: string[], exclude: Set<string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!exclude.has(value) && !seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }
  return result
}

/**
 * Apply a set-based `ArrayDiff` to an original array: drop the `removed`
 * members, then append the `added` members not already present. Preserves the
 * surviving original members' order and is the inverse of {@link diffArrays}
 * under set semantics. (Requirement 9.4)
 */
function applyArrayDiff(original: string[], diff: ArrayDiff): string[] {
  const removedSet = new Set(diff.removed)
  const kept = original.filter((value) => !removedSet.has(value))

  const keptSet = new Set(kept)
  const toAppend = diff.added.filter((value) => !keptSet.has(value))

  return [...kept, ...toAppend]
}

/** Whether an `ArrayDiff` records no additions and no removals. */
function isArrayDiffEmpty(diff: ArrayDiff): boolean {
  return diff.added.length === 0 && diff.removed.length === 0
}

// ============================================================================
// Cloning helpers (keep the engine non-mutating)
// ============================================================================

/** Deep-clone a `MinimalSchema` so callers' inputs are never mutated. */
function cloneSchema(schema: MinimalSchema): MinimalSchema {
  return {
    scene_setup: { ...schema.scene_setup },
    canvas: { ...schema.canvas },
    food_components: {
      main_item: schema.food_components.main_item,
      garnishes: [...schema.food_components.garnishes],
      sides: [...schema.food_components.sides],
    },
  }
}

/** Whether two abstract coordinates are component-wise equal. */
function coordinatesEqual(a: AbstractCoordinate, b: AbstractCoordinate): boolean {
  return a.x === b.x && a.y === b.y
}

function cloneCoordinate(coordinate: AbstractCoordinate): AbstractCoordinate {
  return { x: coordinate.x, y: coordinate.y }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compute the difference between an original and a target `EditorState`.
 *
 * Captures changed `Enum_Field` scalars (with previous/target values),
 * garnish/side set additions/removals, and an optional position change, plus an
 * `isEmpty` indicator that is true exactly when the editable subsets are equal.
 * (Requirements 9.1, 9.2, 9.3, 9.5)
 */
export function computeDelta(original: EditorState, target: EditorState): StateDelta {
  const scalarChanges: StateDelta['scalarChanges'] = []
  for (const path of ENUM_FIELD_PATHS) {
    const from = readEnumField(original.schema, path)
    const to = readEnumField(target.schema, path)
    if (from !== to) {
      scalarChanges.push({ path, from, to })
    }
  }

  const garnishes = diffArrays(
    original.schema.food_components.garnishes,
    target.schema.food_components.garnishes,
  )
  const sides = diffArrays(
    original.schema.food_components.sides,
    target.schema.food_components.sides,
  )
  const position = coordinatesEqual(original.position, target.position)
    ? undefined
    : {
        from: cloneCoordinate(original.position),
        to: cloneCoordinate(target.position),
      }

  const isEmpty =
    scalarChanges.length === 0 &&
    isArrayDiffEmpty(garnishes) &&
    isArrayDiffEmpty(sides) &&
    position === undefined

  const delta: StateDelta = {
    scalarChanges,
    arrays: { garnishes, sides },
    position,
    isEmpty,
  }
  return delta
}

/**
 * Count distinct editable-attribute changes in a delta.
 *
 * Each scalar change, each garnish/side add or remove counts as one.
 * Used to cap how many attributes are batched per mutation.
 */
export function countEditableChanges(delta: StateDelta): number {
  let count = delta.scalarChanges.length
  count += delta.arrays.garnishes.added.length
  count += delta.arrays.garnishes.removed.length
  count += delta.arrays.sides.added.length
  count += delta.arrays.sides.removed.length
  if (delta.position) {
    count += 1
  }
  return count
}

/**
 * Apply a `StateDelta` to an original `EditorState`, producing a new state.
 *
 * The returned state applies the recorded enum scalar changes, the garnish/side
 * set diffs. Non-editable schema fields
 * (`canvas.*`, `food_components.main_item`) are carried over unchanged from the
 * original. For any delta produced by {@link computeDelta} this reproduces the
 * target's editable subset exactly. (Requirement 9.4)
 *
 * The original state is never mutated.
 */
export function applyDelta(original: EditorState, delta: StateDelta): EditorState {
  const schema = cloneSchema(original.schema)

  for (const change of delta.scalarChanges) {
    writeEnumField(schema, change.path, change.to)
  }

  schema.food_components.garnishes = applyArrayDiff(
    original.schema.food_components.garnishes,
    delta.arrays.garnishes,
  )
  schema.food_components.sides = applyArrayDiff(
    original.schema.food_components.sides,
    delta.arrays.sides,
  )

  return {
    schema,
    position: delta.position ? cloneCoordinate(delta.position.to) : cloneCoordinate(original.position),
  }
}
