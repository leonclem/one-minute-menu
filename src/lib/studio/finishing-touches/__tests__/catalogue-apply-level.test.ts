/**
 * @jest-environment node
 */

import {
  FINISHING_TOUCH_CATALOGUE,
  catalogueLabelInvariants,
  getFinishingTouchById,
  getFinishingTouchByName,
  stackFromIds,
} from '../catalogue'
import {
  applyFinishingTouchesLevel,
  clampFinishingTouchLevel,
  finishingTouchLevelOptions,
} from '../apply-level'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'

function schema(partial?: {
  mainItem?: string
  lighting?: string
  surface?: string
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
      surface_style: partial?.surface ?? '',
      main_vessel: 'white bowl',
    },
    food_components: {
      main_item: partial?.mainItem ?? 'massaman curry with rice',
      garnishes: partial?.garnishes ?? [],
      sides: partial?.sides ?? [],
    },
  }
}

const massamanStack = stackFromIds(['coriander', 'lime_wedge', 'red_chilli', 'cashews'])

describe('finishing-touch catalogue', () => {
  it('has unique ids and labels', () => {
    const { duplicateIds, duplicateLabels } = catalogueLabelInvariants()
    expect(duplicateIds).toEqual([])
    expect(duplicateLabels).toEqual([])
    expect(FINISHING_TOUCH_CATALOGUE.length).toBeGreaterThanOrEqual(15)
    expect(FINISHING_TOUCH_CATALOGUE.length).toBeLessThanOrEqual(30)
  })

  it('resolves coriander aliases', () => {
    expect(getFinishingTouchById('coriander')?.name).toBe('Coriander')
    expect(getFinishingTouchByName('cilantro')?.id).toBe('coriander')
  })

  it('assigns a prompt-only on-food and table form to every catalogue item', () => {
    const expected: Record<
      string,
      { prep: string; scenePrep?: string }
    > = {
      coriander: { prep: 'chopped', scenePrep: 'sprig' },
      lime_wedge: { prep: 'wedge', scenePrep: 'halved' },
      red_chilli: { prep: 'fine-chop', scenePrep: 'intact' },
      cashews: { prep: 'crushed', scenePrep: 'whole-scatter' },
      parsley: { prep: 'chopped', scenePrep: 'sprig' },
      basil: { prep: 'leaves', scenePrep: 'sprig' },
      mint: { prep: 'leaves', scenePrep: 'sprig' },
      spring_onion: { prep: 'sliced', scenePrep: 'intact' },
      sesame_seeds: { prep: 'whole' },
      microgreens: { prep: 'leaves', scenePrep: 'sprig' },
      lemon_wedge: { prep: 'wedge', scenePrep: 'halved' },
      peanuts: { prep: 'crushed', scenePrep: 'whole-scatter' },
      crispy_shallots: { prep: 'whole' },
      chives: { prep: 'sliced', scenePrep: 'sprig' },
      chilli_flakes: { prep: 'whole' },
      grated_parmesan: { prep: 'whole' },
      pomegranate_seeds: { prep: 'whole' },
      pickled_red_onion: { prep: 'sliced' },
      thyme: { prep: 'leaves', scenePrep: 'sprig' },
      rosemary: { prep: 'leaves', scenePrep: 'sprig' },
      black_sesame: { prep: 'whole' },
      fried_garlic: { prep: 'whole' },
      coconut_flakes: { prep: 'whole' },
      paprika: { prep: 'whole' },
    }
    expect(FINISHING_TOUCH_CATALOGUE.map((item) => item.id).sort()).toEqual(
      Object.keys(expected).sort(),
    )
    for (const item of FINISHING_TOUCH_CATALOGUE) {
      expect(item.prep).toBe(expected[item.id].prep)
      expect(item.scenePrep).toBe(expected[item.id].scenePrep)
    }
  })
})

describe('applyFinishingTouchesLevel', () => {
  it('appends the first N stack names and leaves the rest of the JSON unchanged', () => {
    const baseline = schema()
    const next = applyFinishingTouchesLevel({
      baseline,
      stack: massamanStack,
      level: 2,
    })
    expect(next.food_components.garnishes).toEqual(['Coriander', 'Lime wedges'])
    expect(next.food_components.main_item).toBe(baseline.food_components.main_item)
    expect(next.scene_setup.lighting).toBe(baseline.scene_setup.lighting)
    expect(next.canvas.surface_style).toBe(baseline.canvas.surface_style)
    expect(next.canvas.main_vessel).toBe(baseline.canvas.main_vessel)
  })

  it('skips aliases already on the dish and fills from later stack items', () => {
    const baseline = schema({ garnishes: ['cilantro'] })
    const next = applyFinishingTouchesLevel({
      baseline,
      stack: massamanStack,
      level: 2,
    })
    expect(next.food_components.garnishes).toEqual(['cilantro', 'Lime wedges', 'Red chilli'])
  })

  it('drops extra finishing-touch names when switching from level 3 to 1', () => {
    const baseline = schema()
    const level3 = applyFinishingTouchesLevel({
      baseline,
      stack: massamanStack,
      level: 3,
    })
    expect(level3.food_components.garnishes).toEqual(['Coriander', 'Lime wedges', 'Red chilli'])
    const level1 = applyFinishingTouchesLevel({
      baseline,
      current: level3,
      stack: massamanStack,
      level: 1,
    })
    expect(level1.food_components.garnishes).toEqual(['Coriander'])
  })

  it('keeps extract garnishes the user did not remove, and keeps other staged fields', () => {
    const baseline = schema({ garnishes: ['parsley'], lighting: 'bright-clean' })
    const current = schema({
      garnishes: ['parsley'],
      lighting: 'dark-moody',
      surface: 'white-marble',
    })
    const next = applyFinishingTouchesLevel({
      baseline,
      current,
      stack: massamanStack,
      level: 1,
    })
    expect(next.food_components.garnishes).toEqual(['parsley', 'Coriander'])
    expect(next.scene_setup.lighting).toBe('dark-moody')
    expect(next.canvas.surface_style).toBe('white-marble')
  })

  it('does not restore an extract garnish the user already removed', () => {
    const baseline = schema({ garnishes: ['parsley'] })
    const current = schema({ garnishes: [] })
    const next = applyFinishingTouchesLevel({
      baseline,
      current,
      stack: massamanStack,
      level: 1,
    })
    expect(next.food_components.garnishes).toEqual(['Coriander'])
  })
})

describe('finishingTouchLevelOptions', () => {
  it('builds cumulative labels', () => {
    const options = finishingTouchLevelOptions(massamanStack)
    expect(options).toHaveLength(4)
    expect(options[0]).toMatchObject({ level: 1, label: 'Coriander' })
    expect(options[3]?.label).toBe('Coriander, Lime wedges, Red chilli, Cashews')
    expect(clampFinishingTouchLevel(9, 4)).toBe(4)
    expect(clampFinishingTouchLevel(0, 4)).toBe(1)
  })
})
