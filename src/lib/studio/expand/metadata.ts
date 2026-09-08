import { expandPresetLabel, type ExpandPresetId } from './presets'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type StudioExpandChildMetadata = {
  mode: 'expand'
  expand: { preset: ExpandPresetId; padRatio: number }
  changeSummary: string[]
  editorState?: unknown
  extractionDiagnostics?: unknown
  finishingTouches?: unknown
}

/**
 * Copy only the editor JSON the workbench needs. Spatial inventory and
 * object-edit coordinates belong to the old frame and must not come along.
 */
export function buildExpandChildMetadata(input: {
  parentMetadata: Record<string, unknown> | null | undefined
  preset: ExpandPresetId
  padRatio: number
}): StudioExpandChildMetadata {
  const parent = isRecord(input.parentMetadata) ? input.parentMetadata : {}
  const next: StudioExpandChildMetadata = {
    mode: 'expand',
    expand: { preset: input.preset, padRatio: input.padRatio },
    changeSummary: [`Expanded · ${expandPresetLabel(input.preset)}`],
  }
  if (parent.editorState !== undefined) next.editorState = parent.editorState
  if (parent.extractionDiagnostics !== undefined) {
    next.extractionDiagnostics = parent.extractionDiagnostics
  }
  if (parent.finishingTouches !== undefined) next.finishingTouches = parent.finishingTouches
  return next
}

export function readExpandPreset(metadata: Record<string, unknown> | null | undefined): ExpandPresetId | null {
  if (!isRecord(metadata) || metadata.mode !== 'expand') return null
  const expand = metadata.expand
  if (!isRecord(expand)) return null
  const preset = expand.preset
  if (preset === 'a_little' || preset === 'balanced' || preset === 'editorial') return preset
  return null
}
