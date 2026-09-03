/**
 * Workbench crop floors and aspect presets.
 *
 * `CROP_LOW_RES_WARN_PX` is a product quality warning, not a Gemini or sharp
 * constraint. Studio Generate still omits imageConfig.aspectRatio (source framing).
 * `CROP_MIN_WINDOW_PX` only keeps the overlay from collapsing so handles stay usable.
 */

export const CROP_MIN_WINDOW_PX = 32
export const CROP_LOW_RES_WARN_PX = 1024

/**
 * Overlay min-window math when `studio_images` has no stored width/height.
 * Large enough that a missing size cannot lock the crop window.
 */
export const CROP_UNKNOWN_PIXEL_SIZE = { width: 10_000, height: 10_000 }

export const CROP_ASPECT_PRESET_IDS = [
  'original',
  '1:1',
  '4:5',
  '3:4',
  '4:3',
  '16:9',
  '9:16',
  'free',
] as const

export type CropAspectPreset = (typeof CROP_ASPECT_PRESET_IDS)[number]

export type CropAspectPresetDef = {
  id: CropAspectPreset
  label: string
  /** Pixel width / height. Null means unlocked (Free) or derived from the photo (Original). */
  pixelAspect: number | null
}

export const CROP_ASPECT_PRESETS: readonly CropAspectPresetDef[] = [
  { id: 'original', label: 'Original', pixelAspect: null },
  { id: '1:1', label: '1:1', pixelAspect: 1 },
  { id: '4:5', label: '4:5', pixelAspect: 4 / 5 },
  { id: '3:4', label: '3:4', pixelAspect: 3 / 4 },
  { id: '4:3', label: '4:3', pixelAspect: 4 / 3 },
  { id: '16:9', label: '16:9', pixelAspect: 16 / 9 },
  { id: '9:16', label: '9:16', pixelAspect: 9 / 16 },
  { id: 'free', label: 'Free', pixelAspect: null },
]

export function isCropAspectPreset(value: unknown): value is CropAspectPreset {
  return typeof value === 'string' && (CROP_ASPECT_PRESET_IDS as readonly string[]).includes(value)
}

export function cropPresetDef(id: CropAspectPreset): CropAspectPresetDef {
  const found = CROP_ASPECT_PRESETS.find((preset) => preset.id === id)
  if (!found) throw new RangeError(`Unknown crop aspect preset: ${id}`)
  return found
}
