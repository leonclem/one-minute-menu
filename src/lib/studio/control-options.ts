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
 * Rotation tiles. Schema has no left/right yaw yet — Right 45° maps to
 * `eye-level` as an interim distinct camera change (logged in tracker).
 */
export const STUDIO_ROTATION_OPTIONS: StudioVisualOption<AngleValue>[] = [
  { id: 'rotate-left45', label: 'Left 45°', assetBasename: 'rotate-left45', value: '45-degree' },
  { id: 'rotate-overhead', label: 'Overhead', assetBasename: 'rotate-overhead', value: 'top-down' },
  { id: 'rotate-right45', label: 'Right 45°', assetBasename: 'rotate-right45', value: 'eye-level' },
]

/** Fallback lighting tiles when the styles API is unavailable. */
export const STUDIO_LIGHTING_OPTIONS: StudioVisualOption<LightingValue>[] = [
  {
    id: 'light-natural',
    label: 'Natural',
    assetBasename: 'light-natural',
    value: 'bright-and-airy',
  },
  { id: 'light-moody', label: 'Moody', assetBasename: 'light-moody', value: 'low-key' },
  { id: 'light-studio', label: 'Studio', assetBasename: 'light-studio', value: 'studio' },
]

const ANGLE_FOH_LABELS: Partial<Record<AngleValue, string>> = {
  '45-degree': 'Left 45°',
  'top-down': 'Overhead',
  'eye-level': 'Right 45°',
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
  return `/studio/controls/${basename}.png`
}

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
