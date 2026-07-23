/**
 * Photo Control — Directive_Generator
 *
 * Pure, framework-free, deterministic natural-language directive composer.
 * Given a `StateDelta` and the current `EditorState` context, it produces a
 * single instruction string that tells the Gemini mutation model exactly what
 * to change — and what to leave alone.
 *
 * ## Determinism guarantee
 *
 * The function is a pure mapping from `(StateDelta, EditorState)` to
 * `string | null`. It contains no randomness, no I/O, and no mutable state.
 * Identical inputs always produce identical outputs. (Requirement 9.6)
 *
 * ## Return value
 *
 * Returns `null` when `delta.isEmpty` is true (no-op delta, e.g. selecting the
 * current angle, a layout action that resolves to the same coordinate, or an
 * add/remove that does not change the array). (Requirements 5.4, 7.4, 8.6)
 *
 * Returns a non-empty string directive for any non-empty delta.
 *
 * ## Composition rules (per design doc)
 *
 * - **Angle change** — instruct a perspective change to the selected angle and
 *   preservation of the existing item configuration on the vessel. (Req 5.3)
 * - **Lighting low-key → bright-and-airy** — instruct removal of deep shadows
 *   and a clean, high-key, diffused-light setting. (Req 6.3)
 * - **Lighting bright-and-airy → low-key** — instruct dramatic low-key shadow
 *   and a darker background. (Req 6.4)
 * - **Array removal** — instruct entire removal of the named item and natural
 *   filling of the vacant space with the matching underlying background
 *   texture. (Req 8.4)
 * - **Array addition** — instruct placement of the named item consistent with
 *   the existing composition. (Req 8.5)
 * - **Subject-identity-preservation clause** — always appended; references the
 *   physical texture, shape, and structure of the main dish. (Req 11.1)
 * - **"Leave all other attributes unchanged"** — appended when the delta
 *   targets exactly one attribute. (Req 11.3)
 */

import { type EditorState, type StateDelta } from './minimal-schema'
import { countEditableChanges } from './state-delta'

// ============================================================================
// Internal clause builders
// ============================================================================

/**
 * Map a `scene_setup.angle` value to a human-readable camera-angle label.
 * The labels are intentionally stable so the directive is deterministic.
 * Incorporates industry-standard terms, technical lens specs, and synonyms
 * to improve model adherence.
 */
function angleLabel(angle: string): string {
  switch (angle) {
    case 'top-down':
      return (
        'a Top-Down / Overhead Angle (90-Degree). ' +
        'Camera perfectly parallel to surface, looking straight down. ' +
        'Deep focus (f/8.0).'
      )
    case '45-degree':
      return (
        'a 45-Degree Angle (3/4 View). ' +
        'Standard food photography shot, looking down at 45-degrees. ' +
        'Natural perspective (f/2.8).'
      )
    case 'eye-level':
      return (
        'a 0-degree Eye-Level Shot (Table-top horizon shot). ' +
        'MANDATORY: Side-view perspective. ' +
        'Camera MUST be level with table, looking across (not down). ' +
        'Top surface of plate and food must not be visible. ' +
        'Plate must render as a flat, horizontal line. ' +
        '85mm lens at f/1.8. ' +
        'CRITICAL: Entire plate and dish fully in frame, no cropping.'
      )
    case 'macro-close-up':
      return (
        'a Macro Close-Up Angle. ' +
        'Very close food photography detail with shallow depth of field. ' +
        '100mm macro lens at f/2.8.'
      )
    default:
      return `a ${angle} perspective`
  }
}

/**
 * Build the angle-change instruction clause. (Requirement 5.3)
 *
 * Instructs a perspective change to the selected angle and preservation of the
 * existing item configuration on the vessel.
 */
function buildAngleClause(to: string): string {
  return (
    `Change the camera angle to ${angleLabel(to)}. ` +
    `Preserve the existing arrangement and configuration of all items on the vessel.`
  )
}

/**
 * Build the lighting-change instruction clause. (Requirements 6.3, 6.4)
 *
 * - bright-and-airy: clean high-key diffused light with deep shadows removed.
 * - low-key: dramatic low-key lighting with richer shadows and darker mood.
 */
