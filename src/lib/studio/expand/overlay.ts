import {
  EXPAND_MAX_PAD_RATIO,
  EXPAND_PRESETS,
  expandPresetDef,
  type ExpandLayoutId,
  type ExpandPresetId,
} from './presets'

export type ExpandCornerHandle = 'nw' | 'ne' | 'sw' | 'se'
export type ExpandEdgeHandle = 'n' | 'e' | 's' | 'w'
export type ExpandHandle = ExpandCornerHandle | ExpandEdgeHandle

export const EXPAND_CORNER_HANDLES: readonly ExpandCornerHandle[] = ['nw', 'ne', 'sw', 'se']
export const EXPAND_EDGE_HANDLES: readonly ExpandEdgeHandle[] = ['n', 'e', 's', 'w']

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

export type ExpandPhotoRect = { x: number; y: number; width: number; height: number }

/** Photo placement inside the Editorial overlay for the current amount + layout. */
export function expandPhotoRect(
  layout: ExpandLayoutId,
  padRatio: number,
  maxPadRatio = EXPAND_MAX_PAD_RATIO,
): ExpandPhotoRect {
  const photo = expandPhotoScale(maxPadRatio)
  const dest = expandDestinationScale(padRatio, maxPadRatio)
  const inset = expandDestinationInset(padRatio, maxPadRatio)
  const center = inset + (dest - photo) / 2
  const flushEnd = inset + dest - photo
  switch (layout) {
    case 'left':
      return { x: flushEnd, y: center, width: photo, height: photo }
    case 'right':
      return { x: inset, y: center, width: photo, height: photo }
    case 'top':
      return { x: center, y: flushEnd, width: photo, height: photo }
    case 'bottom':
      return { x: center, y: inset, width: photo, height: photo }
    case 'top_left':
      return { x: flushEnd, y: flushEnd, width: photo, height: photo }
    case 'top_right':
      return { x: inset, y: flushEnd, width: photo, height: photo }
    case 'bottom_left':
      return { x: flushEnd, y: inset, width: photo, height: photo }
    case 'bottom_right':
      return { x: inset, y: inset, width: photo, height: photo }
    default:
      return {
        x: expandPhotoInset(maxPadRatio),
        y: expandPhotoInset(maxPadRatio),
        width: photo,
        height: photo,
      }
  }
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

export function expandLayoutFromHandle(handle: ExpandHandle): ExpandLayoutId {
  if (handle === 'w') return 'left'
  if (handle === 'e') return 'right'
  if (handle === 'n') return 'top'
  if (handle === 's') return 'bottom'
  if (handle === 'nw') return 'top_left'
  if (handle === 'ne') return 'top_right'
  if (handle === 'sw') return 'bottom_left'
  return 'bottom_right'
}

function padRatioFromDistance(dist: number, maxPadRatio: number): number {
  const minPad = expandPresetDef('a_little').padRatio
  const raw = (dist * (1 + 2 * maxPadRatio) - 1) / 2
  return Math.min(maxPadRatio, Math.max(minPad, raw))
}

/**
 * Map a pointer in the Editorial overlay (0–1) to a padRatio, then snap.
 * Distance from centre uses Chebyshev metric so a corner drag stays locked-aspect.
 */
export function expandPresetFromPointer(
  point: { x: number; y: number },
  maxPadRatio = EXPAND_MAX_PAD_RATIO,
): ExpandPresetId {
  const dist = Math.max(Math.abs(point.x - 0.5), Math.abs(point.y - 0.5)) * 2
  return snapExpandPreset(padRatioFromDistance(dist, maxPadRatio))
}

export function expandGestureFromPointer(
  point: { x: number; y: number },
  handle: ExpandHandle,
  maxPadRatio = EXPAND_MAX_PAD_RATIO,
): { preset: ExpandPresetId; layout: ExpandLayoutId } {
  const layout = expandLayoutFromHandle(handle)
  const dist =
    layout === 'left' || layout === 'right'
      ? Math.abs(point.x - 0.5) * 2
      : layout === 'top' || layout === 'bottom'
        ? Math.abs(point.y - 0.5) * 2
        : Math.max(Math.abs(point.x - 0.5), Math.abs(point.y - 0.5)) * 2
  return {
    preset: snapExpandPreset(padRatioFromDistance(dist, maxPadRatio)),
    layout,
  }
}
