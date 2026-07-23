/**
 * Persist / restore Photo Control editor JSON on studio_images.metadata.
 */

import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function editorStateToMetadata(state: EditorState): Record<string, unknown> {
  return {
    schema: state.schema,
    position: state.position,
  }
}

export function readEditorStateFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): EditorState | null {
  if (!metadata) return null
  const raw = metadata.editorState
  if (!isRecord(raw) || !isRecord(raw.schema)) return null

  const schema = raw.schema as unknown as MinimalSchema
  if (!schema.scene_setup || !schema.food_components) return null

  // Normalize optional spin on older clients/persisted states.
  if (typeof schema.scene_setup.spin !== 'string') {
    schema.scene_setup.spin = '0'
  }

  // Chunk 2/3 rows may lack background_style — default to empty.
  if (!schema.canvas) {
    schema.canvas = { background: '', background_style: '', surface_style: '', main_vessel: '' }
  } else {
    if (typeof schema.canvas.background_style !== 'string') {
      schema.canvas.background_style = ''
    }
    if (typeof schema.canvas.surface_style !== 'string') {
      schema.canvas.surface_style = ''
    }
  }

  const position = isRecord(raw.position)
    ? {
        x: typeof raw.position.x === 'number' ? raw.position.x : 0,
        y: typeof raw.position.y === 'number' ? raw.position.y : 0,
      }
    : { ...CENTER }

  return { schema, position }
}
