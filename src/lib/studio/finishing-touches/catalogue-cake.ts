import type { FinishingTouchCatalogueItem } from './catalogue'

const ON_FOOD = ['on-food'] as const
const ON_FOOD_AND_VESSEL = ['on-food', 'on-vessel'] as const
const ON_VESSEL = ['on-vessel'] as const

/**
 * Dessert-cake finishing touches. Labels must stay unique from the savoury
 * catalogue (including mint vs mint sprig, lemon wedges vs lemon zest).
 */
export const CAKE_FINISHING_TOUCH_CATALOGUE: readonly FinishingTouchCatalogueItem[] = [
  {
    id: 'fresh_berries',
    name: 'Fresh berries',
    aliases: ['mixed berries', 'fresh mixed berries', 'strawberries', 'raspberries', 'blueberries'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD_AND_VESSEL,
    prep: 'whole',
  },
  {
    id: 'powdered_sugar',
    name: 'Powdered sugar',
    aliases: ['icing sugar', 'confectioners sugar'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'dusted',
  },
  {
    id: 'chocolate_shavings',
    name: 'Chocolate shavings',
    aliases: ['chocolate curls', 'shaved chocolate'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'shavings',
  },
  {
    id: 'mint_sprig',
    name: 'Mint sprig',
    aliases: ['mint sprig garnish'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'sprig',
  },
  {
    id: 'lemon_zest',
    name: 'Lemon zest',
    aliases: ['fresh lemon zest', 'lemon zest garnish'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'fine-chop',
  },
  {
    id: 'pistachio_crumbs',
    name: 'Pistachio crumbs',
    aliases: ['crushed pistachios', 'chopped pistachios'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'crushed',
  },
  {
    id: 'chocolate_drizzle',
    name: 'Chocolate drizzle',
    aliases: ['chocolate sauce drizzle', 'chocolate zigzag'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD_AND_VESSEL,
    prep: 'drizzle',
  },
  {
    id: 'berry_coulis',
    name: 'Berry coulis',
    aliases: ['berry sauce', 'fruit coulis'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_VESSEL,
    prep: 'drizzle',
  },
  {
    id: 'cream_swirl',
    name: 'Cream swirl',
    aliases: ['cream quenelle', 'whipped cream swirl'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_VESSEL,
    prep: 'swirl',
  },
  {
    id: 'lemon_drizzle',
    name: 'Lemon drizzle',
    aliases: ['lemon glaze', 'lemon icing drizzle'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD_AND_VESSEL,
    prep: 'drizzle',
  },
  {
    id: 'chopped_pecans',
    name: 'Chopped pecans',
    aliases: ['pecans', 'pecan pieces', 'chopped pecan'],
    family: 'cake',
    schemaField: 'garnishes',
    placements: ON_FOOD,
    prep: 'crushed',
  },
]
