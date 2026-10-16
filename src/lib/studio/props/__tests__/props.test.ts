/**
 * @jest-environment node
 */

import { generateDirective } from '@/lib/photo-control/directive-generator'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { SceneDescriptor } from '@/lib/photo-control/scene-descriptor'
import { applyPropsTarget, parseStudioPropIds } from '../apply'
import { getStudioProp, propsFromIds } from '../catalogue'

function state(garnishes: string[] = []): EditorState {
  const schema: MinimalSchema = {
    scene_setup: {
      angle: '45-degree',
      framing: 'close-up',
      lighting: 'bright-clean',
      spin: '0',
    },
    canvas: {
      background: 'wood',
      background_style: '',
      surface_style: '',
      main_vessel: 'white bowl',
    },
    food_components: {
      main_item: 'roast chicken',
      garnishes,
      sides: [],
    },
  }
  return { schema, position: { ...CENTER } }
}

describe('studio props catalogue', () => {
  it('keeps selection order and drops unknown ids', () => {
    expect(propsFromIds(['fork', 'missing', 'fork', 'folded-napkin']).map((prop) => prop.id)).toEqual([
      'fork',
      'folded-napkin',
    ])
    expect(getStudioProp('yellow-pepper')?.label).toBe('Yellow pepper')
  })

  it('rejects an unknown prop id', () => {
    expect(parseStudioPropIds(['folded-napkin', 'vase'])).toEqual({
      ok: false,
      error: 'Unknown prop selection.',
    })
  })

  it('accepts several known props', () => {
    const parsed = parseStudioPropIds(['ramekin-nuts', 'salt-shaker'])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.props.map((prop) => prop.label)).toEqual(['Ramekin of nuts', 'Salt shaker'])
  })
})

describe('studio props directive', () => {
  const napkin = getStudioProp('folded-napkin')
  const fork = getStudioProp('fork')
  const ramekin = getStudioProp('ramekin-nuts')

  it('describes a prop when nothing else is staged', () => {
    const current = state()
    const directive = generateDirective(computeDelta(current, current), current, {
      props: napkin ? [napkin] : [],
    })
    expect(directive).toContain('Add only these named props:')
    expect(directive).toContain('ivory linen napkin')
    expect(directive).toContain('plain flat rectangle')
    expect(directive).toContain('except for "Folded napkin"')
    expect(directive).toContain('Leave all other attributes of the scene unchanged.')
  })

  it('describes every selected prop and lifts the napkin lock beside garnishes', () => {
    const original = state()
    const target = state(['Coriander'])
    const directive = generateDirective(computeDelta(original, target), target, {
      props: [napkin, fork, ramekin].filter((prop) => prop != null),
    })
    expect(directive).toContain('Folded napkin')
    expect(directive).toContain('four straight tines')
    expect(directive).toContain('whole cashews and whole almonds')
    expect(directive).toContain('Do not add a knife.')
    expect(directive).toContain('props other than the named props')
    expect(directive).not.toContain('Do not add extra bowls, serving dishes, cutlery, napkins')
    expect(directive).toContain('except for "Coriander", "Folded napkin", "Fork", and "Ramekin of nuts"')
  })
})

describe('applyPropsTarget', () => {
  it('names the props on the descriptor target', () => {
    const descriptor = {
      task: 'edit',
      subject: { locked: ['dish identity'] },
      camera: {},
      current: {},
      target: {},
      output: { style: 'photorealistic', framing: 'full shot, no cropping' },
    } as SceneDescriptor
    const next = applyPropsTarget(descriptor, propsFromIds(['yellow-pepper']))
    expect(next.target.props).toEqual([
      {
        name: 'Yellow pepper',
        description: expect.stringContaining('yellow bell pepper'),
        placement: expect.stringContaining('existing tabletop'),
      },
    ])
  })
})
