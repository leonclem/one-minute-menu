import type { AngleValue } from './minimal-schema'

export const OVERHEAD_ANGLE: AngleValue = 'top-down'
export const ANGLED_ANGLE: AngleValue = '45-degree'

export const PLATE_FACING_LOCK =
  'same as the source; do not spin the dish on the table'

export const CURRENT_PLATE_FACING =
  'as in the source; the dish has not been turned on the table'

export const YAW_LEFT_90 = 'left-90'
export const YAW_RIGHT_90 = 'right-90'

const VIEWPOINTS: Record<AngleValue, string> = {
  'top-down': 'overhead, camera parallel to the table, looking straight down',
  '45-degree': 'standard three-quarter food photograph, about 45 degrees above the table',
  'eye-level': 'eye-level table-top view across the dish',
  'macro-close-up': 'macro close-up of the dish',
}

export function isOverheadAngle(angle: string): boolean {
  return angle === OVERHEAD_ANGLE
}

export function verticalSwitchTarget(current: string): AngleValue {
  return isOverheadAngle(current) ? ANGLED_ANGLE : OVERHEAD_ANGLE
}

export function cameraViewpoint(angle: string): string {
  return VIEWPOINTS[angle as AngleValue] ?? `food photograph from a ${angle} viewpoint`
}

export function cameraAngleDirective(to: string): string {
  if (to === OVERHEAD_ANGLE) {
    return (
      'Tilt the camera to overhead, looking straight down at the dish. ' +
      'Keep the plate facing the same way on the table; do not spin it.'
    )
  }
  if (to === ANGLED_ANGLE) {
    return (
      'Tilt the camera down to a 45-degree food-photography view. ' +
      'Keep the plate facing the same way on the table; do not spin it.'
    )
  }
  return `Change the camera angle to ${cameraViewpoint(to)}. Keep the plate facing the same way on the table; do not spin it.`
}

export function isYawSpin(value: string): boolean {
  return value === YAW_LEFT_90 || value === YAW_RIGHT_90
}

export function plateFacingForSpin(value: string): string {
  if (value === YAW_LEFT_90) {
    return (
      'rotated a full quarter-turn anti-clockwise as seen from above, exactly 90 degrees from the source, like a turntable; ' +
      'keep the plate in the same spot on the table'
    )
  }
  if (value === YAW_RIGHT_90) {
    return (
      'rotated a full quarter-turn clockwise as seen from above, exactly 90 degrees from the source, like a turntable; ' +
      'keep the plate in the same spot on the table'
    )
  }
  return PLATE_FACING_LOCK
}

export function cameraSpinDirective(to: string): string | null {
  if (to === YAW_LEFT_90) {
    return (
      'Rotate the dish a full quarter-turn anti-clockwise as seen from above, exactly 90 degrees, like a turntable. Not a slight twist. ' +
      'Keep the plate in the same spot. Do not move the camera; do not change camera height; ' +
      'do not orbit around the dish.'
    )
  }
  if (to === YAW_RIGHT_90) {
    return (
      'Rotate the dish a full quarter-turn clockwise as seen from above, exactly 90 degrees, like a turntable. Not a slight twist. ' +
      'Keep the plate in the same spot. Do not move the camera; do not change camera height; ' +
      'do not orbit around the dish.'
    )
  }
  return null
}
