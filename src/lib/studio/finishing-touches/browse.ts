import {
  catalogueItemsForFamily,
  getFinishingTouchById,
  type FinishingTouchCatalogueItem,
  type FinishingTouchFamily,
} from './catalogue'

export interface FinishingTouchBrowseGroup {
  id: string
  label: string
  items: readonly FinishingTouchCatalogueItem[]
}

const SAVORY_GROUPS: readonly { id: string; label: string; ids: readonly string[] }[] = [
  {
    id: 'herbs',
    label: 'Herbs',
    ids: [
      'coriander',
      'parsley',
      'basil',
      'mint',
      'microgreens',
      'chives',
      'thyme',
      'rosemary',
      'dill',
      'oregano',
      'sage',
      'tarragon',
    ],
  },
  {
    id: 'fresh',
    label: 'Fresh cuts',
    ids: [
      'lime_wedge',
      'lemon_wedge',
      'lime_zest',
      'red_chilli',
      'spring_onion',
      'pickled_red_onion',
      'radish_slices',
      'cucumber_slices',
      'cherry_tomato_halves',
      'nori_strips',
    ],
  },
  {
    id: 'pantry',
    label: 'Seeds, nuts, and seasoning',
    ids: [
      'cashews',
      'peanuts',
      'pistachio_nuts',
      'toasted_pine_nuts',
      'flaked_almonds',
      'sesame_seeds',
      'black_sesame',
      'pumpkin_seeds',
      'pomegranate_seeds',
      'crispy_shallots',
      'fried_garlic',
      'fried_capers',
      'chilli_flakes',
      'toasted_breadcrumbs',
      'grated_parmesan',
      'coconut_flakes',
      'paprika',
      'furikake',
      'cracked_black_pepper',
      'sumac',
      'chilli_oil_drizzle',
      'balsamic_glaze',
    ],
  },
]

const CAKE_GROUPS: readonly { id: string; label: string; ids: readonly string[] }[] = [
  {
    id: 'fruit',
    label: 'Fruit',
    ids: [
      'fresh_berries',
      'fresh_strawberry_slices',
      'sliced_bananas',
      'fresh_fig_slices',
      'kiwi_slices',
      'passion_fruit_pulp',
      'lemon_zest',
      'orange_zest',
    ],
  },
  {
    id: 'finish',
    label: 'Dusting and drizzle',
    ids: [
      'powdered_sugar',
      'cocoa_dusting',
      'cinnamon_dusting',
      'matcha_dusting',
      'desiccated_coconut',
      'chocolate_drizzle',
      'white_chocolate_drizzle',
      'caramel_drizzle',
      'lemon_drizzle',
      'honey_drizzle',
      'berry_coulis',
      'cream_swirl',
      'lemon_curd_swirl',
      'mint_sprig',
      'edible_rose_petals',
      'edible_pansies',
    ],
  },
  {
    id: 'crunch',
    label: 'Nuts and chocolate',
    ids: [
      'chocolate_shavings',
      'chocolate_chips',
      'pistachio_crumbs',
      'chopped_pecans',
      'crushed_hazelnuts',
      'chopped_walnuts',
      'toasted_flaked_almonds',
      'toasted_coconut_chips',
      'biscuit_crumbs',
      'crushed_meringue',
      'cacao_nibs',
      'candied_orange_peel',
      'candied_lemon_peel',
      'candied_ginger',
    ],
  },
]

function groupsFor(family: FinishingTouchFamily) {
  return family === 'cake' ? CAKE_GROUPS : SAVORY_GROUPS
}

export function browseGroupsForFamily(
  family: FinishingTouchFamily,
): FinishingTouchBrowseGroup[] {
  return groupsFor(family).map((group) => ({
    id: group.id,
    label: group.label,
    items: group.ids.flatMap((id) => {
      const item = getFinishingTouchById(id)
      return item && (item.family ?? 'savory') === family ? [item] : []
    }),
  }))
}

/** Every family item appears in exactly one browse group. */
export function browseGroupCoverage(family: FinishingTouchFamily): {
  missing: string[]
  duplicates: string[]
} {
  const seen = new Map<string, number>()
  for (const group of groupsFor(family)) {
    for (const id of group.ids) {
      seen.set(id, (seen.get(id) ?? 0) + 1)
    }
  }
  const catalogueIds = catalogueItemsForFamily(family).map((item) => item.id)
  return {
    missing: catalogueIds.filter((id) => !seen.has(id)),
    duplicates: Array.from(seen.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id),
  }
}
