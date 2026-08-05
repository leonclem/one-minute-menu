/**
 * FOH Studio control options (labels + asset basenames + schema values).
 *
 * Preview images load from `/studio/controls/{basename}.png` (see public/).
 * Lighting/background options are primarily loaded from the DB reference
 * libraries; the static lighting list below remains as a fallback.
 */

import type { AngleValue } from '@/lib/photo-control/minimal-schema'
import type {
  StudioBackgroundStyleDisplay,
  StudioLightingStyleDisplay,
} from '@/lib/studio/types'

export interface StudioVisualOption<T extends string> {
  id: string
  label: string
  /** Basename without extension — resolved under /studio/controls/ */
  assetBasename: string
  value: T
}

/**
 * Camera height options. Hides problematic 'eye-level' entirely.
 */
export const STUDIO_CAMERA_ANGLE_OPTIONS: StudioVisualOption<AngleValue>[] = [
  { id: 'angle-45', label: 'Angled', assetBasename: 'ui/ui-rotate-left45', value: '45-degree' },
  { id: 'angle-overhead', label: 'Overhead', assetBasename: 'ui/ui-rotate-overhead', value: 'top-down' },
]

/**
 * Dish horizontal rotation (spin) options.
 */
export const STUDIO_SPIN_OPTIONS: StudioVisualOption<string>[] = [
  { id: 'spin-left45', label: 'Spin Left 45°', assetBasename: 'ui/ui-rotate-left45', value: 'left-45' },
  { id: 'spin-right45', label: 'Spin Right 45°', assetBasename: 'ui/ui-rotate-right45', value: 'right-45' },
]

/** Fallback lighting tiles when the styles API is unavailable. */
export const STUDIO_LIGHTING_OPTIONS: StudioVisualOption<string>[] = [
  { id: 'light-studio', label: 'Studio', assetBasename: 'lighting/lighting-studio', value: 'studio' },
  {
    id: 'light-natural',
    label: 'Window Light',
    assetBasename: 'lighting/lighting-natural',
    value: 'bright-and-airy',
  },
  { id: 'light-golden-hour', label: 'Golden Hour', assetBasename: 'lighting/lighting-golden-hour', value: 'golden-hour' },
  { id: 'light-moody', label: 'Low-Key / Dramatic', assetBasename: 'lighting/lighting-moody', value: 'low-key' },
]

const ANGLE_FOH_LABELS: Partial<Record<AngleValue, string>> = {
  '45-degree': 'Angled',
  'top-down': 'Overhead',
  'eye-level': 'Eye-Level',
}

const LIGHTING_FOH_LABELS: Record<string, string> = {
  'bright-and-airy': 'Window Light',
  'low-key': 'Low-Key / Dramatic',
  studio: 'Studio',
  'golden-hour': 'Golden Hour',
}

export function fohAngleLabel(value: string): string {
  return ANGLE_FOH_LABELS[value as AngleValue] ?? value
}

/** Return the requested Studio label, falling back to a custom DB name. */
export function fohLightingLabel(value: string, fallback?: string): string {
  return LIGHTING_FOH_LABELS[value] ?? fallback ?? value
}

export function controlAssetSrc(basename: string): string {
  if (basename.includes('/')) {
    return `/studio/${basename}.png`
  }
  return `/studio/controls/${basename}.png`
}

/**
 * Scalar paths whose directive clauses are resolved server-side from the DB
 * reference libraries (never emit client-side prompt fragments).
 */
export const FOH_STYLE_EXCLUDE_PATHS = [
  'scene_setup.lighting',
  'canvas.background_style',
  'canvas.surface_style',
] as const

const LIGHTING_OPTION_ORDER = ['studio', 'bright-and-airy', 'golden-hour', 'low-key']

export function lightingStylesToOptions(
  styles: StudioLightingStyleDisplay[],
): StudioVisualOption<string>[] {
  return [...styles]
    .sort((a, b) => {
      const aIndex = LIGHTING_OPTION_ORDER.indexOf(a.key)
      const bIndex = LIGHTING_OPTION_ORDER.indexOf(b.key)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.sort_order - b.sort_order
    })
    .map((style) => ({
      id: `light-${style.key}`,
      label: fohLightingLabel(style.key, style.name),
      assetBasename: style.thumbnail_path || `light-${style.key}`,
      value: style.key,
    }))
}

export function backgroundStylesToOptions(
  styles: StudioBackgroundStyleDisplay[],
): StudioVisualOption<string>[] {
  return styles.map((style) => ({
    id: `bg-${style.key}`,
    label: style.name,
    assetBasename: style.thumbnail_path || `bg-${style.key}`,
    value: style.key,
  }))
}

export function styleLabelMap(
  styles: Array<{ key: string; name: string }>,
): Record<string, string> {
  return Object.fromEntries(styles.map((style) => [style.key, style.name]))
}
