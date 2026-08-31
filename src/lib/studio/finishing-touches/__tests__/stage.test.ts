/**
 * @jest-environment node
 */

import { computeDelta } from '@/lib/photo-control/state-delta'
import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { stackFromIds } from '../catalogue'
import {
  countStudioPendingChanges,
  editorStateWithFinishingTouches,
  isFinishingTouchesStaged,
} from '../stage'

function schema(partial?: {
  lighting?: string
  garnishes?: string[]
  sides?: string[]
}): MinimalSchema {
  return {
    scene_setup: {
      angle: 'top-down',
      framing: 'close-up',
      lighting: partial?.lighting ?? 'bright-clean',
      spin: '0',
    },
    canvas: {
      background: 'wood',
      background_style: '',
      surface_style: '',
      main_vessel: 'white bowl',
    },
    food_components: {
      main_item: 'massaman curry with rice',
      garnishes: partial?.garnishes ?? [],
      sides: partial?.sides ?? [],
    },
  }
}

function asState(next: MinimalSchema): EditorState {
  return { schema: next, position: { ...CENTER } }
}

const stack = stackFromIds(['fried_garlic', 'chilli_flakes', 'paprika'])

describe('isFinishingTouchesStaged', () => {
  it('is true only when a positive level and a stack are both set', () => {
    expect(isFinishingTouchesStaged(stack, 2)).toBe(true)
    expect(isFinishingTouchesStaged(stack, null)).toBe(false)
    expect(isFinishingTouchesStaged(stack, 0)).toBe(false)
    expect(isFinishingTouchesStaged([], 2)).toBe(false)
  })
})

describe('editorStateWithFinishingTouches', () => {
  it('leaves the extract-facing current schema unchanged', () => {
    const current = asState(schema({ garnishes: ['lime wedges'] }))
    const next = editorStateWithFinishingTouches(current, current, stack, 3)
    expect(current.schema.food_components.garnishes).toEqual(['lime wedges'])
    expect(next.schema.food_components.garnishes).toEqual([
      'lime wedges',
      'Fried garlic',
      'Chilli flakes',
      'Paprika',
    ])
  })

  it('keeps user removals and only adds the selected level at Generate', () => {
    const baseline = asState(schema({ garnishes: ['lime wedges', 'cashew nuts'] }))
    const current = asState(schema({ garnishes: [] }))
    const next = editorStateWithFinishingTouches(current, baseline, stack, 2)
    expect(current.schema.food_components.garnishes).toEqual([])
    expect(next.schema.food_components.garnishes).toEqual(['Fried garlic', 'Chilli flakes'])
  })

  it('applies an arbitrary a la carte selection without adding unselected suggestions', () => {
    const current = asState(schema())
    const selected = [stack[0], stack[2]].filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    )
    const next = editorStateWithFinishingTouches(
      current,
      current,
      selected,
      selected.length,
    )

    expect(next.schema.food_components.garnishes).toEqual(['Fried garlic', 'Paprika'])
  })

  it('returns current unchanged when nothing is staged', () => {
    const current = asState(schema({ garnishes: ['parsley'] }))
    expect(editorStateWithFinishingTouches(current, current, stack, null)).toBe(current)
  })

  it('combines extract removals, lighting, and finishing adds at Generate', () => {
    const baseline = asState(schema({ garnishes: ['lime wedges'] }))
    const current = asState(schema({ lighting: 'dark-moody', garnishes: [] }))
    const next = editorStateWithFinishingTouches(current, baseline, stack, 2)
    const liveDelta = computeDelta(baseline, current)
    const generateDelta = computeDelta(baseline, next)
    expect(current.schema.food_components.garnishes).toEqual([])
    expect(generateDelta.arrays.garnishes.removed).toEqual(['lime wedges'])
    expect(generateDelta.arrays.garnishes.added).toEqual(['Fried garlic', 'Chilli flakes'])
    expect(countStudioPendingChanges(liveDelta, true)).toBe(3)
  })
})

describe('countStudioPendingChanges', () => {
  it('counts a staged finishing-touch level as one bundle without schema adds', () => {
    const state = asState(schema())
    const delta = computeDelta(state, state)
    expect(countStudioPendingChanges(delta, false)).toBe(0)
    expect(countStudioPendingChanges(delta, true)).toBe(1)
  })

  it('does not double-count when the delta already has garnish adds', () => {
    const original = asState(schema())
    const target = asState(schema({ garnishes: ['Fried garlic', 'Chilli flakes'] }))
    const delta = computeDelta(original, target)
    expect(countStudioPendingChanges(delta, true)).toBe(1)
  })

  it('adds the finishing bundle on top of lighting and garnish removals', () => {
    const original = asState(schema({ garnishes: ['lime wedges', 'cashew nuts'] }))
    const current = asState(
      schema({ lighting: 'dark-moody', garnishes: ['lime wedges'] }),
    )
    const delta = computeDelta(original, current)
    expect(countStudioPendingChanges(delta, false)).toBe(2)
    expect(countStudioPendingChanges(delta, true)).toBe(3)
  })
})
