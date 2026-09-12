/**
 * @jest-environment node
 */

import {
  ANGLED_ANGLE,
  OVERHEAD_ANGLE,
  cameraAngleDirective,
  cameraViewpoint,
  isOverheadAngle,
  verticalSwitchTarget,
} from '../camera-viewpoint'

describe('camera-viewpoint', () => {
  it('treats only top-down as overhead', () => {
    expect(isOverheadAngle(OVERHEAD_ANGLE)).toBe(true)
    expect(isOverheadAngle(ANGLED_ANGLE)).toBe(false)
    expect(isOverheadAngle('eye-level')).toBe(false)
  })

  it('switches overhead to 45° and everything else to overhead', () => {
    expect(verticalSwitchTarget('top-down')).toBe('45-degree')
    expect(verticalSwitchTarget('45-degree')).toBe('top-down')
    expect(verticalSwitchTarget('eye-level')).toBe('top-down')
  })

  it('emits semantic viewpoint prose instead of schema keys', () => {
    expect(cameraViewpoint('top-down')).toContain('overhead')
    expect(cameraViewpoint('top-down')).not.toBe('top-down')
    expect(cameraViewpoint('45-degree')).toContain('45 degrees')
  })

  it('uses a thin tilt directive for the FOH pair', () => {
    expect(cameraAngleDirective('top-down')).toContain('looking straight down')
    expect(cameraAngleDirective('top-down')).not.toContain('f/8')
    expect(cameraAngleDirective('45-degree')).toContain('45-degree')
    expect(cameraAngleDirective('45-degree')).not.toContain('CRITICAL')
  })
})
