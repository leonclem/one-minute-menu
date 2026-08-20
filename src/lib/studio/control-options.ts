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
import {
  fohLightingLabel,
  STUDIO_LIGHTING_OPTION_ORDER,
} from '@/lib/studio/lighting-keys'
import {
  fohBackdropLabel,
  STUDIO_BACKDROP_OPTION_ORDER,
} from '@/lib/studio/backdrop-keys'
import {
  fohSurfaceLabel,
  STUDIO_SURFACE_OPTION_ORDER,
} from '@/lib/studio/surface-keys'

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
  {
    id: 'light-bright-clean',
    label: 'Bright & Clean',
    assetBasename: 'lighting/lighting-bright-clean',
    value: 'bright-clean',
  },
  {
    id: 'light-bold-sunlight',
    label: 'Bold Sunlight',
    assetBasename: 'lighting/lighting-bold-sunlight',
    value: 'bold-sunlight',
  },
  {
    id: 'light-soft-natural',
    label: 'Soft Natural',
    assetBasename: 'lighting/lighting-soft-natural',
    value: 'soft-natural',
  },
  {
    id: 'light-golden-hour',
    label: 'Golden Hour',
    assetBasename: 'lighting/lighting-golden-hour',
    value: 'golden-hour',
  },
  {
    id: 'light-dark-moody',
    label: 'Dark & Moody',
    assetBasename: 'lighting/lighting-dark-moody',
    value: 'dark-moody',
  },
]

const ANGLE_FOH_LABELS: Partial<Record<AngleValue, string>> = {
  '45-degree': 'Angled',
  'top-down': 'Overhead',
  'eye-level': 'Eye-Level',
}

export function fohAngleLabel(value: string): string {
  return ANGLE_FOH_LABELS[value as AngleValue] ?? value
}

export { fohBackdropLabel, fohLightingLabel, fohSurfaceLabel }

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
  return [...styles]
    .sort((a, b) => {
      const aIndex = STUDIO_LIGHTING_OPTION_ORDER.indexOf(a.key as (typeof STUDIO_LIGHTING_OPTION_ORDER)[number])
      const bIndex = STUDIO_LIGHTING_OPTION_ORDER.indexOf(b.key as (typeof STUDIO_LIGHTING_OPTION_ORDER)[number])
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.sort_order - b.sort_order
    })
    .map((style) => ({
      id: `light-${style.key}`,
      label: fohLightingLabel(style.key, style.name),
      assetBasename: style.thumbnail_path || `lighting/lighting-${style.key}`,
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

export function backdropStylesToOptions(
  styles: StudioBackgroundStyleDisplay[],
): StudioVisualOption<string>[] {
  return [...styles]
    .sort((a, b) => {
      const aIndex = STUDIO_BACKDROP_OPTION_ORDER.indexOf(a.key as (typeof STUDIO_BACKDROP_OPTION_ORDER)[number])
      const bIndex = STUDIO_BACKDROP_OPTION_ORDER.indexOf(b.key as (typeof STUDIO_BACKDROP_OPTION_ORDER)[number])
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.sort_order - b.sort_order
    })
    .map((style) => ({
      id: `backdrop-${style.key}`,
      label: fohBackdropLabel(style.key, style.name),
      assetBasename: style.thumbnail_path || `backdrops/backdrop-${style.key}`,
      value: style.key,
    }))
}

export function surfaceStylesToOptions(
  styles: StudioBackgroundStyleDisplay[],
): StudioVisualOption<string>[] {
  return [...styles]
    .sort((a, b) => {
      const aIndex = STUDIO_SURFACE_OPTION_ORDER.indexOf(a.key as (typeof STUDIO_SURFACE_OPTION_ORDER)[number])
      const bIndex = STUDIO_SURFACE_OPTION_ORDER.indexOf(b.key as (typeof STUDIO_SURFACE_OPTION_ORDER)[number])
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.sort_order - b.sort_order
    })
    .map((style) => ({
      id: `surface-${style.key}`,
      label: fohSurfaceLabel(style.key, style.name),
      assetBasename: style.thumbnail_path || `surfaces/surface-${style.key}`,
      value: style.key,
    }))
}

export function styleLabelMap(
  styles: Array<{ key: string; name: string }>,
): Record<string, string> {
  return Object.fromEntries(styles.map((style) => [style.key, style.name]))
}
