/**
 * Named zoom-out amounts for workbench Expand. Drag snaps to these three;
 * the server maps the snap to padRatio.
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

export const EXPAND_HANDLE_HINT =
  'Drag a corner or edge to place extra scene. Snaps to three sizes.'

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

export const EXPAND_LAYOUT_IDS = [
  'all',
  'left',
  'right',
  'top',
  'bottom',
  'top_left',
  'top_right',
  'bottom_left',
  'bottom_right',
] as const

export type ExpandLayoutId = (typeof EXPAND_LAYOUT_IDS)[number]

export type ExpandLayoutDef = {
  id: ExpandLayoutId
  label: string
}

export const EXPAND_LAYOUTS: readonly ExpandLayoutDef[] = [
  { id: 'all', label: 'All' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Above' },
  { id: 'bottom', label: 'Below' },
  { id: 'top_left', label: 'Top left' },
  { id: 'top_right', label: 'Top right' },
  { id: 'bottom_left', label: 'Bottom left' },
  { id: 'bottom_right', label: 'Bottom right' },
]

export const DEFAULT_EXPAND_LAYOUT: ExpandLayoutId = 'all'

export function isExpandLayoutId(value: unknown): value is ExpandLayoutId {
  return typeof value === 'string' && (EXPAND_LAYOUT_IDS as readonly string[]).includes(value)
}

export function parseExpandLayout(value: unknown): ExpandLayoutId {
  return isExpandLayoutId(value) ? value : DEFAULT_EXPAND_LAYOUT
}

export function expandLayoutDef(id: ExpandLayoutId): ExpandLayoutDef {
  const found = EXPAND_LAYOUTS.find((item) => item.id === id)
  if (!found) throw new RangeError(`Unknown expand layout: ${id}`)
  return found
}

export function expandLayoutLabel(id: ExpandLayoutId): string {
  return expandLayoutDef(id).label
}

export function expandShotTitle(preset: ExpandPresetId, layout: ExpandLayoutId = DEFAULT_EXPAND_LAYOUT): string {
  const amount = expandPresetLabel(preset)
  if (layout === 'all') return `Expanded · ${amount}`
  return `Expanded · ${expandLayoutLabel(layout)} · ${amount}`
}
