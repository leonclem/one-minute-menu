/**
 * @jest-environment node
 */

import {
  ANGLED_ANGLE,
  OVERHEAD_ANGLE,
  CURRENT_PLATE_FACING,
  PLATE_FACING_LOCK,
  cameraAngleDirective,
  cameraSpinDirective,
  cameraViewpoint,
  isOverheadAngle,
  isYawSpin,
  plateFacingForSpin,
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

  it('describes 90° yaw as a turntable rotation, not an orbit', () => {
    expect(isYawSpin('left-90')).toBe(true)
    expect(isYawSpin('0')).toBe(false)
    expect(plateFacingForSpin('left-90')).toContain('anti-clockwise')
    expect(plateFacingForSpin('left-90')).toContain('quarter-turn')
    expect(plateFacingForSpin('left-90')).toContain('as seen from above')
    expect(plateFacingForSpin('left-90')).toContain('turntable')
    expect(plateFacingForSpin('left-90')).not.toBe('left-90')
    expect(plateFacingForSpin('0')).toBe(PLATE_FACING_LOCK)
    expect(CURRENT_PLATE_FACING).not.toContain('rotated')
    const directive = cameraSpinDirective('left-90')
    expect(directive).toContain('anti-clockwise')
    expect(directive).toContain('quarter-turn')
    expect(directive).toContain('Not a slight twist')
    expect(directive).toContain('turntable')
    expect(directive).toContain('do not orbit')
    expect(directive).not.toContain('ORBIT FORCE')
    expect(cameraSpinDirective('0')).toBeNull()
  })
})
