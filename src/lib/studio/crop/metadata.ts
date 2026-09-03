import { isCropAspectPreset, type CropAspectPreset } from '@/lib/studio/crop/constants'
import type { NormalizedCropRect } from '@/lib/studio/crop/geometry'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type StudioCropChildMetadata = {
  mode: 'crop'
  crop: NormalizedCropRect & { aspectPreset: CropAspectPreset }
  editorState?: unknown
  extractionDiagnostics?: unknown
  finishingTouches?: unknown
}

/**
 * Copy only the editor JSON the workbench needs. Spatial inventory and
 * object-edit coordinates are relative to the old frame and must not come along.
 */
export function buildCropChildMetadata(input: {
  parentMetadata: Record<string, unknown> | null | undefined
  crop: NormalizedCropRect
  aspectPreset: CropAspectPreset
}): StudioCropChildMetadata {
  const parent = isRecord(input.parentMetadata) ? input.parentMetadata : {}
  const next: StudioCropChildMetadata = {
    mode: 'crop',
    crop: { ...input.crop, aspectPreset: input.aspectPreset },
  }
  if (parent.editorState !== undefined) next.editorState = parent.editorState
  if (parent.extractionDiagnostics !== undefined) {
    next.extractionDiagnostics = parent.extractionDiagnostics
  }
  if (parent.finishingTouches !== undefined) next.finishingTouches = parent.finishingTouches
  return next
}

export function parseCropAspectPreset(value: unknown): CropAspectPreset {
  if (isCropAspectPreset(value)) return value
  return 'free'
}
