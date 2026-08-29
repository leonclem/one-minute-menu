import { GeminiExtractionClient } from '@/lib/photo-control/gemini-extraction-client'
import { MinimalSchemaValidator } from '@/lib/photo-control/schema-validator'
import { MinimalSchemaZ, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { loadStudioImageBytes } from '@/lib/studio/image-bytes'
import { readEditorStateFromMetadata } from '@/lib/studio/editor-state-storage'
import { updateStudioImageMetadata } from '@/lib/studio/library'
import type { StudioImageRecord } from '@/lib/studio/types'
import type { StructuredEditIntent } from './contracts'
import type { SpatialElementV1 } from './spatial-inventory'

export const EDITOR_STATE_VERSION = 1 as const

export class CanonicalSourceStateError extends Error {
  readonly status = 422
  readonly code = 'INVALID_CANONICAL_SOURCE_STATE' as const

  constructor(message = 'Unable to establish valid canonical source state') {
    super(message)
    this.name = 'CanonicalSourceStateError'
  }
}

export interface CanonicalSourceState {
  version: typeof EDITOR_STATE_VERSION
  editorState: EditorState
  /** A cloned Minimal Schema suitable for direct-parent child initialization. */
  schema: MinimalSchema
  hydrated: boolean
}

export interface CanonicalStateDependencies {
  hydrate?: (source: StudioImageRecord) => Promise<EditorState | null>
  persistMetadata?: (
    userId: string,
    imageId: string,
    patch: Record<string, unknown>,
  ) => Promise<unknown>
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function validateEditorState(value: EditorState | null): EditorState | null {
  if (!value) return null
  const result = MinimalSchemaZ.safeParse(value.schema)
  if (!result.success) return null
  const x = value.position?.x
  const y = value.position?.y
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    schema: clone(result.data),
    position: { x, y },
  }
}

async function hydrateCanonicalSource(source: StudioImageRecord): Promise<EditorState | null> {
  const bytes = await loadStudioImageBytes(source.user_id, source.id)
  const client = new GeminiExtractionClient()
  const { raw } = await client.extract({
    imageBase64: bytes.base64,
    mimeType: bytes.mimeType,
  })
  const validated = new MinimalSchemaValidator().validate(raw)
  const schema = MinimalSchemaZ.safeParse(validated.data)
  if (!schema.success) return null
  return {
    schema: schema.data,
    position: { x: 0, y: 0 },
  }
}

/**
 * Reads a direct source's persisted compatibility state, or hydrates legacy
 * images through the established extraction pipeline. No ancestor is read.
 */
export async function establishCanonicalSourceState(
  source: StudioImageRecord,
  dependencies: CanonicalStateDependencies = {},
): Promise<CanonicalSourceState> {
  const persistMetadata = dependencies.persistMetadata ?? updateStudioImageMetadata
  const persisted = validateEditorState(readEditorStateFromMetadata(source.metadata))
  if (persisted) {
    // Retain the established editorState shape and add only its version marker
    // when a compatible legacy row predates versioned canonical state.
    if (source.metadata.editorStateVersion !== EDITOR_STATE_VERSION) {
      try {
        await persistMetadata(source.user_id, source.id, { editorStateVersion: EDITOR_STATE_VERSION })
      } catch (error) {
        throw new CanonicalSourceStateError(
          error instanceof Error
            ? `Unable to persist canonical source state version: ${error.message}`
            : 'Unable to persist canonical source state version',
        )
      }
    }
    return {
      version: EDITOR_STATE_VERSION,
      editorState: persisted,
      schema: clone(persisted.schema),
      hydrated: false,
    }
  }

  let hydrated: EditorState | null
  try {
    hydrated = validateEditorState(await (dependencies.hydrate ?? hydrateCanonicalSource)(source))
  } catch {
    hydrated = null
  }
  if (!hydrated) {
    throw new CanonicalSourceStateError()
  }

  try {
    await persistMetadata(source.user_id, source.id, {
      editorStateVersion: EDITOR_STATE_VERSION,
      editorState: {
        schema: hydrated.schema,
        position: hydrated.position,
      },
    })
  } catch (error) {
    throw new CanonicalSourceStateError(
      error instanceof Error
        ? `Unable to persist hydrated canonical source state: ${error.message}`
        : 'Unable to persist hydrated canonical source state',
    )
  }

  return {
    version: EDITOR_STATE_VERSION,
    editorState: hydrated,
    schema: clone(hydrated.schema),
    hydrated: true,
  }
}

export type CanonicalMapping =
  | { kind: 'scalar'; section: 'canvas'; field: 'main_vessel' }
  | { kind: 'scalar'; section: 'food_components'; field: 'main_item' }
  | { kind: 'array'; field: 'garnishes' | 'sides'; value: string }

function normalizeExact(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/**
 * Maps only a uniquely identified spatial element to an exact Minimal Schema
 * field. It deliberately performs no fuzzy-label inference.
 */
export function findConfidentCanonicalMapping(
  schema: MinimalSchema,
  element: SpatialElementV1 | null | undefined,
): CanonicalMapping | null {
  const ref = element?.componentRef
  if (!ref || (element.visibility !== 'visible' && element.visibility !== 'partial')) return null

  if (ref.section === 'canvas' && ref.field === 'main_vessel') {
    if (!ref.value || normalizeExact(schema.canvas.main_vessel) !== normalizeExact(ref.value)) return null
    return { kind: 'scalar', section: 'canvas', field: 'main_vessel' }
  }
  if (ref.section === 'food_components' && ref.field === 'main_item') {
    if (!ref.value || normalizeExact(schema.food_components.main_item) !== normalizeExact(ref.value)) return null
    return { kind: 'scalar', section: 'food_components', field: 'main_item' }
  }
  if (
    ref.section === 'food_components' &&
    (ref.field === 'garnishes' || ref.field === 'sides') &&
    ref.value
  ) {
    const matches = schema.food_components[ref.field].filter(
      (value) => normalizeExact(value) === normalizeExact(ref.value!),
    )
    if (matches.length !== 1) return null
    return { kind: 'array', field: ref.field, value: matches[0] }
  }
  return null
}

/**
 * Initializes from the submitted direct parent only. Move is an exact clone;
 * Remove changes at most one exact, confidently mapped Minimal Schema field.
 */
export function buildCandidateCanonicalState(input: {
  directParent: CanonicalSourceState | MinimalSchema
  intent: StructuredEditIntent
  matchedElement?: SpatialElementV1 | null
}): MinimalSchema {
  const parent = 'schema' in input.directParent ? input.directParent.schema : input.directParent
  const candidate = clone(parent)
  if (input.intent.operation !== 'remove') return candidate

  const mapping = findConfidentCanonicalMapping(parent, input.matchedElement)
  if (!mapping) return candidate
  if (mapping.kind === 'array') {
    candidate.food_components[mapping.field] = candidate.food_components[mapping.field].filter(
      (value) => value !== mapping.value,
    )
  } else if (mapping.section === 'canvas') {
    candidate.canvas[mapping.field] = ''
  } else {
    candidate.food_components[mapping.field] = ''
  }
  return candidate
}
