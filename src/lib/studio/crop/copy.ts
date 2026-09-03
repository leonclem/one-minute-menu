/**
 * User-facing crop copy. Pixel floors stay in code; the workbench never
 * asks the user to count pixels. Low-res crop is a warning, not a block.
 */

import { CROP_LOW_RES_WARN_PX } from './constants'
import { isLowResCrop, type NaturalImageSize, type NormalizedCropRect } from './geometry'

export const LOW_RES_NOTICE_TEXT =
  'This photo is a lower resolution than recommended. Generate may look soft. Prefer an original camera photo when you can.'

export const CROP_LOW_RES_HINT_TEXT =
  'This crop is a lower resolution than recommended. Generate may look soft.'

export function cropFloorHint(
  rect: NormalizedCropRect,
  natural: NaturalImageSize,
  warnPx = CROP_LOW_RES_WARN_PX,
): string | null {
  if (!isLowResCrop(rect, natural, warnPx)) return null
  return CROP_LOW_RES_HINT_TEXT
}
