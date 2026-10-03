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
    expect(directive).toContain('Preserve the plate.')
    expect(directive).toContain('Keep the entire subject and the plate visible, no cropping.')
    expect(directive).not.toContain('vessel/plate/bowl')
    expect(directive).toContain('cutlery')
    expect(directive).toContain('napkins')
    expect(directive).not.toContain('unless this directive')
    expect(directive).not.toContain('unless explicitly requested')
  })

  it('points at the photo when the vessel was not extracted', () => {
    const unknownVessel: EditorState = {
      ...context,
      schema: {
        ...context.schema,
        canvas: { ...context.schema.canvas, main_vessel: '  ' },
      },
    }
    const directive = generateDirective(lightingDelta, unknownVessel)
    expect(directive).toContain('Preserve the existing vessel exactly as shown.')
    expect(directive).toContain('Keep entire subject and vessel visible, no cropping.')
    expect(directive).not.toContain('vessel/plate/bowl')
  })

  it('names a staged replacement and does not also tell the model to preserve the old vessel', () => {
    const swapDelta: StateDelta = {
      isEmpty: false,
      scalarChanges: [
        {
          path: 'canvas.vessel_style',
          from: '',
          to: 'wooden-board',
        },
      ],
      arrays: {
        garnishes: { added: [], removed: [] },
        sides: { added: [], removed: [] },
      },
    }
    const directive = generateDirective(swapDelta, context, {
      resolveVesselPrompt: (key) => (key === 'wooden-board' ? 'wooden serving board' : null),
    })
    expect(directive).toContain(
      'Replace the plate with the wooden serving board shown in the additional reference image.',
    )
    expect(directive).toContain('Do not copy the reference image')
    expect(directive).not.toContain('Preserve the plate')
    expect(directive).toContain('Keep the entire subject visible, no cropping.')
  })

  it('keeps the do-not-add lock unconditional when nothing is added', () => {
    const directive = generateDirective(lightingDelta, context)
    expect(directive).toContain(
      'Do not add new food, props, hands, text, labels, logos, napkins, or cutlery.',
    )
    expect(directive).not.toContain('except for')
  })

  it('names requested additions as the only exception to the do-not-add lock', () => {
    const addDelta: StateDelta = {
      isEmpty: false,
      scalarChanges: [],
      arrays: {
        garnishes: { added: ['parsley'], removed: [] },
        sides: { added: ['slaw'], removed: [] },
      },
    }
    const directive = generateDirective(addDelta, context)
    expect(directive).toContain(
      'Do not add new food, props, hands, text, labels, logos, napkins, or cutlery except for "parsley" and "slaw".',
    )
    expect(directive).not.toContain('unless explicitly requested')
  })
})
