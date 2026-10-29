/**
 * @jest-environment node
 */

import { generateDirective } from '@/lib/photo-control/directive-generator'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { CENTER, type EditorState, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import type { SceneDescriptor } from '@/lib/photo-control/scene-descriptor'
import { applyPropsTarget, parseStudioPropIds } from '../apply'
import { getStudioProp, propsFromIds, sanitizeRecommendedPropIds } from '../catalogue'

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

  it('offers premium background plants and keeps the vine off the table', () => {
    for (const id of ['dried-grasses', 'leafy-stems', 'cow-parsley']) {
      const plant = getStudioProp(id)
      expect(plant?.audience).toBe('any')
      expect(plant?.group).toBe('greenery')
      expect(plant?.placement).toContain('behind the vessel')
      expect(plant?.placement).toContain('Do not cover the food')
    }
    const vine = getStudioProp('trailing-vine')
    expect(vine?.placement).toContain('top edge')
    expect(vine?.placement).toContain('does not rest on the table')
    const basil = getStudioProp('potted-basil')
    expect(basil?.audience).toBe('savory')
    expect(basil?.description).toContain('whole plant')
  })

  it('describes the salt props as wooden mills, without forbidding mills', () => {
    const salt = getStudioProp('salt-shaker')
    const pair = getStudioProp('salt-and-pepper')
    expect(salt?.description).toContain('dark-walnut salt mill')
    expect(pair?.description).toContain('dark-walnut mills')
    expect(`${salt?.description} ${pair?.description}`.toLowerCase()).not.toContain('no wooden mill')
  })

  it('keeps savoury props and drops cake-only props from a savoury rank', () => {
    expect(
      sanitizeRecommendedPropIds(
        [
          'chopsticks',
          'missing',
          'chopsticks',
          'olive-oil-cruet',
          'jam-jar',
          'whole-lemon',
          'flour-bag',
          'fork',
        ],
        'savory',
      ).map((prop) => prop.id),
    ).toEqual(['chopsticks', 'olive-oil-cruet', 'whole-lemon', 'fork'])
  })

  it('keeps cake and shared props for a cake rank', () => {
    expect(
      sanitizeRecommendedPropIds(
        ['salt-shaker', 'olive-oil-cruet', 'flour-bag', 'chocolate-bar', 'folded-napkin'],
        'cake',
      ).map((prop) => prop.id),
    ).toEqual(['flour-bag', 'chocolate-bar', 'folded-napkin'])
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
    expect(parsed.props.map((prop) => prop.label)).toEqual(['Ramekin of nuts', 'Salt mill'])
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
    expect(directive).toContain('Add only the props in target.props.')
    expect(directive).not.toContain('ivory linen napkin')
    expect(directive).not.toContain('plain flat rectangle')
    expect(directive).toContain('except for "Folded napkin"')
    expect(directive).toContain('Leave all other attributes of the scene unchanged.')
  })

  it('describes every selected prop and lifts the napkin lock beside garnishes', () => {
    const original = state()
    const target = state(['Coriander'])
    const directive = generateDirective(computeDelta(original, target), target, {
      props: [napkin, fork, ramekin].filter((prop) => prop != null),
    })
    expect(directive).toContain('Add only the props in target.props.')
    expect(directive).not.toContain('four straight tines')
    expect(directive).not.toContain('whole cashews and whole almonds')
    expect(directive).not.toContain('Do not add a knife.')
    expect(directive).toContain('Add only the finishing touches in target.finishingTouches.')
    expect(directive).not.toContain('props other than the named props')
    expect(directive).not.toContain('lightly scattered')
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
    expect(next.target.propsRule).toContain('soft contact shadow on the tabletop')
  })

  it('does not anchor the old tabletop in JSON when the surface is also changing', () => {
    const descriptor = {
      task: 'edit',
      subject: { locked: ['dish identity'] },
      camera: {},
      current: {},
      target: { surface: { material: 'dark natural stone', finish: 'honed matte', colour: '#2E3338' } },
      output: { style: 'photorealistic', framing: 'full shot, no cropping' },
    } as SceneDescriptor
    const next = applyPropsTarget(descriptor, propsFromIds(['yellow-pepper', 'fork']), {
      surfaceChanging: true,
    })
    for (const prop of next.target.props ?? []) {
      expect(prop.placement).not.toContain('existing tabletop')
      expect(prop.placement).not.toContain('current tabletop')
      expect(prop.placement).toContain('tabletop')
    }
  })
})

describe('props beside a surface change', () => {
  it('drops existing-tabletop and existing-light wording when those axes are staged', () => {
    const original = state()
    const target = state()
    target.schema.canvas.surface_style = 'dark-stone'
    target.schema.scene_setup.lighting = 'dark-moody'
    const pepper = getStudioProp('yellow-pepper')
    const directive = generateDirective(computeDelta(original, target), target, {
      props: pepper ? [pepper] : [],
    })
    expect(directive).not.toContain('existing tabletop')
    expect(directive).not.toContain('current tabletop')
    expect(directive).not.toContain('existing light')
    expect(directive).not.toContain('Keep the existing lighting')
    expect(directive).not.toContain('Keep the existing tabletop')
    expect(directive).toContain('Add only the props in target.props.')
    expect(directive).not.toContain('Cast a soft contact shadow')
    expect(directive).not.toContain('beside the vessel')
  })
})
