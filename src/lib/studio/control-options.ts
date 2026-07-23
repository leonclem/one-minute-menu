/**
 * FOH Studio control options (labels + asset basenames + schema values).
 *
 * Preview images load from `/studio/controls/{basename}.png` (see public/).
 * Lighting/background options are primarily loaded from the DB reference
 * libraries; the static lighting list below remains as a fallback.
 */

import type { AngleValue, LightingValue } from '@/lib/photo-control/minimal-schema'
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
export const STUDIO_LIGHTING_OPTIONS: StudioVisualOption<LightingValue>[] = [
  {
    id: 'light-natural',
    label: 'Natural',
    assetBasename: 'lighting/lighting-natural',
    value: 'bright-and-airy',
  },
  { id: 'light-moody', label: 'Moody', assetBasename: 'lighting/lighting-moody', value: 'low-key' },
  { id: 'light-studio', label: 'Studio', assetBasename: 'lighting/lighting-studio', value: 'studio' },
]

const ANGLE_FOH_LABELS: Partial<Record<AngleValue, string>> = {
  '45-degree': 'Angled',
  'top-down': 'Overhead',
  'eye-level': 'Eye-Level',
}

const LIGHTING_FOH_LABELS: Record<string, string> = {
  'bright-and-airy': 'Natural',
  'low-key': 'Moody',
  studio: 'Studio',
  'soft-natural-window': 'Soft Window',
  'clean-delivery': 'Delivery',
  'warm-restaurant': 'Warm Ambient',
}

export function fohAngleLabel(value: string): string {
  return ANGLE_FOH_LABELS[value as AngleValue] ?? value
}

export function fohLightingLabel(value: string): string {
  return LIGHTING_FOH_LABELS[value] ?? value
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

export function lightingStylesToOptions(
  styles: StudioLightingStyleDisplay[],
): StudioVisualOption<string>[] {
  return styles.map((style) => ({
    id: `light-${style.key}`,
    label: style.name,
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
