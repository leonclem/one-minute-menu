/**
 * @jest-environment node
 */

import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { generateDirective } from '@/lib/photo-control/directive-generator'
import { applyYaw, cameraSectionLabel, clearConsumedYaw, yawButtonLabel } from '../yaw'

function editor(partial?: {
  angle?: MinimalSchema['scene_setup']['angle']
  spin?: MinimalSchema['scene_setup']['spin']
}): EditorState {
  return {
    schema: {
      scene_setup: {
        angle: partial?.angle ?? '45-degree',
        framing: 'close-up',
        lighting: 'bright-clean',
        spin: partial?.spin ?? '0',
      },
      canvas: {
        background: '',
        background_style: '',
        surface_style: '',
        main_vessel: 'plate',
      },
      food_components: { main_item: 'churros', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

describe('yaw', () => {
  it('stages a left 90° turn from an unrotated working shot', () => {
    const current = editor()
    const { nextState } = applyYaw(current, current, 'left')
    expect(nextState.schema.scene_setup.spin).toBe('left-90')
  })

  it('stages a right 90° turn from an unrotated working shot', () => {
    const current = editor()
    const { nextState } = applyYaw(current, current, 'right')
    expect(nextState.schema.scene_setup.spin).toBe('right-90')
  })

  it('clears a staged left turn when clicked again', () => {
    const baseline = editor()
    const staged = editor({ spin: 'left-90' })
    const { nextState } = applyYaw(staged, baseline, 'left')
    expect(nextState.schema.scene_setup.spin).toBe('0')
  })

  it('switches a staged left turn to right', () => {
    const baseline = editor()
    const staged = editor({ spin: 'left-90' })
    const { nextState } = applyYaw(staged, baseline, 'right')
    expect(nextState.schema.scene_setup.spin).toBe('right-90')
  })

  it('does not change camera height', () => {
    const current = editor({ angle: 'top-down' })
    const { nextState } = applyYaw(current, current, 'left')
    expect(nextState.schema.scene_setup.angle).toBe('top-down')
  })

  it('clears a consumed 90° yaw so the new shot is the new zero', () => {
    const rotated = editor({ angle: 'top-down', spin: 'left-90' })
    const working = clearConsumedYaw(rotated)
    expect(working.schema.scene_setup.spin).toBe('0')
    expect(working.schema.scene_setup.angle).toBe('top-down')
    expect(computeDelta(working, working).isEmpty).toBe(true)
    const restaged = applyYaw(working, working, 'left')
    expect(restaged.nextState.schema.scene_setup.spin).toBe('left-90')
    expect(computeDelta(working, restaged.nextState).isEmpty).toBe(false)
  })

  it('labels the Camera section with a staged quarter-turn', () => {
    expect(yawButtonLabel('left')).toBe('Anti-clockwise')
    expect(cameraSectionLabel('45-degree', 'left-90')).toBe('Angled · Anti-clockwise')
    expect(cameraSectionLabel('top-down', '0')).toBe('Overhead')
  })

  it('writes a turntable directive without orbit language', () => {
    const original = editor()
    const { nextState } = applyYaw(original, original, 'left')
    const directive = generateDirective(computeDelta(original, nextState), nextState)
    expect(directive).toContain('turntable')
    expect(directive).toContain('anti-clockwise')
    expect(directive).toContain('quarter-turn')
    expect(directive).toContain('exactly 90 degrees')
    expect(directive).not.toContain('ORBIT')
    expect(directive).not.toContain('Leave all other attributes of the scene unchanged')
  })
})
