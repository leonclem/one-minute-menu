/**
 * Controlled finishing-touch vocabulary for Studio Elements.
 * Placement is prompt-only; schema only stores garnish/side names.
 */

export const MAX_FINISHING_TOUCH_LEVEL = 4
export const DEFAULT_FINISHING_TOUCH_LEVEL = 2

export type FinishingTouchPlacement = 'on-food' | 'on-vessel' | 'scene'
export type FinishingTouchSchemaField = 'garnishes' | 'sides'
/**
 * Prompt-only cut style. Schema still stores the catalogue name only.
 * `prep` is the on-food (and vessel) form. `scenePrep` overrides table scatter
 * when the table should show a larger cut of the same ingredient.
 */
export type FinishingTouchPrep =
  | 'chopped'
  | 'sliced'
  | 'leaves'
  | 'whole'
  | 'halved'
  | 'intact'
  | 'wedge'
  | 'fine-chop'
  | 'crushed'
  | 'sprig'
  | 'whole-scatter'

export interface FinishingTouchCatalogueItem {
  id: string
  name: string
  aliases: readonly string[]
  schemaField: FinishingTouchSchemaField
  placements: readonly FinishingTouchPlacement[]
  prep: FinishingTouchPrep
  scenePrep?: FinishingTouchPrep
}

export function normalizeFinishingTouchLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

const HERB_PLACEMENTS = ['on-food', 'scene'] as const
const SCATTER_ON_FOOD = ['on-food', 'scene'] as const

