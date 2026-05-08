import type { SelectionConfigV2 } from './engine-types-v2'

export type ThemePresetIdV2 = 'galactic-menu'

export interface ThemePresetV2 {
  id: ThemePresetIdV2
  /** Marketing tagline shown in the UI when the preset is available. */
  tagline: string
  /** Palette ID that activates this preset. */
  paletteId: string
  /** When present, preset is enabled only before this instant (exclusive). */
  enabledUntil?: string
  /** Selection config values that should be enforced while the preset is active. */
  lockedSelection: Partial<SelectionConfigV2>
  /** Restrict spacer tile pattern IDs while the preset is active. */
  allowedSpacerTilePatternIds: string[]
}

/**
 * Theme presets are intentionally lightweight: they are applied in the template
 * selection UI as a reversible layer on top of the existing SelectionConfigV2
 * surface. This avoids introducing new engine concepts while still providing a
 * clean path for future seasonal themes.
 */
export const THEME_PRESETS_V2: ThemePresetV2[] = [
  {
    id: 'galactic-menu',
    paletteId: 'galactic-menu',
    tagline: 'A bold neon blue palette with dark space tones',
    lockedSelection: {
      // Lock: themed background (warp speed)
      texturesEnabled: true,
      textureId: 'warp-speed-bg',
      // Lock: always show the banner
      showBanner: true,
      showBannerTitle: true,
      bannerSwapLayout: true,
      bannerImageStyle: 'none',
      showLogoTile: false,
      showCategoryHeaderTiles: false,
      // Default to Future font — user can change this
      fontStylePreset: 'future',
    },
    // Restrict to a small choice set + mix (blank is allowed as neutral fallback).
    allowedSpacerTilePatternIds: [
      'mix',
      'none',
      'blank',
      'warp-speed',
      'targeting-grid',
    ],
  },
]

function isBeforeEnabledUntil(preset: ThemePresetV2, now: Date): boolean {
  if (!preset.enabledUntil) return true
  const until = new Date(preset.enabledUntil)
  if (Number.isNaN(until.getTime())) return true
  return now.getTime() < until.getTime()
}

export function getThemePresetByPaletteId(
  paletteId: string | undefined,
  now: Date = new Date()
): ThemePresetV2 | null {
  if (!paletteId) return null
  const preset = THEME_PRESETS_V2.find(p => p.paletteId === paletteId) ?? null
  if (!preset) return null
  return isBeforeEnabledUntil(preset, now) ? preset : null
}

export function isThemePresetAvailable(
  presetId: ThemePresetIdV2,
  now: Date = new Date()
): boolean {
  const preset = THEME_PRESETS_V2.find(p => p.id === presetId)
  if (!preset) return false
  return isBeforeEnabledUntil(preset, now)
}

