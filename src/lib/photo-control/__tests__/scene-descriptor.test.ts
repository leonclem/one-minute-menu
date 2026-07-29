import { buildSceneDescriptor, type SceneDescriptorStyles } from '../scene-descriptor'
import type { MinimalSchema, StateDelta } from '../minimal-schema'

type SchemaOverrides = {
  scene_setup?: Partial<MinimalSchema['scene_setup']>
  canvas?: Partial<MinimalSchema['canvas']>
  food_components?: Partial<MinimalSchema['food_components']>
}

function schema(overrides: SchemaOverrides = {}): MinimalSchema {
  return {
    scene_setup: {
      angle: '45-degree',
      framing: 'close-up',
      lighting: 'bright-and-airy',
      spin: '0',
      ...(overrides.scene_setup ?? {}),
    },
    canvas: {
      background: 'visible restaurant wall',
      background_style: '',
      surface_style: '',
      main_vessel: 'white oval platter',
      ...(overrides.canvas ?? {}),
    },
    food_components: {
      main_item: 'Hainanese chicken rice',
      garnishes: ['spring onion'],
      sides: ['chilli sauce'],
      ...(overrides.food_components ?? {}),
    },
  }
}

function delta(scalarChanges: StateDelta['scalarChanges'], arrays?: StateDelta['arrays']): StateDelta {
  return {
    scalarChanges,
    arrays: arrays ?? {
      garnishes: { added: [], removed: [] },
      sides: { added: [], removed: [] },
    },
    isEmpty: false,
  }
}

const styles: SceneDescriptorStyles = {
  lighting: {
    key: 'studio',
    descriptor: {
      quality: 'clean commercial studio, even key with soft fill',
      temperature: 'neutral',
      shadows: 'soft',
      falloff: 'gradual',
      private_value: 'must not be copied',
    },
    short_description: 'wrong fallback should not win',
    prompt_fragment: 'Apply studio lighting.',
    negative_constraints: 'Do not add props.',
  },
  backdrop: {
    key: 'studio-yellow',
    descriptor: {
      material: 'seamless studio backdrop',
      colour: '#F2C200',
      falloff: 'soft professional',
    },
  },
  surface: {
    key: 'dark-slate',
    descriptor: {
      material: 'dark slate stone',
      finish: 'honed matte',
      colour: '#2E3338',
    },
  },
}

