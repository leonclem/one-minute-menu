/**
 * @jest-environment node
 */

import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { applyVerticalSwitch, workingShotHidesBackdrop } from '../vertical-switch'

function editor(partial?: {
  angle?: MinimalSchema['scene_setup']['angle']
  backdrop?: string
}): EditorState {
  return {
    schema: {
      scene_setup: {
        angle: partial?.angle ?? '45-degree',
        framing: 'close-up',
        lighting: 'bright-clean',
        spin: '0',
      },
      canvas: {
        background: '',
        background_style: partial?.backdrop ?? '',
        surface_style: '',
        main_vessel: 'plate',
      },
      food_components: { main_item: 'churros', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

describe('vertical-switch', () => {
  it('stages overhead from a 45° working shot', () => {
    const current = editor({ angle: '45-degree' })
    const { nextState } = applyVerticalSwitch(current, current)
    expect(nextState.schema.scene_setup.angle).toBe('top-down')
  })

  it('stages 45° from an overhead working shot', () => {
    const current = editor({ angle: 'top-down' })
    const { nextState } = applyVerticalSwitch(current, current)
    expect(nextState.schema.scene_setup.angle).toBe('45-degree')
  })

  it('drops a staged backdrop when targeting overhead', () => {
    const baseline = editor({ angle: '45-degree', backdrop: '' })
    const current = editor({ angle: '45-degree', backdrop: 'warm-sand' })
    const { nextState } = applyVerticalSwitch(current, baseline)
    expect(nextState.schema.scene_setup.angle).toBe('top-down')
    expect(nextState.schema.canvas.background_style).toBe('')
  })

  it('hides backdrop on overhead working shots even if extract did not mark the wall missing', () => {
    expect(workingShotHidesBackdrop('top-down', false)).toBe(true)
    expect(workingShotHidesBackdrop('45-degree', false)).toBe(false)
    expect(workingShotHidesBackdrop('45-degree', true)).toBe(true)
  })
})
