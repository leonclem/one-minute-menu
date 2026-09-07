/**
 * @jest-environment node
 */

import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import { computeDelta, countEditableChanges } from '@/lib/photo-control/state-delta'
import { MAX_PENDING_CHANGES } from '@/lib/photo-control/edit-limits'
import { applyQuickLook, STUDIO_QUICK_LOOKS } from '../quick-looks'

function state(
  lighting: string,
  surface: string,
  backdrop: string,
): EditorState {
  return {
    schema: {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting },
      canvas: {
        background: '',
        background_style: backdrop,
        surface_style: surface,
        main_vessel: '',
      },
      food_components: { main_item: 'cake', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

const colourPop = STUDIO_QUICK_LOOKS.find((look) => look.id === 'colour-pop')!

describe('STUDIO_QUICK_LOOKS', () => {
  it('has four named bundles including Colour Pop keys', () => {
    expect(STUDIO_QUICK_LOOKS.map((look) => look.name)).toEqual([
      'Bright & Clean',
      'Golden Hour',
      'Dark & Moody',
      'Colour Pop',
    ])
    expect(colourPop).toMatchObject({
      lighting: 'bold-sunlight',
      surface: 'dark-stone',
      backdrop: 'mustard-yellow',
    })
  })
})

describe('applyQuickLook', () => {
  it('stages lighting, surface, and backdrop as three pending changes', () => {
    const current = state('soft-natural', 'terrazzo', 'teal')
    const { nextState, nextBaseline } = applyQuickLook({
      look: colourPop,
      current,
      baseline: current,
      includeBackdrop: true,
    })
    const delta = computeDelta(nextBaseline, nextState)
    expect(countEditableChanges(delta)).toBe(3)
    expect(countEditableChanges(delta)).toBeLessThanOrEqual(MAX_PENDING_CHANGES)
    expect(nextState.schema.scene_setup.lighting).toBe('bold-sunlight')
    expect(nextState.schema.canvas.surface_style).toBe('dark-stone')
    expect(nextState.schema.canvas.background_style).toBe('mustard-yellow')
  })

  it('omits backdrop when extraction hid it', () => {
    const current = state('soft-natural', 'terrazzo', 'teal')
    const { nextState, nextBaseline } = applyQuickLook({
      look: colourPop,
      current,
      baseline: current,
      includeBackdrop: false,
    })
    const delta = computeDelta(nextBaseline, nextState)
    expect(countEditableChanges(delta)).toBe(2)
    expect(nextState.schema.canvas.background_style).toBe('teal')
    expect(delta.scalarChanges.some((change) => change.path === 'canvas.background_style')).toBe(
      false,
    )
  })
})