describe('buildSceneDescriptor', () => {
  it('maps staged camera and style changes to current and target semantic sections', () => {
    const original = schema({
      scene_setup: { lighting: 'bright-and-airy' },
      canvas: { background_style: '', surface_style: '' },
    })
    const target = schema({
      scene_setup: { lighting: 'studio' },
      canvas: { background_style: 'studio-yellow', surface_style: 'dark-slate' },
    })
    const result = buildSceneDescriptor({
      original,
      target,
      delta: delta([
        { path: 'scene_setup.lighting', from: 'bright-and-airy', to: 'studio' },
        { path: 'canvas.background_style', from: '', to: 'studio-yellow' },
        { path: 'canvas.surface_style', from: '', to: 'dark-slate' },
      ]),
      styles,
      observations: {
        lighting: { quality: 'observed household light' },
        backdrop: { material: 'visible restaurant wall' },
        surface: { material: 'wooden table' },
      },
      labels: ['Image A'],
    })

    expect(result.target.lighting).toEqual({
      quality: 'clean commercial studio, even key with soft fill',
      temperature: 'neutral',
      shadows: 'soft',
      falloff: 'gradual',
    })
    expect(result.target.backdrop).toEqual({
      material: 'seamless studio backdrop',
      colour: '#F2C200',
      falloff: 'soft professional',
      mode: 'replace',
    })
    expect(result.target.surface).toEqual(styles.surface!.descriptor)
    expect(result.current.lighting).toEqual({ quality: 'observed household light' })
    expect(result.current.backdrop).toEqual({ material: 'visible restaurant wall' })
    expect(result.current.surface).toEqual({ material: 'wooden table' })
    expect(result.target).toHaveProperty('surface')
  })

  it('constructs one positive locked identity array and excludes prohibition fields', () => {
    const result = buildSceneDescriptor({
      original: schema(),
      target: schema(),
      delta: delta([]),
      styles: {},
      observations: {},
      labels: ['Image A'],
    })

    expect(result.subject.locked).toEqual([
      'dish identity',
      'ingredient and component counts',
      'vessel',
      'framing',
      'colours and textures',
    ])
    expect(JSON.stringify(result)).not.toContain('negative_constraints')
    expect(JSON.stringify(result)).not.toContain('Do not add props.')
  })

  it('omits unknown descriptor fields and invalid colour values without defaults', () => {
    const result = buildSceneDescriptor({
      original: schema(),
      target: schema({ canvas: { surface_style: 'unknown' } }),
      delta: delta([{ path: 'canvas.surface_style', from: '', to: 'unknown' }]),
      styles: {
        surface: {
          descriptor: { material: 'stone', colour: 'blue', private_value: 'secret' },
        },
      },
      observations: {},
      labels: ['Image A'],
    })

    expect(result.target.surface).toEqual({ material: 'stone' })
    expect(result.target.surface).not.toHaveProperty('private_value')
    expect(result.target.surface).not.toHaveProperty('colour')
  })

  it('uses short_description and one raw prompt note for null descriptors', () => {
    const result = buildSceneDescriptor({
      original: schema(),
      target: schema({ scene_setup: { lighting: 'studio' } }),
      delta: delta([{ path: 'scene_setup.lighting', from: 'bright-and-airy', to: 'studio' }]),
      styles: {
        lighting: {
          descriptor: null,
          short_description: 'Soft directional window light',
          prompt_fragment: 'Apply window light while preserving the dish.',
          negative_constraints: 'Do not add props.',
        },
      },
      observations: {},
      labels: ['Image A'],
    })

    expect(result.target.lighting).toEqual({
      quality: 'Soft directional window light',
      note: 'Apply window light while preserving the dish.',
    })
    expect(result.target.lighting).not.toHaveProperty('negative_constraints')
  })

  it('omits legacy prompt fragments when building the FOH descriptor', () => {
    const result = buildSceneDescriptor({
      original: schema(),
      target: schema({ canvas: { background_style: 'studio-yellow' } }),
      delta: delta([{ path: 'canvas.background_style', from: '', to: 'studio-yellow' }]),
      styles: {
        backdrop: {
          descriptor: null,
          short_description: 'Vibrant yellow studio backdrop',
          prompt_fragment: 'Change only the vertical backdrop/wall behind the tabletop to yellow.',
        },
      },
      observations: { backdrop_visible: false },
      labels: ['Image A'],
      includePromptFragmentFallback: false,
    })

    expect(result.target.backdrop).toEqual({
      material: 'Vibrant yellow studio backdrop',
      mode: 'establish',
    })
    expect(JSON.stringify(result)).not.toContain('Change only the vertical backdrop')
  })

  it('binds only supplied attached labels one-to-one, source first', () => {
    const original = schema()
    const target = schema({
      scene_setup: { lighting: 'studio' },
      canvas: { background_style: 'studio-yellow', surface_style: 'dark-slate' },
    })
    const result = buildSceneDescriptor({
      original,
      target,
      delta: delta([
        { path: 'scene_setup.lighting', from: 'bright-and-airy', to: 'studio' },
        { path: 'canvas.background_style', from: '', to: 'studio-yellow' },
        { path: 'canvas.surface_style', from: '', to: 'dark-slate' },
      ]),
      styles,
      observations: {},
      labels: ['Image A', 'Image B', 'Image C', 'Image D'],
    })

    expect(result.subject.reference).toBe('Image A')
    expect(result.target.lighting!.reference).toBe('Image B')
    expect(result.target.backdrop!.reference).toBe('Image C')
    expect(result.target.surface!.reference).toBe('Image D')

    const customerResult = buildSceneDescriptor({
      original,
      target,
      delta: delta([
        { path: 'scene_setup.lighting', from: 'bright-and-airy', to: 'studio' },
        { path: 'canvas.background_style', from: '', to: 'studio-yellow' },
        { path: 'canvas.surface_style', from: '', to: 'dark-slate' },
      ]),
      styles,
      observations: {},
      labels: ['Image A'],
    })
    expect(customerResult.subject.reference).toBe('Image A')
    expect(customerResult.target.lighting).not.toHaveProperty('reference')
    expect(customerResult.target.backdrop).not.toHaveProperty('reference')
    expect(customerResult.target.surface).not.toHaveProperty('reference')
  })

  it('uses diagnostics omissions to keep defaulted control state out of Tier 2', () => {
    const original = schema({
      scene_setup: { angle: '45-degree' },
      food_components: { main_item: 'defaulted dish' },
    })
    const target = schema({ scene_setup: { angle: 'eye-level' } })
    const result = buildSceneDescriptor({
      original,
      target,
      delta: delta([{ path: 'scene_setup.angle', from: '45-degree', to: 'eye-level' }]),
      styles: {},
      observations: {
        observations: {
          scene_setup: { angle: '45-degree' },
          food_components: { main_item: 'defaulted dish' },
        },
        omittedFields: [
          { path: 'scene_setup.angle', reason: 'coerced_for_control_state' },
          { path: 'food_components.main_item', reason: 'coerced_for_control_state' },
        ],
      },
      labels: ['Image A'],
    })

    expect(result.current.camera).toBeUndefined()
    expect(result.subject).not.toHaveProperty('dish')
    expect(result.target.camera).toEqual({ angle: 'eye-level' })
  })
})
