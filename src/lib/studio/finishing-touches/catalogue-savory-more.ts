import type { FinishingTouchCatalogueItem } from './catalogue'

const HERB = ['on-food', 'scene'] as const
const ON_FOOD = ['on-food'] as const
const ON_FOOD_AND_SCENE = ['on-food', 'scene'] as const

/**
 * Second-wave savoury garnishes. Placements stay limited to the ones the
 * prompt should actually request. Labels must not collide with the cake list.
 */
export const SAVORY_FINISHING_TOUCH_MORE: readonly FinishingTouchCatalogueItem[] = [
  {
    id: 'oregano',
    name: 'Oregano',
    aliases: ['fresh oregano', 'oregano leaves'],
    schemaField: 'garnishes',
    placements: HERB,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'sage',
    name: 'Sage',
    aliases: ['fresh sage', 'sage leaves'],
    schemaField: 'garnishes',
    placements: HERB,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'tarragon',
    name: 'Tarragon',
    aliases: ['fresh tarragon', 'tarragon leaves'],
    schemaField: 'garnishes',
    placements: HERB,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'radish_slices',
    name: 'Radish slices',
    aliases: ['thin radish slices', 'sliced red radish'],
    schemaField: 'garnishes',
    placements: ON_FOOD_AND_SCENE,
    prep: 'sliced',
    scenePrep: 'intact',
  },
  {
    id: 'cucumber_slices',
    name: 'Cucumber slices',
    aliases: ['thin cucumber slices', 'sliced cucumber'],
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'sliced',
  },
  {
    id: 'cherry_tomato_halves',
    name: 'Cherry tomato halves',
    aliases: ['halved cherry tomatoes', 'cherry tomato half'],
    schemaField: 'garnishes',
    placements: ON_FOOD_AND_SCENE,
    prep: 'halved',
    scenePrep: 'intact',
  },
  {
    id: 'pumpkin_seeds',
    name: 'Pumpkin seeds',
    aliases: ['pepitas', 'toasted pumpkin seeds'],
    schemaField: 'garnishes',
    placements: ON_FOOD_AND_SCENE,
    prep: 'whole',
  },
  {
    id: 'toasted_breadcrumbs',
    name: 'Toasted breadcrumbs',
    aliases: ['crispy breadcrumbs', 'pangrattato'],
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'crushed',
  },
  {
    id: 'furikake',
    name: 'Furikake',
    aliases: ['japanese rice seasoning', 'furikake seasoning'],
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'whole',
  },
  {
    id: 'lime_zest',
    name: 'Lime zest',
    aliases: ['finely grated lime zest'],
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'fine-chop',
  },
  {
    id: 'pistachio_nuts',
    name: 'Pistachio nuts',
    aliases: ['shelled pistachios'],
    schemaField: 'garnishes',
    placements: ON_FOOD_AND_SCENE,
    prep: 'crushed',
    scenePrep: 'whole-scatter',
  },
  {
    id: 'cracked_black_pepper',
    name: 'Cracked black pepper',
    aliases: ['freshly ground black pepper', 'ground black pepper'],
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'dusted',
  },
  {
    id: 'sumac',
    name: 'Sumac',
    aliases: ['ground sumac', 'sumac powder'],
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'dusted',
  },
]