function buildLightingClause(from: string, to: string): string {
  const lightingMap: Record<string, string> = {
    'bright-and-airy':
      'Change the lighting to bright-and-airy high-key diffused light. Remove heavy shadows and keep the scene clean, bright, and airy.',
    'low-key':
      'Change the lighting to low-key dramatic light. Add richer shadows and a darker, moodier background while keeping the dish readable.',
    studio:
      'Change the lighting to clean commercial studio lighting: even, controlled key light with soft fill, neutral colour temperature, and a polished menu-photo look. Do not change the dish or add props.',
  }

  const instruction = lightingMap[to]
  if (instruction) {
    return instruction
  }

  // Fallback for any future lighting values
  return `Change the lighting from ${from} to ${to}.`
}

/**
 * Build an editor-position instruction clause for future touch/drag controls.
 */
function buildPositionClause(delta: NonNullable<StateDelta['position']>): string {
  const dx = delta.to.x - delta.from.x
  const dy = delta.to.y - delta.from.y

  const horizontal =
    dx < 0 ? 'left' : dx > 0 ? 'right' : delta.to.x === 0 ? 'center' : ''
  const vertical = dy < 0 ? 'up' : dy > 0 ? 'down' : delta.to.y === 0 ? 'center' : ''

  const movement = [horizontal, vertical]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(' and ')

  const oppositeHorizontal = dx < 0 ? 'right' : dx > 0 ? 'left' : ''
  const oppositeVertical = dy < 0 ? 'bottom' : dy > 0 ? 'top' : ''
  const negativeSpaceSide = [oppositeHorizontal, oppositeVertical]
    .filter(Boolean)
    .join(' and ')

  const target = movement || 'center'
  const negativeSpace = negativeSpaceSide
    ? `Maintain natural negative space on the ${negativeSpaceSide} side.`
    : 'Maintain balanced negative space around the centered subject.'

  return `Translate the subject ${target} within the frame. ${negativeSpace}`
}

/**
 * Build an array-removal instruction clause. (Requirement 8.4)
 *
 * Instructs entire removal of the named item and natural filling of the vacant
 * space with the matching underlying background texture.
 */
function buildRemovalClause(item: string, arrayType: 'garnishes' | 'sides'): string {
  const category = arrayType === 'garnishes' ? 'garnish' : 'side item'
  return (
    `Remove the ${category} "${item}" entirely from the scene. ` +
    `Fill the vacant space naturally with the matching underlying background texture.`
  )
}

/**
 * Build an array-addition instruction clause. (Requirement 8.5)
 *
 * Instructs placement of the named item consistent with the existing
 * composition.
 */
function buildAdditionClause(item: string, arrayType: 'garnishes' | 'sides'): string {
  const category = arrayType === 'garnishes' ? 'garnish' : 'side item'
  return (
    `Add "${item}" as a ${category}, placed consistently with the existing composition.`
  )
}

/**
 * Build the subject-identity-preservation clause. (Requirement 11.1)
 *
 * Always appended to every directive. References the physical texture, shape,
 * and structure of the main dish.
 */
function buildIdentityPreservationClause(mainItem: string): string {
  const subject = mainItem.trim().length > 0 ? mainItem.trim() : 'the main dish'
  return (
    `Preserve the identity of ${subject}: ` +
    `maintain texture, shape, and structure exactly as shown. ` +
    `Keep entire subject and vessel visible, no cropping.`
  )
}

/**
 * The "leave all other attributes unchanged" instruction. (Requirement 11.3)
 *
 * Appended when the delta targets exactly one attribute.
 */
const LEAVE_UNCHANGED_CLAUSE =
  'Leave all other attributes of the scene unchanged.'

// ============================================================================
// Change-count helper
// ============================================================================

/**
 * Count the number of distinct attribute changes in a delta.
 *
 * Each scalar change counts as one attribute. Each (item, arrayType) pair in
 * the array diffs counts as one attribute. A position change counts as one
 * attribute.
 *
 * This is used to decide whether to append the "leave all other attributes
 * unchanged" clause (only when exactly one attribute changed). (Requirement 11.3)
 */
// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a deterministic natural-language directive from a `StateDelta` and
 * the current `EditorState` context.
 *
 * Returns `null` when `delta.isEmpty` is true (no-op delta). Returns a
 * non-empty string directive for any non-empty delta.
 *
 * The directive always includes:
 * - Change-appropriate instruction(s) for each changed attribute.
 * - The subject-identity-preservation clause (Req 11.1).
 * - The "leave all other attributes unchanged" instruction when exactly one
 *   attribute changed (Req 11.3).
 *
 * (Requirements 5.3, 6.3, 6.4, 7.3, 8.4, 8.5, 9.6, 11.1, 11.3)
 */
