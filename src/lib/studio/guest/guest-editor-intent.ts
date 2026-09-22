import type { EditorState } from '@/lib/photo-control/minimal-schema'

const SKIP_EXTRACT_KEY = 'skipExtractUntilClaimed'
const STAGED_INTENT_KEY = 'guestStagedIntent'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function shouldSkipExtractUntilClaimed(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return metadata?.[SKIP_EXTRACT_KEY] === true
}

export function withGuestSkipExtract(
  metadata: Record<string, unknown>,
  editorState: EditorState,
): Record<string, unknown> {
  return {
    ...metadata,
    [SKIP_EXTRACT_KEY]: true,
    [STAGED_INTENT_KEY]: {
      lighting: editorState.schema.scene_setup.lighting,
      background_style: editorState.schema.canvas.background_style ?? '',
      surface_style: editorState.schema.canvas.surface_style ?? '',
    },
    editorState: {
      schema: editorState.schema,
      position: editorState.position,
    },
  }
}

export function guestStagedIntentFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): { lighting: string; background_style: string; surface_style: string } | null {
  const raw = metadata?.[STAGED_INTENT_KEY]
  if (!isRecord(raw)) return null
  const lighting = typeof raw.lighting === 'string' ? raw.lighting : null
  if (!lighting) return null
  return {
    lighting,
    background_style: typeof raw.background_style === 'string' ? raw.background_style : '',
    surface_style: typeof raw.surface_style === 'string' ? raw.surface_style : '',
  }
}

export function overlayGuestIntentOnExtracted(
  extracted: EditorState,
  intent: { lighting: string; background_style: string; surface_style: string },
): EditorState {
  return {
    ...extracted,
    schema: {
      ...extracted.schema,
      scene_setup: {
        ...extracted.schema.scene_setup,
        lighting: intent.lighting || extracted.schema.scene_setup.lighting,
      },
      canvas: {
        ...extracted.schema.canvas,
        background_style: intent.background_style,
        surface_style: intent.surface_style,
      },
    },
  }
}

export function clearGuestExtractFlags(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...metadata }
  delete next[SKIP_EXTRACT_KEY]
  delete next[STAGED_INTENT_KEY]
  return next
}

/** After claim extract: drop the skip flag but keep staged lighting/surface/backdrop. */
export function withClaimedExtract(
  metadata: Record<string, unknown>,
  editorState: EditorState,
): Record<string, unknown> {
  return {
    ...metadata,
    [SKIP_EXTRACT_KEY]: false,
    editorState: {
      schema: editorState.schema,
      position: editorState.position,
    },
  }
}