export const FINISHING_TOUCH_CATALOGUE: readonly FinishingTouchCatalogueItem[] = [
  {
    id: 'coriander',
    name: 'Coriander',
    aliases: ['cilantro', 'fresh coriander', 'coriander sprigs'],
    schemaField: 'garnishes',
    placements: HERB_PLACEMENTS,
    prep: 'chopped',
    scenePrep: 'sprig',
  },
  {
    id: 'lime_wedge',
    name: 'Lime wedges',
    aliases: ['lime', 'lime wedge', 'lime half'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'wedge',
    scenePrep: 'halved',
  },
  {
    id: 'red_chilli',
    name: 'Red chilli',
    aliases: ['chili', 'chilli', 'sliced chilli', 'sliced chili', 'red chili'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'fine-chop',
    scenePrep: 'intact',
  },
  {
    id: 'cashews',
    name: 'Cashews',
    aliases: ['cashew', 'cashew nuts', 'roasted cashews'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'crushed',
    scenePrep: 'whole-scatter',
  },
  {
    id: 'parsley',
    name: 'Parsley',
    aliases: ['flat-leaf parsley', 'fresh parsley'],
    schemaField: 'garnishes',
    placements: HERB_PLACEMENTS,
    prep: 'chopped',
    scenePrep: 'sprig',
  },
  {
    id: 'basil',
    name: 'Basil',
    aliases: ['fresh basil', 'basil leaves'],
    schemaField: 'garnishes',
    placements: HERB_PLACEMENTS,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'mint',
    name: 'Mint',
    aliases: ['fresh mint', 'mint leaves'],
    schemaField: 'garnishes',
    placements: HERB_PLACEMENTS,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'spring_onion',
    name: 'Spring onion',
    aliases: ['scallion', 'scallions', 'green onion', 'green onions'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'sliced',
    scenePrep: 'intact',
  },
  {
    id: 'sesame_seeds',
    name: 'Sesame seeds',
    aliases: ['toasted sesame', 'sesame'],
    schemaField: 'garnishes',
    placements: ['on-food'],
    prep: 'whole',
  },
  {
    id: 'microgreens',
    name: 'Microgreens',
    aliases: ['micro greens'],
    schemaField: 'garnishes',
    placements: HERB_PLACEMENTS,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'lemon_wedge',
    name: 'Lemon wedges',
    aliases: ['lemon', 'lemon wedge'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'wedge',
    scenePrep: 'halved',
  },
  {
    id: 'peanuts',
    name: 'Peanuts',
    aliases: ['crushed peanuts', 'roasted peanuts'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'crushed',
    scenePrep: 'whole-scatter',
  },
  {
    id: 'crispy_shallots',
    name: 'Crispy shallots',
    aliases: ['fried shallots', 'crispy onion'],
    schemaField: 'garnishes',
    placements: ['on-food'],
    prep: 'whole',
  },
  {
    id: 'chives',
    name: 'Chives',
    aliases: ['fresh chives'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'sliced',
    scenePrep: 'sprig',
  },
  {
    id: 'chilli_flakes',
    name: 'Chilli flakes',
    aliases: ['chili flakes', 'red pepper flakes'],
    schemaField: 'garnishes',
    placements: ['on-food'],
    prep: 'whole',
  },
  {
    id: 'grated_parmesan',
    name: 'Grated parmesan',
    aliases: ['parmesan', 'shaved parmesan'],
    schemaField: 'garnishes',
    placements: ['on-food'],
    prep: 'whole',
  },
  {
    id: 'pomegranate_seeds',
    name: 'Pomegranate seeds',
    aliases: ['pomegranate'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'whole',
  },
  {
    id: 'pickled_red_onion',
    name: 'Pickled red onion',
    aliases: ['pickled onion', 'pickled onions'],
    schemaField: 'garnishes',
    placements: ['on-food', 'on-vessel'],
    prep: 'sliced',
  },
  {
    id: 'thyme',
    name: 'Thyme',
    aliases: ['fresh thyme'],
    schemaField: 'garnishes',
    placements: HERB_PLACEMENTS,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'rosemary',
    name: 'Rosemary',
    aliases: ['fresh rosemary'],
    schemaField: 'garnishes',
    placements: HERB_PLACEMENTS,
    prep: 'leaves',
    scenePrep: 'sprig',
  },
  {
    id: 'black_sesame',
    name: 'Black sesame',
    aliases: ['black sesame seeds'],
    schemaField: 'garnishes',
    placements: ['on-food'],
    prep: 'whole',
  },
  {
    id: 'fried_garlic',
    name: 'Fried garlic',
    aliases: ['garlic chips', 'crispy garlic'],
    schemaField: 'garnishes',
    placements: ['on-food'],
    prep: 'whole',
  },
  {
    id: 'coconut_flakes',
    name: 'Coconut flakes',
    aliases: ['toasted coconut'],
    schemaField: 'garnishes',
    placements: SCATTER_ON_FOOD,
    prep: 'whole',
  },
  {
    id: 'paprika',
    name: 'Paprika',
    aliases: ['smoked paprika'],
    schemaField: 'garnishes',
    placements: ['on-food'],
    prep: 'whole',
  },
]

const byId = new Map(
  FINISHING_TOUCH_CATALOGUE.map((item) => [item.id, item] as const),
)

const byNormalizedLabel = new Map<string, FinishingTouchCatalogueItem>()
for (const item of FINISHING_TOUCH_CATALOGUE) {
  for (const label of finishingTouchLabels(item)) {
    byNormalizedLabel.set(normalizeFinishingTouchLabel(label), item)
  }
}

export function finishingTouchLabels(item: FinishingTouchCatalogueItem): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const label of [item.name, item.id.replace(/_/g, ' '), ...item.aliases]) {
    const key = normalizeFinishingTouchLabel(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  return labels
}

export function getFinishingTouchById(
  id: string,
): FinishingTouchCatalogueItem | undefined {
  return byId.get(id)
}

export function getFinishingTouchByName(
  name: string,
): FinishingTouchCatalogueItem | undefined {
  return byNormalizedLabel.get(normalizeFinishingTouchLabel(name))
}

export function stackFromIds(
  ids: readonly string[],
): FinishingTouchCatalogueItem[] {
  const seen = new Set<string>()
  const stack: FinishingTouchCatalogueItem[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const item = getFinishingTouchById(id)
    if (!item) continue
    seen.add(id)
    stack.push(item)
  }
  return stack
}

export function catalogueLabelInvariants(): {
  duplicateIds: string[]
  duplicateLabels: string[]
} {
  const idCounts = new Map<string, number>()
  const labelCounts = new Map<string, number>()
  for (const item of FINISHING_TOUCH_CATALOGUE) {
    idCounts.set(item.id, (idCounts.get(item.id) ?? 0) + 1)
    for (const label of finishingTouchLabels(item)) {
      const key = normalizeFinishingTouchLabel(label)
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1)
    }
  }
  return {
    duplicateIds: Array.from(idCounts.entries()).filter(([, n]) => n > 1).map(([id]) => id),
    duplicateLabels: Array.from(labelCounts.entries())
      .filter(([, n]) => n > 1)
      .map(([label]) => label),
  }
}
