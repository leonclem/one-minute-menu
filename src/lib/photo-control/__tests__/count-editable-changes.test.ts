/**
 * Unit tests — countEditableChanges
 */

import { computeDelta, countEditableChanges } from '../state-delta'
import {
  CENTER,
  type EditorState,
  type MinimalSchema,
} from '../minimal-schema'

function editor(partial?: {
  angle?: MinimalSchema['scene_setup']['angle']
  lighting?: MinimalSchema['scene_setup']['lighting']
  garnishes?: string[]
  position?: { x: number; y: number }
}): EditorState {
  return {
    schema: {
      scene_setup: {
        angle: partial?.angle ?? '45-degree',
        framing: 'close-up',
        lighting: partial?.lighting ?? 'low-key',
      },
      canvas: { background: '', background_style: '', main_vessel: '' },
      food_components: {
        main_item: 'burger',
        garnishes: partial?.garnishes ?? [],
        sides: [],
      },
    },
    position: partial?.position ?? { ...CENTER },
  }
}

describe('countEditableChanges', () => {
  it('returns 0 for an empty delta', () => {
    const state = editor()
    const delta = computeDelta(state, state)
    expect(delta.isEmpty).toBe(true)
    expect(countEditableChanges(delta)).toBe(0)
  })

  it('counts each scalar field change separately', () => {
    const original = editor()
    const target = editor({ angle: 'top-down', lighting: 'bright-and-airy' })
    const delta = computeDelta(original, target)
    expect(countEditableChanges(delta)).toBe(2)
  })

  it('counts garnish add and remove as separate changes', () => {
    const original = editor({ garnishes: ['parsley'] })
    const target = editor({ garnishes: ['mint'] })
    const delta = computeDelta(original, target)
    expect(countEditableChanges(delta)).toBe(2)
  })

  it('includes position as one change', () => {
    const original = editor()
    const target = { ...editor(), position: { x: 0.2, y: 0 } }
    const delta = computeDelta(original, target)
    expect(countEditableChanges(delta)).toBe(1)
  })
})
