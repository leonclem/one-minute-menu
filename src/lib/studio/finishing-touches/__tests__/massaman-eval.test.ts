/**
 * @jest-environment node
 *
 * Massaman eval fixtures: dressing levels 1-4 alone, plus one combined
 * lighting change. Live image generation remains a manual Studio pass.
 */

import { generateDirective } from '@/lib/photo-control/directive-generator'
import { computeDelta, countEditableChanges } from '@/lib/photo-control/state-delta'
import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { applyFinishingTouchesLevel } from '../apply-level'
import { stackFromIds } from '../catalogue'

function massamanBaseline(): MinimalSchema {
  return {
    scene_setup: {
      angle: 'top-down',
      framing: 'close-up',
      lighting: 'bright-clean',
      spin: '0',
    },
    canvas: {
      background: 'light wood',
      background_style: '',
      surface_style: '',
      main_vessel: 'white bowl with terracotta rim',
    },
    food_components: {
      main_item: 'massaman curry with rice',
      garnishes: [],
      sides: [],
    },
  }
}

function asState(schema: MinimalSchema): EditorState {
  return { schema, position: { ...CENTER } }
}

const stack = stackFromIds(['coriander', 'lime_wedge', 'red_chilli', 'cashews'])

describe('massaman finishing-touches eval fixtures', () => {
  it('builds additive schemas for levels 1-4 without rewriting the extract JSON', () => {
    const baseline = massamanBaseline()
    const expected = [
      ['Coriander'],
      ['Coriander', 'Lime wedges'],
      ['Coriander', 'Lime wedges', 'Red chilli'],
      ['Coriander', 'Lime wedges', 'Red chilli', 'Cashews'],
    ]
    for (let level = 1; level <= 4; level += 1) {
      const next = applyFinishingTouchesLevel({ baseline, stack, level })
      expect(next.food_components.garnishes).toEqual(expected[level - 1])
      expect(next.food_components.main_item).toBe(baseline.food_components.main_item)
      expect(next.canvas.main_vessel).toBe(baseline.canvas.main_vessel)
      expect(next.canvas.surface_style).toBe(baseline.canvas.surface_style)
      expect(next.scene_setup.lighting).toBe(baseline.scene_setup.lighting)
      const delta = computeDelta(asState(baseline), asState(next))
      expect(countEditableChanges(delta)).toBe(1)
      const directive = generateDirective(delta, asState(next))
      expect(directive).toContain('Do not add extra bowls')
      expect(directive).toContain('Keep the existing tabletop surface')
      expect(directive).toContain('lightly scattered on the existing tabletop')
    }
  })

  it('keeps finishing touches as one bundle when lighting is also staged', () => {
    const baseline = massamanBaseline()
    const withGarnishes = applyFinishingTouchesLevel({ baseline, stack, level: 2 })
    const combined: MinimalSchema = {
      ...withGarnishes,
      scene_setup: { ...withGarnishes.scene_setup, lighting: 'dark-moody' },
    }
    const delta = computeDelta(asState(baseline), asState(combined))
    expect(countEditableChanges(delta)).toBe(2)
    const directive = generateDirective(delta, asState(combined))
    expect(directive).not.toContain('Keep the existing lighting unchanged')
    expect(directive).toContain('Keep the existing tabletop surface')
    expect(directive).toContain('Coriander')
    expect(directive).toContain('Lime wedges')
  })
})
