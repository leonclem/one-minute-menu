import type { ImageTransform } from '@/types'

const OFFSET_MIN = -100
const OFFSET_MAX = 100
const SCALE_MIN_DEFAULT = 1.0
const SCALE_MIN_CUTOUT = 0.4
const SCALE_MAX = 2.5
const VALID_MODES = ['stretch', 'cutout', 'compact-rect', 'compact-circle', 'background']

export function validateTransform(body: unknown): { mode: string; transform: ImageTransform } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be an object' }
  }
  const { mode, offsetX, offsetY, scale } = body as Record<string, unknown>
  if (typeof mode !== 'string' || !VALID_MODES.includes(mode)) {
    return { error: `mode must be one of: ${VALID_MODES.join(', ')}` }
  }
  if (typeof offsetX !== 'number' || typeof offsetY !== 'number' || typeof scale !== 'number') {
    return { error: 'offsetX, offsetY, and scale must be numbers' }
  }
  if (!isFinite(offsetX) || !isFinite(offsetY) || !isFinite(scale)) {
    return { error: 'offsetX, offsetY, and scale must be finite numbers' }
  }
  if (offsetX < OFFSET_MIN || offsetX > OFFSET_MAX) {
    return { error: `offsetX must be between ${OFFSET_MIN} and ${OFFSET_MAX}` }
  }
  if (offsetY < OFFSET_MIN || offsetY > OFFSET_MAX) {
    return { error: `offsetY must be between ${OFFSET_MIN} and ${OFFSET_MAX}` }
  }
  const scaleMin = mode === 'cutout' ? SCALE_MIN_CUTOUT : SCALE_MIN_DEFAULT
  if (scale < scaleMin || scale > SCALE_MAX) {
    return { error: `scale must be between ${scaleMin} and ${SCALE_MAX} for mode '${mode}'` }
  }
  return { mode, transform: { offsetX, offsetY, scale } }
}
