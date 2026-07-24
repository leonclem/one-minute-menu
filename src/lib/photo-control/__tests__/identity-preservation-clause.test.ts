/**
 * @jest-environment node
 *
 * Unit coverage for expanded §5.2 identity-preservation wording.
 */

import { generateDirective } from '@/lib/photo-control/directive-generator'
import type { EditorState, StateDelta } from '@/lib/photo-control/minimal-schema'

const context: EditorState = {
  schema: {
    scene_setup: {
      angle: '45-degree',
      framing: 'close-up',
      lighting: 'bright-and-airy',
      spin: '0',
    },
    canvas: {
      background: 'white',
      background_style: '',
      surface_style: '',
      main_vessel: 'plate',
    },
    food_components: {
      main_item: 'ramen',
      garnishes: [],
      sides: [],
    },
  },
  position: { x: 0, y: 0 },
}

const lightingDelta: StateDelta = {
  isEmpty: false,
  scalarChanges: [
    {
      path: 'scene_setup.lighting',
      from: 'bright-and-airy',
      to: 'low-key',
    },
  ],
  arrays: {
    garnishes: { added: [], removed: [] },
    sides: { added: [], removed: [] },
  },
}

describe('§5.2 identity preservation clause', () => {
  it('includes expanded preservation defaults', () => {
    const directive = generateDirective(lightingDelta, context)
    expect(directive).toContain('Preserve the identity of ramen')
    expect(directive).toContain('texture')
    expect(directive).toContain('shape')
    expect(directive).toContain('structure')
    expect(directive).toContain('colours')
    expect(directive).toContain('component counts')
    expect(directive).toContain('vessel/plate/bowl')
    expect(directive).toContain('cutlery')
    expect(directive).toContain('napkins')
  })
})
