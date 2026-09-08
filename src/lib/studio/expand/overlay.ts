import {
  EXPAND_MAX_PAD_RATIO,
  EXPAND_PRESETS,
  expandPresetDef,
  type ExpandPresetId,
} from './presets'

export type ExpandCornerHandle = 'nw' | 'ne' | 'sw' | 'se'

export const EXPAND_CORNER_HANDLES: readonly ExpandCornerHandle[] = ['nw', 'ne', 'sw', 'se']

/** How large the source photo is inside the Editorial (max) overlay. */
export function expandPhotoScale(maxPadRatio = EXPAND_MAX_PAD_RATIO): number {
  return 1 / (1 + 2 * maxPadRatio)
}

/** How large the destination frame is inside the Editorial overlay. */
export function expandDestinationScale(
  padRatio: number,
  maxPadRatio = EXPAND_MAX_PAD_RATIO,
): number {
  return (1 + 2 * padRatio) / (1 + 2 * maxPadRatio)
}

export function expandDestinationInset(
  padRatio: number,
  maxPadRatio = EXPAND_MAX_PAD_RATIO,
): number {
  return (1 - expandDestinationScale(padRatio, maxPadRatio)) / 2
}

export function expandPhotoInset(maxPadRatio = EXPAND_MAX_PAD_RATIO): number {
  return (1 - expandPhotoScale(maxPadRatio)) / 2
}

export function snapExpandPreset(padRatio: number): ExpandPresetId {
  let best: ExpandPresetId = EXPAND_PRESETS[0].id
  let bestError = Number.POSITIVE_INFINITY
  for (const preset of EXPAND_PRESETS) {
    const error = Math.abs(preset.padRatio - padRatio)
    if (error < bestError) {
      best = preset.id
      bestError = error
    }
  }
  return best
}

/**
 * Map a pointer in the Editorial overlay (0–1) to a padRatio, then snap.
 * Distance from centre uses Chebyshev metric so a corner drag stays locked-aspect.
 */
export function expandPresetFromPointer(
  point: { x: number; y: number },
  maxPadRatio = EXPAND_MAX_PAD_RATIO,
): ExpandPresetId {
  const minPad = expandPresetDef('a_little').padRatio
  const dist = Math.max(Math.abs(point.x - 0.5), Math.abs(point.y - 0.5)) * 2
  const raw = (dist * (1 + 2 * maxPadRatio) - 1) / 2
  const clamped = Math.min(maxPadRatio, Math.max(minPad, raw))
  return snapExpandPreset(clamped)
}
