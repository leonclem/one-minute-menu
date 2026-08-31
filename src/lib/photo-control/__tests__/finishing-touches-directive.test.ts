/**
 * @jest-environment node
 */

import { generateDirective } from '@/lib/photo-control/directive-generator'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'

function state(partial?: {
  lighting?: string
  surface?: string
  garnishes?: string[]
}): EditorState {
  const schema: MinimalSchema = {
    scene_setup: {
      angle: 'top-down',
      framing: 'close-up',
      lighting: partial?.lighting ?? 'bright-clean',
      spin: '0',
    },
    canvas: {
      background: 'wood',
      background_style: '',
      surface_style: partial?.surface ?? '',
      main_vessel: 'white bowl',
    },
    food_components: {
      main_item: 'massaman curry with rice',
      garnishes: partial?.garnishes ?? [],
      sides: [],
    },
  }
  return { schema, position: { ...CENTER } }
}

describe('finishing-touches directive', () => {
  it('bundles named adds with scatter, no props, and a surface lock', () => {
    const original = state()
    const target = state({
      garnishes: ['Coriander', 'Lime wedges', 'Red chilli', 'Cashews'],
    })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('Coriander')
    expect(directive).toContain('Lime wedges')
    expect(directive).toContain('lightly scattered on the existing tabletop')
    expect(directive).toContain('Do not add extra bowls')
    expect(directive).toContain('Keep the existing tabletop surface')
    expect(directive).toContain('Keep the existing lighting unchanged')
    expect(directive).toContain('Leave all other attributes of the scene unchanged')
  })

  it('does not lock lighting or surface when those scalars are also staged', () => {
    const original = state()
    const target = state({
      lighting: 'dark-moody',
      surface: 'white-marble',
      garnishes: ['Coriander', 'Lime wedges'],
    })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).not.toContain('Keep the existing lighting unchanged')
    expect(directive).not.toContain('Keep the existing tabletop surface')
    expect(directive).toContain('Do not add extra bowls')
    expect(directive?.toLowerCase()).not.toContain('leave all other attributes of the scene unchanged')
  })
})