export interface GenerateDirectiveOptions {
  /**
   * Scalar paths to skip when building clauses. FOH Studio uses this to omit
   * lighting/background so `/api/studio/mutate` can inject DB-resolved fragments.
   */
  excludePaths?: readonly string[]
}

export function generateDirective(
  delta: StateDelta,
  context: EditorState,
  options?: GenerateDirectiveOptions,
): string | null {
  // Return null for empty / no-op deltas. (Requirements 5.4, 7.4, 8.6)
  if (delta.isEmpty) {
    return null
  }

  const excluded = new Set(options?.excludePaths ?? [])
  const clauses: string[] = []

  // ── Scalar changes ───────────────────────────────────────────────────────

  for (const change of delta.scalarChanges) {
    if (excluded.has(change.path)) {
      continue
    }
    if (change.path === 'scene_setup.angle') {
      clauses.push(buildAngleClause(change.to))
    } else if (change.path === 'scene_setup.spin') {
      if (change.to === 'left-45') {
        clauses.push(
          'Rotate the entire dish, vessel, and its contents 45 degrees counter-clockwise (to the left) within the same horizontal visual plane. ' +
          'MANDATORY VERTICAL ANGLE DENIAL: The vertical camera height, camera pitch, elevation, zoom, and perspective MUST remain absolutely identical to the original image. ' +
          'HORIZONTAL ORBIT FORCE: The camera must horizontally orbit around the dish, or the main dish itself must spin on the surface, moving all food arrangements and containers 45 degrees counter-clockwise around the center.'
        )
      } else if (change.to === 'right-45') {
        clauses.push(
          'Rotate the entire dish, vessel, and its contents 45 degrees clockwise (to the right) within the same horizontal visual plane. ' +
          'MANDATORY VERTICAL ANGLE DENIAL: The vertical camera height, camera pitch, elevation, zoom, and perspective MUST remain absolutely identical to the original image. ' +
          'HORIZONTAL ORBIT FORCE: The camera must horizontally orbit around the dish, or the main dish itself must spin on the surface, moving all food arrangements and containers 45 degrees clockwise around the center.'
        )
      } else if (change.to === '0') {
        clauses.push(
          'Return the dish, vessel, and its contents to their original, unrotated horizontal orientation.'
        )
      }
    } else if (change.path === 'scene_setup.lighting') {
      // Admin sandbox fallback; FOH excludes this path and resolves from DB.
      clauses.push(buildLightingClause(change.from, change.to))
    } else if (change.path === 'canvas.background_style') {
      // Admin/fallback only — FOH excludes and resolves from DB.
      clauses.push(
        `Change only the background backdrop to style "${change.to}". ` +
          `Keep the tabletop surface, its shadows, and the dish itself completely locked.`,
      )
    } else if (change.path === 'canvas.surface_style') {
      // Admin/fallback only — FOH excludes and resolves from DB.
      clauses.push(
        `Change only the tabletop surface to style "${change.to}". ` +
          `Keep the background backdrop, its shadows, and the dish itself completely locked.`,
      )
    }
    // scene_setup.framing: no directive rule specified in design; skip silently
    // (framing is not exposed as a user-facing control in v1)
  }

  // ── Array changes — garnishes ────────────────────────────────────────────

  for (const item of delta.arrays.garnishes.removed) {
    clauses.push(buildRemovalClause(item, 'garnishes'))
  }
  for (const item of delta.arrays.garnishes.added) {
    clauses.push(buildAdditionClause(item, 'garnishes'))
  }

  // ── Array changes — sides ────────────────────────────────────────────────

  for (const item of delta.arrays.sides.removed) {
    clauses.push(buildRemovalClause(item, 'sides'))
  }
  for (const item of delta.arrays.sides.added) {
    clauses.push(buildAdditionClause(item, 'sides'))
  }

  // ── Editor-only position changes ──────────────────────────────────────────

  if (delta.position) {
    clauses.push(buildPositionClause(delta.position))
  }

  // ── Subject-identity-preservation clause (always present) ────────────────
  // (Requirement 11.1)

  const mainItem = context.schema.food_components.main_item
  clauses.push(buildIdentityPreservationClause(mainItem))

  // ── "Leave all other attributes unchanged" (single-attribute changes only)
  // (Requirement 11.3)

  if (countEditableChanges(delta) === 1) {
    clauses.push(LEAVE_UNCHANGED_CLAUSE)
  }

  return clauses.join(' ')
}
