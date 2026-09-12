import type { AngleValue } from './minimal-schema'

export const OVERHEAD_ANGLE: AngleValue = 'top-down'
export const ANGLED_ANGLE: AngleValue = '45-degree'

export const PLATE_FACING_LOCK =
  'same as the source; do not spin the dish on the table'

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
