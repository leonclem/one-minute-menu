/**
 * Photo Studio — Export Variants preset configuration.
 *
 * Data-driven so dimensions, credit treatment, and generation method can change
 * without touching UI or route logic. Safe to import from client components:
 * this module must stay free of server-only dependencies.
 *
 * See `.kiro/specs/studio-export/GridMenu_Studio_Export_Formats_Feature_Writeup_2026-07-31.md`.
 */

export type StudioExportVariantType =
  | 'delivery_square'
  | 'delivery_landscape'
  | 'instagram_feed'
  | 'pdf_menu_tile'
  | 'transparent_cutout'

export type StudioExportFileType = 'jpg' | 'png' | 'webp'

export type StudioExportGenerationMethod =
  | 'crop_resize'
  | 'ai_expand'
  | 'ai_recompose'
  | 'cutout'

export type StudioExportStatus = 'empty' | 'queued' | 'generating' | 'ready' | 'failed'

export type StudioExportPriority = 'mvp' | 'deferred'

export interface StudioExportPreset {
  key: StudioExportVariantType
  label: string
  width: number
  height: number
  aspectRatio: string
  fileType: StudioExportFileType
  priority: StudioExportPriority
  /** Short "what is this for" line shown in the tile menu. */
  hint: string
  /** Method used when the hero image can satisfy this format deterministically. */
  baseMethod: StudioExportGenerationMethod
  /**
   * Method used when a centre crop would discard more of the hero than
   * `maxCropLoss` allows. Omit to always stay deterministic (never charged).
   */
  expandMethod?: StudioExportGenerationMethod
  /**
   * Fraction of the hero image area that may be discarded by a centre crop
   * before the variant escalates to `expandMethod`. `1` means "always crop".
   */
  maxCropLoss: number
  /**
   * Nearest aspect ratio the image model accepts when outpainting. The output
   * is normalised to the exact `width`/`height` afterwards.
   */
  requestAspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
}

/**
 * MVP export grid. Order is the display order in the Studio export panel.
 */
export const EXPORT_PRESETS: readonly StudioExportPreset[] = [
  {
    key: 'delivery_square',
    label: 'Delivery Square',
    width: 1200,
    height: 1200,
    aspectRatio: '1:1',
    fileType: 'jpg',
    priority: 'mvp',
    hint: 'Delivery thumbnails, menu item cards, square website tiles.',
    baseMethod: 'crop_resize',
    expandMethod: 'ai_expand',
    // Tolerates 4:3 and 3:4 heroes without paying for a generation.
    maxCropLoss: 0.3,
    requestAspectRatio: '1:1',
  },
  {
    key: 'delivery_landscape',
    label: 'Delivery Landscape',
    width: 1600,
    height: 900,
    aspectRatio: '16:9',
    fileType: 'jpg',
    priority: 'mvp',
    hint: 'Landscape delivery slots, marketplace cards, banners.',
    baseMethod: 'crop_resize',
    expandMethod: 'ai_expand',
    // A square hero cropped to 16:9 loses ~44% — expand instead.
    maxCropLoss: 0.2,
    requestAspectRatio: '16:9',
  },
  {
    key: 'instagram_feed',
    label: 'Instagram Feed',
    width: 1080,
    height: 1350,
    aspectRatio: '4:5',
    fileType: 'jpg',
    priority: 'mvp',
    hint: 'Portrait social feed posts and campaign assets.',
    baseMethod: 'crop_resize',
    expandMethod: 'ai_expand',
    maxCropLoss: 0.15,
    // 4:5 is not an accepted model ratio; 3:4 is the nearest portrait option.
    requestAspectRatio: '3:4',
  },
  {
    key: 'pdf_menu_tile',
    label: 'PDF Menu Tile',
    width: 1500,
    height: 1500,
    aspectRatio: '1:1',
    fileType: 'jpg',
    priority: 'mvp',
    hint: 'Menu layouts, PDF menus, designer handoff, dish grids.',
    baseMethod: 'crop_resize',
    // Deliberately always deterministic: a menu tile is included, never charged.
    maxCropLoss: 1,
    requestAspectRatio: '1:1',
  },
  {
    key: 'transparent_cutout',
    label: 'Cut-Out (PNG)',
    width: 2048,
    height: 2048,
    aspectRatio: '1:1',
    fileType: 'png',
    priority: 'mvp',
    hint: 'Reusable dish asset for posters, layouts, and ad creative.',
    baseMethod: 'cutout',
    maxCropLoss: 1,
  },
] as const

const PRESET_BY_KEY = new Map<string, StudioExportPreset>(
  EXPORT_PRESETS.map((preset) => [preset.key, preset]),
)

export function getExportPreset(key: string): StudioExportPreset | null {
  return PRESET_BY_KEY.get(key) ?? null
}

export function isStudioExportVariantType(value: unknown): value is StudioExportVariantType {
  return typeof value === 'string' && PRESET_BY_KEY.has(value)
}

export const MIME_BY_EXPORT_FILE_TYPE: Record<StudioExportFileType, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Fraction of the canvas reserved as padding around a transparent cut-out. */
export const CUTOUT_CANVAS_PADDING_RATIO = 0.06

/** JPEG quality used for deterministic exports. */
export const EXPORT_JPEG_QUALITY = 88

/**
 * Share of the hero image area kept by a centre crop to `targetAspect`.
 * Mirrors sharp's `fit: 'cover'` behaviour.
 */
export function centreCropKeptFraction(sourceAspect: number, targetAspect: number): number {
  if (!Number.isFinite(sourceAspect) || !Number.isFinite(targetAspect)) return 1
  if (sourceAspect <= 0 || targetAspect <= 0) return 1
  return Math.min(sourceAspect, targetAspect) / Math.max(sourceAspect, targetAspect)
}

export interface ExportSourceDimensions {
  width: number
  height: number
}

/**
 * Decide how a variant should be produced from the approved hero image.
 *
 * Deterministic crop/resize is always preferred; AI expansion is only selected
 * when a centre crop would discard more of the dish framing than the preset
 * tolerates, and only when AI expansion is enabled.
 */
export function resolveExportGenerationMethod(
  preset: StudioExportPreset,
  source: ExportSourceDimensions | null,
  options?: { aiExpandEnabled?: boolean },
): StudioExportGenerationMethod {
  if (preset.baseMethod === 'cutout') return 'cutout'
  if (!preset.expandMethod) return preset.baseMethod
  if (options?.aiExpandEnabled === false) return preset.baseMethod
  if (!source || source.width <= 0 || source.height <= 0) return preset.baseMethod

  const kept = centreCropKeptFraction(
    source.width / source.height,
    preset.width / preset.height,
  )
  return 1 - kept > preset.maxCropLoss ? preset.expandMethod : preset.baseMethod
}

/** Human-readable credit line for a tile, e.g. `included` or `1 credit`. */
export function formatExportCreditLabel(credits: number): string {
  if (credits <= 0) return 'included'
  return `${credits} credit${credits === 1 ? '' : 's'}`
}

export function formatExportDimensions(preset: StudioExportPreset): string {
  return `${preset.width} × ${preset.height} (${preset.aspectRatio})`
}

/** Filename used when a variant is downloaded. */
export function buildExportFilename(
  preset: StudioExportPreset,
  dishName?: string | null,
): string {
  const slug = (dishName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const prefix = slug ? `${slug}-` : ''
  return `${prefix}${preset.key}-${preset.width}x${preset.height}.${preset.fileType}`
}
