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
  mainItem?: string
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
      main_item: partial?.mainItem ?? 'massaman curry with rice',
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

  it('asks for a finer on-food cut than table scatter for chopped and sliced herbs', () => {
    const original = state()
    const target = state({ garnishes: ['Parsley', 'Spring onion'] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain(
      'finely chopped on the food as the edible garnish, with at most one small whole sprig as a plating accent',
    )
    expect(directive).toContain('not a large bunch covering the dish')
    expect(directive).toContain(
      'thinly sliced on the food (fine rings or slivers, not thick chunks)',
    )
    expect(directive).toContain('a small whole sprig or bunch')
    expect(directive).toContain('these table pieces may be chunkier than the garnish on the food')
  })

  it('asks for chopped nuts on the food and whole nuts on the table', () => {
    const original = state()
    const target = state({ garnishes: ['Cashews', 'Peanuts'] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('roughly chopped or crushed on the food, not left whole')
    expect(directive).toContain(
      'a few whole pieces lightly scattered on the existing tabletop around the vessel',
    )
    expect(directive).toContain('these table pieces should be whole, not chopped')
  })

  it('asks for sliced spring onion on the food and a whole spring onion on the table', () => {
    const original = state()
    const target = state({ garnishes: ['Spring onion'] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain(
      'thinly sliced on the food (fine rings or slivers, not thick chunks)',
    )
    expect(directive).toContain('one whole matching piece on the existing tabletop around the vessel')
  })

  it('asks for a citrus wedge on the food and a half on the table', () => {
    const original = state()
    const target = state({ garnishes: ['Lime wedges', 'Lemon wedges'] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('as a small wedge on the food, not a full half')
    expect(directive).toContain('one matching half on the existing tabletop around the vessel')
    expect(directive).not.toContain('as fruit cut cleanly in half')
    expect(directive).not.toContain('on or beside the vessel rim')
  })

  it('asks for chopped chilli on the food and a whole chilli on the table', () => {
    const original = state()
    const target = state({ garnishes: ['Red chilli'] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('finely chopped on the food into small pieces, not left whole')
    expect(directive).toContain('one whole matching piece on the existing tabletop around the vessel')
    expect(directive).not.toContain('as a whole intact piece on the food')
  })

  it('keeps seeds at their natural size on the food only', () => {
    const original = state()
    const target = state({ garnishes: ['Sesame seeds'] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('- Sesame seeds: on the food.')
    expect(directive).not.toContain('tabletop around the vessel')
    expect(directive).not.toContain('roughly chopped')
  })

  it('asks for small leaves or one sprig on the food for leaf herbs', () => {
    const original = state()
    const target = state({ garnishes: ['Basil'] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain(
      'as small leaves, or at most one light sprig, on the food — not a large clump or bouquet',
    )
    expect(directive).toContain('a small whole sprig or bunch')
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

  it('asks for a restrained chocolate drizzle on the cake and plate', () => {
    const original = state({ mainItem: 'chocolate cake' })
    const target = state({
      mainItem: 'chocolate cake',
      garnishes: ['Chocolate drizzle'],
    })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('thin zigzag drizzle on the food')
    expect(directive).toContain('not a pool, flood, or sauce jug')
    expect(directive).not.toContain('lightly scattered on the existing tabletop')
  })

  it('asks for a light powdered-sugar dusting on the food only', () => {
    const original = state({ mainItem: 'sponge cake' })
    const target = state({
      mainItem: 'sponge cake',
      garnishes: ['Powdered sugar'],
    })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('light dusting on the food')
    expect(directive).not.toContain('tabletop around the vessel')
  })

  it('restores the cake or plate when a named drizzle is removed', () => {
    const original = state({
      mainItem: 'chocolate cake',
      garnishes: ['Chocolate drizzle'],
    })
    const target = state({ mainItem: 'chocolate cake', garnishes: [] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain('Remove the garnish "Chocolate drizzle" entirely from the scene.')
    expect(directive).toContain(
      'Restore the cake or plate surface underneath; do not leave a hole or repaint the dish.',
    )
    expect(directive).not.toContain('matching underlying background texture')
  })

  it('still fills savoury garnish removals with background texture', () => {
    const original = state({ garnishes: ['Coriander'] })
    const target = state({ garnishes: [] })
    const directive = generateDirective(computeDelta(original, target), target)
    expect(directive).toContain(
      'Fill the vacant space naturally with the matching underlying background texture.',
    )
    expect(directive).not.toContain('Restore the cake or plate surface')
  })
})
