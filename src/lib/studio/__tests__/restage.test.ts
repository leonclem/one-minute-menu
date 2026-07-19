/**
 * @jest-environment node
 */

import { ensureAngleRestageBaseline, ensureLightingRestageBaseline } from '../restage'
import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'

function state(angle: EditorState['schema']['scene_setup']['angle'], lighting: EditorState['schema']['scene_setup']['lighting']): EditorState {
  return {
    schema: {
      scene_setup: { angle, framing: 'close-up', lighting },
      canvas: { background: '', main_vessel: '' },
      food_components: { main_item: 'x', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

describe('restage', () => {
  it('nudges baseline when re-applying the same angle', () => {
    const current = state('45-degree', 'bright-and-airy')
    const nextBaseline = ensureAngleRestageBaseline(current, current, '45-degree')
    expect(nextBaseline.schema.scene_setup.angle).not.toBe('45-degree')
  })

  it('does not nudge when switching to a different angle', () => {
    const baseline = state('45-degree', 'bright-and-airy')
    const current = state('top-down', 'bright-and-airy')
    const nextBaseline = ensureAngleRestageBaseline(baseline, current, '45-degree')
    expect(nextBaseline.schema.scene_setup.angle).toBe('45-degree')
  })

  it('nudges lighting baseline on re-apply', () => {
    const current = state('45-degree', 'low-key')
    const nextBaseline = ensureLightingRestageBaseline(current, current, 'low-key')
    expect(nextBaseline.schema.scene_setup.lighting).not.toBe('low-key')
  })
})
