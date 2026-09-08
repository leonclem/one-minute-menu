/**
 * Named zoom-out amounts for workbench Expand. Users pick a label; the server
 * maps it to padRatio. Drag snaps to the same three steps.
 */

export const EXPAND_PRESET_IDS = ['a_little', 'balanced', 'editorial'] as const

export type ExpandPresetId = (typeof EXPAND_PRESET_IDS)[number]

export type ExpandPresetDef = {
  id: ExpandPresetId
  label: string
  /** Extra scene on each axis: padRatio of width L/R and of height T/B. */
  padRatio: number
}

export const EXPAND_PRESETS: readonly ExpandPresetDef[] = [
  { id: 'a_little', label: 'A little wider', padRatio: 0.1 },
  { id: 'balanced', label: 'Balanced', padRatio: 0.2 },
  { id: 'editorial', label: 'Editorial', padRatio: 0.35 },
]

export const DEFAULT_EXPAND_PRESET: ExpandPresetId = 'balanced'

export const EXPAND_HELPER_TEXT =
  'Create more room around your dish without changing the food.'

export function isExpandPresetId(value: unknown): value is ExpandPresetId {
  return typeof value === 'string' && (EXPAND_PRESET_IDS as readonly string[]).includes(value)
}

export function expandPresetDef(id: ExpandPresetId): ExpandPresetDef {
  const found = EXPAND_PRESETS.find((item) => item.id === id)
  if (!found) throw new RangeError(`Unknown expand preset: ${id}`)
  return found
}

export function parseExpandPreset(value: unknown): ExpandPresetId | null {
  return isExpandPresetId(value) ? value : null
}

export function expandPresetLabel(id: ExpandPresetId): string {
  return expandPresetDef(id).label
}

export const EXPAND_MAX_PAD_RATIO = expandPresetDef('editorial').padRatio
