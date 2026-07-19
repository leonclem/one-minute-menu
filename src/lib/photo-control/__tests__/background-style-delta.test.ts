/**
 * Unit tests — canvas.background_style editable scalar path (Chunk 4).
 */

import { computeDelta, applyDelta, countEditableChanges } from '../state-delta'
import { generateDirective } from '../directive-generator'
import { CENTER, type EditorState } from '../minimal-schema'

function state(backgroundStyle: string, lighting = 'bright-and-airy'): EditorState {
  return {
    schema: {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting },
      canvas: {
        background: 'wood table',
        background_style: backgroundStyle,
        main_vessel: 'plate',
      },
      food_components: { main_item: 'burger', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

describe('background_style delta', () => {
  it('records a scalar change when background_style changes', () => {
    const delta = computeDelta(state(''), state('dark-slate'))
    expect(delta.isEmpty).toBe(false)
    expect(delta.scalarChanges).toEqual([
      { path: 'canvas.background_style', from: '', to: 'dark-slate' },
    ])
    expect(countEditableChanges(delta)).toBe(1)
  })

  it('applies background_style via applyDelta', () => {
    const original = state('')
    const delta = computeDelta(original, state('marble-counter'))
    const next = applyDelta(original, delta)
    expect(next.schema.canvas.background_style).toBe('marble-counter')
    expect(next.schema.canvas.background).toBe('wood table')
  })

  it('omit background/lighting clauses when excludePaths is set', () => {
    const original = state('', 'bright-and-airy')
    const target = state('dark-slate', 'low-key')
    const delta = computeDelta(original, target)
    const directive = generateDirective(delta, target, {
      excludePaths: ['scene_setup.lighting', 'canvas.background_style'],
    })
    expect(directive).toBeTruthy()
    expect(directive).not.toContain('low-key')
    expect(directive).not.toContain('dark-slate')
    expect(directive).toContain('Preserve the identity')
  })

  it('includes a fallback background clause when not excluded', () => {
    const original = state('')
    const target = state('dark-slate')
    const delta = computeDelta(original, target)
    const directive = generateDirective(delta, target)
    expect(directive).toContain('background/surface')
    expect(directive).toContain('dark-slate')
  })
})
