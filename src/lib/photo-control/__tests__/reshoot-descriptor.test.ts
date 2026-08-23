import { buildReshootDescriptor } from '../scene-descriptor'
import { composePrompt, MAX_PROMPT_LENGTH_BY_TASK, TASK_FRAMING } from '../prompt-composer'
import type { MinimalSchema } from '../minimal-schema'

function schema(): MinimalSchema {
  return {
    scene_setup: {
      angle: '45-degree',
      framing: 'close-up',
      lighting: 'bright-and-airy',
      spin: '0',
    },
    canvas: {
      background: 'restaurant wall',
      background_style: 'soft-neutral',
      surface_style: 'white-tablecloth',
      main_vessel: 'white plate',
    },
    food_components: {
      main_item: 'Hainanese chicken rice',
      garnishes: ['cucumber'],
      sides: ['chilli sauce'],
    },
  }
}

const styles = {
  lighting: {
    descriptor: { quality: 'clean studio', temperature: 'neutral', shadows: 'soft', falloff: 'gradual' },
  },
  backdrop: {
    descriptor: {
      appearance: 'soft warm neutral background',
      colour: '#E7E3DC',
      texture: 'smooth matte appearance with extremely subtle natural tonal variation',
      falloff: 'soft, even and unobtrusive',
    },
  },
  surface: {
    descriptor: { material: 'white cloth', finish: 'matte', colour: '#FFFFFF' },
  },
}

describe('reshoot descriptor and prompt modes', () => {
  it('keeps the edit framing string byte-identical', () => {
    expect(TASK_FRAMING.edit).toBe(
      'Constrained edit: change only what "target" names; keep everything else exactly as-is; preserve the original composition. Semantic negative prompt: "subject.locked" remains pixel-faithful.',
    )
  })

  it('uses the same rogue-prompt ceiling for edit and reshoot', () => {
    expect(MAX_PROMPT_LENGTH_BY_TASK.reshoot).toBe(MAX_PROMPT_LENGTH_BY_TASK.edit)
  })

  it('locks plating arrangement when improvePlating is false', () => {
    const descriptor = buildReshootDescriptor({
      base: schema(),
      styles,
      observations: { description: 'Steamed chicken on rice with cucumber slices.' },
      labels: ['Image A', 'Image B', 'Image C', 'Image D'],
      improvePlating: false,
    })

    expect(descriptor.task).toBe('reshoot')
    expect(descriptor.subject.locked).toEqual([
      'dish identity',
      'ingredient and component counts',
      'vessel type',
      'core food colours',
      'plating arrangement',
    ])
    expect(descriptor.subject.description).toBe('Steamed chicken on rice with cucumber slices.')
  })

  it('releases plating arrangement when improvePlating is true', () => {
    const descriptor = buildReshootDescriptor({
      base: schema(),
      styles,
      observations: {},
      labels: ['Image A', 'Image B', 'Image C', 'Image D'],
      improvePlating: true,
    })

    expect(descriptor.subject.locked).not.toContain('plating arrangement')
    expect(descriptor.target.lighting).toBeDefined()
    expect(descriptor.target.backdrop).toBeDefined()
    expect(descriptor.target.surface).toBeDefined()
  })

  it('uses the reshoot framing under the shared prompt ceiling', () => {
    const descriptor = buildReshootDescriptor({
      base: schema(),
      styles,
      observations: { description: 'Chicken rice with chilli and cucumber.' },
      labels: ['Image A', 'Image B', 'Image C', 'Image D'],
    })
    const result = composePrompt({
      directive: 'Re-shoot this dish with the target scene settings.',
      descriptor,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.prompt).toContain(TASK_FRAMING.reshoot)
      expect(result.prompt.length).toBeLessThan(MAX_PROMPT_LENGTH_BY_TASK.reshoot)
    }
  })
})
