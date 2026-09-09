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
    return form === 'wedge' ? VESSEL_WEDGE_PHRASE : VESSEL_PHRASE
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
