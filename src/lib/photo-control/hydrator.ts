/**
 * Photo Control — UI_State_Hydrator
 *
 * Initializes an `EditorState` from the `MinimalSchema` data returned by the
 * `MinimalSchemaValidator`. Hydration always proceeds from the coerced `data`
 * whenever it is present, regardless of the `strictConformance` flag.
 * (Requirement 4.1)
 *
 * Hydration sets:
 *  - `schema.scene_setup.angle`   → Camera_Control value (Requirement 4.2)
 *  - `schema.scene_setup.lighting` → Lighting_Control value (Requirement 4.3)
 *  - `schema.food_components.garnishes` / `.sides` → one removable
 *    Component_Control entry per member (Requirement 4.4)
 *  - `position` → `CENTER` (the neutral starting position) (Design: hydrator
 *    initializes position to center { x: 0, y: 0 })
 *
 * The raw `Minimal_Schema` JSON is never surfaced to the user in the primary
 * editing view; that responsibility belongs to the rendering layer.
 * (Requirement 4.6)
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { CENTER, type EditorState, type MinimalSchema } from './minimal-schema'
import { type MinimalValidationResult } from './schema-validator'

// ============================================================================
// Component Entry
// ============================================================================

/**
 * A single removable entry in the Component_Control list (garnish or side).
 * One entry is produced per member of `food_components.garnishes` and
 * `food_components.sides`. (Requirement 4.4)
 */
export interface ComponentEntry {
  /** The string label of the garnish or side. */
  label: string
  /** Which array this entry belongs to. */
  kind: 'garnish' | 'side'
}

// ============================================================================
// Hydration Result
// ============================================================================

/**
 * The result of hydrating a validated `MinimalSchema` into editor-ready state.
 *
 *  - `editorState` is the initialized `EditorState`.
 *  - `components` is the flat list of removable Component_Control entries,
 *    garnishes first then sides, in their original array order.
 */
export interface HydrationResult {
  /** The initialized editor state. */
  editorState: EditorState
  /**
   * One removable entry per garnish and per side, in the order they appear in
   * the schema arrays (garnishes first, then sides). (Requirement 4.4)
   */
  components: ComponentEntry[]
}

// ============================================================================
// Hydrate from validated data
// ============================================================================

/**
 * Initialize `EditorState` and the Component_Control entry list from the
 * validator's coerced `data`.
 *
 * Hydration proceeds regardless of the `strictConformance` flag: the caller
 * should pass the `MinimalValidationResult` directly and this function reads
 * only `result.data`. (Requirement 4.1)
 *
 * @param validated  The full `MinimalValidationResult` from `MinimalSchemaValidator`.
 *                   Only `validated.data` is consumed; the `strictConformance`
 *                   flag and `warnings` are intentionally ignored here — the
 *                   rendering layer is responsible for surfacing the warning
 *                   badge when `strictConformance` is false. (Requirement 4.8)
 */
export function hydrate(validated: MinimalValidationResult): HydrationResult {
  return hydrateFromSchema(validated.data)
}

/**
 * Initialize `EditorState` and the Component_Control entry list directly from
 * a `MinimalSchema` instance.
 *
 * This overload is useful for testing and for callers that already hold a
 * validated schema without the full `MinimalValidationResult` wrapper.
 *
 * @param schema  A validated/coerced `MinimalSchema`.
 */
export function hydrateFromSchema(schema: MinimalSchema): HydrationResult {
  // Build the EditorState: copy the schema.
  // (Requirements 4.2, 4.3, 4.4 — angle, lighting, and arrays come from the
  // schema directly.)
  const editorState: EditorState = {
    schema: {
      scene_setup: {
        angle: schema.scene_setup.angle,
        framing: schema.scene_setup.framing,
        lighting: schema.scene_setup.lighting,
      },
      canvas: {
        background: schema.canvas.background,
        background_style: schema.canvas.background_style ?? '',
        main_vessel: schema.canvas.main_vessel,
      },
      food_components: {
        main_item: schema.food_components.main_item,
        garnishes: [...schema.food_components.garnishes],
        sides: [...schema.food_components.sides],
      },
    },
    position: { ...CENTER },
  }

  // Build one removable ComponentEntry per garnish and per side.
  // (Requirement 4.4 — one entry per member, garnishes first then sides)
  const components: ComponentEntry[] = [
    ...schema.food_components.garnishes.map<ComponentEntry>((label) => ({
      label,
      kind: 'garnish',
    })),
    ...schema.food_components.sides.map<ComponentEntry>((label) => ({
      label,
      kind: 'side',
    })),
  ]

  return { editorState, components }
}
