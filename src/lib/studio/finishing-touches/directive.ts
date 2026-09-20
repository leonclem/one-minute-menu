import type { StateDelta } from '@/lib/photo-control/minimal-schema'
import {
  type FinishingTouchPlacement,
  type FinishingTouchPrep,
  getFinishingTouchByName,
} from './catalogue'

const VESSEL_PHRASE =
  'on or beside the vessel rim, without covering the main dish'

const VESSEL_WEDGE_PHRASE =
  'as a small wedge on or beside the vessel rim, without covering the main dish'

const VESSEL_WHOLE_PHRASE =
  'a few pieces on the existing plate beside the dish, without covering it'

const VESSEL_DRIZZLE_PHRASE =
  'as a thin drizzle or a few dots on the existing plate, not a pool, flood, or sauce jug'

const VESSEL_SWIRL_PHRASE =
  'as one swirl or quenelle on the existing plate beside the dish, without covering it'

const SCENE_SCATTER_MATCHING =
  'a few matching pieces lightly scattered on the existing tabletop around the vessel'

const SCENE_SCATTER_CHUNKIER =
  'a few larger, more recognizable pieces lightly scattered on the existing tabletop around the vessel — these table pieces may be chunkier than the garnish on the food'

const SCENE_SCATTER_SPRIG =
  'a small whole sprig or bunch, or a few larger recognizable pieces, lightly scattered on the existing tabletop around the vessel — these table pieces may be chunkier than the garnish on the food'

const SCENE_BY_PREP: Record<FinishingTouchPrep, string> = {
  chopped: SCENE_SCATTER_SPRIG,
  leaves: SCENE_SCATTER_SPRIG,
  sliced: SCENE_SCATTER_CHUNKIER,
  whole: SCENE_SCATTER_MATCHING,
  halved: 'one matching half on the existing tabletop around the vessel',
  intact: 'one whole matching piece on the existing tabletop around the vessel',
  wedge: 'one small wedge on the existing tabletop around the vessel',
  'fine-chop': SCENE_SCATTER_CHUNKIER,
  crushed: SCENE_SCATTER_CHUNKIER,
  sprig: SCENE_SCATTER_SPRIG,
  'whole-scatter':
    'a few whole pieces lightly scattered on the existing tabletop around the vessel — these table pieces should be whole, not chopped',
  dusted: SCENE_SCATTER_MATCHING,
  shavings: SCENE_SCATTER_MATCHING,
  drizzle: SCENE_SCATTER_MATCHING,
  swirl: SCENE_SCATTER_MATCHING,
}

const ON_FOOD_BY_PREP: Record<FinishingTouchPrep, string> = {
  chopped:
    'finely chopped on the food as the edible garnish, with at most one small whole sprig as a plating accent (not a large bunch covering the dish)',
  sliced:
    'thinly sliced on the food (fine rings or slivers, not thick chunks)',
  leaves:
    'as small leaves, or at most one light sprig, on the food — not a large clump or bouquet',
  whole: 'on the food',
  halved:
    'as fruit cut cleanly in half, cut-side up — not wedges, slices, or wheels',
  intact: 'as a whole intact piece on the food, not sliced or chopped',
  wedge: 'as a small wedge on the food, not a full half',
  'fine-chop': 'finely chopped on the food into small pieces, not left whole',
  crushed: 'roughly chopped or crushed on the food, not left whole',
  sprig:
    'as small leaves, or at most one light sprig, on the food — not a large clump or bouquet',
  'whole-scatter': 'on the food',
  dusted:
    'as a light dusting on the food — do not bury or fully coat the cake',
  shavings: 'as a small amount of shavings on the food, not a mound',
  drizzle:
    'as a thin zigzag drizzle on the food, not a flood, and do not add a sauce jug',
  swirl: 'as one small swirl on the food, not a covering',
}

function formForPlacement(
  placement: FinishingTouchPlacement,
  onFoodPrep: FinishingTouchPrep,
  scenePrep: FinishingTouchPrep,
): FinishingTouchPrep {
  return placement === 'scene' ? scenePrep : onFoodPrep
}

function placementPhrase(
  placement: FinishingTouchPlacement,
  form: FinishingTouchPrep,
): string {
  if (placement === 'on-vessel') {
    if (form === 'wedge') return VESSEL_WEDGE_PHRASE
    if (form === 'whole') return VESSEL_WHOLE_PHRASE
    if (form === 'drizzle') return VESSEL_DRIZZLE_PHRASE
    if (form === 'swirl') return VESSEL_SWIRL_PHRASE
    return VESSEL_PHRASE
  }
  if (placement === 'scene') return SCENE_BY_PREP[form]
  return ON_FOOD_BY_PREP[form]
}

function quoteList(items: readonly string[]): string {
  const quoted = items.map((item) => `"${item}"`)
  if (quoted.length === 1) return quoted[0]
  if (quoted.length === 2) return `${quoted[0]} and ${quoted[1]}`
  return `${quoted.slice(0, -1).join(', ')}, and ${quoted[quoted.length - 1]}`
}

function placementLine(name: string): string {
  const item = getFinishingTouchByName(name)
  const placements = item?.placements ?? (['on-food', 'scene'] as const)
  const onFoodPrep = item?.prep ?? 'whole'
  const scenePrep = item?.scenePrep ?? onFoodPrep
  const phrases = placements.map((placement) =>
    placementPhrase(placement, formForPlacement(placement, onFoodPrep, scenePrep)),
  )
  return `- ${name}: ${phrases.join('; ')}.`
}

function scalarChanged(delta: StateDelta, path: string): boolean {
  return delta.scalarChanges.some((change) => change.path === path)
}

/**
 * Single bundled addition clause for garnish/side adds.
 * Table scatter is prompt-only. Extra bowls and props are forbidden.
 */
export function buildFinishingTouchesAdditionClause(
  addedItems: readonly string[],
  delta: StateDelta,
): string {
  if (addedItems.length === 0) return ''

  const locks: string[] = [
    'Do not add extra bowls, serving dishes, cutlery, napkins, glasses, ramekins, or unrelated props.',
    'Do not change the dish, plating, vessel shape, crop, or camera.',
    'Place items naturally and irregularly, not in a grid, and keep quantities restrained.',
  ]
  if (!scalarChanged(delta, 'scene_setup.lighting')) {
    locks.push('Keep the existing lighting unchanged.')
  }
  if (!scalarChanged(delta, 'canvas.surface_style')) {
    locks.push('Keep the existing tabletop surface, its colour, and texture unchanged.')
  }
  if (!scalarChanged(delta, 'canvas.background_style')) {
    locks.push('Keep the existing backdrop unchanged.')
  }

  return (
    `Add only these named finishing touches: ${quoteList(addedItems)}. ` +
    `Place each item as follows:\n${addedItems.map(placementLine).join('\n')} ` +
    locks.join(' ')
  )
}

const DRIZZLE_SWIRL_REMOVAL_FILL =
  'Restore the cake or plate surface underneath; do not leave a hole or repaint the dish.'

const DEFAULT_REMOVAL_FILL =
  'Fill the vacant space naturally with the matching underlying background texture.'

/** Prompt-only fill language after a named garnish/side is removed. */
export function finishingTouchRemovalFillPhrase(name: string): string {
  const item = getFinishingTouchByName(name)
  if (item?.prep === 'drizzle' || item?.prep === 'swirl') {
    return DRIZZLE_SWIRL_REMOVAL_FILL
  }
  return DEFAULT_REMOVAL_FILL
}
