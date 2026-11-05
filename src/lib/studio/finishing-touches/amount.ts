import type { FinishingTouchPrep } from './catalogue'

/** Prompt density for a finishing-touch generate. Schema names stay unchanged. */
export type FinishingTouchAmount = 'small' | 'medium' | 'high'

export const DEFAULT_FINISHING_TOUCH_AMOUNT: FinishingTouchAmount = 'small'

export const FINISHING_TOUCH_AMOUNT_ORDER: readonly FinishingTouchAmount[] = [
  'small',
  'medium',
  'high',
]

const AMOUNT_ORDER = new Set<string>(FINISHING_TOUCH_AMOUNT_ORDER)

export function isFinishingTouchAmount(value: unknown): value is FinishingTouchAmount {
  return typeof value === 'string' && AMOUNT_ORDER.has(value)
}

type PhraseSet = Record<FinishingTouchAmount, string>

function phrases(small: string, medium: string, high: string): PhraseSet {
  return { small, medium, high }
}

const ON_FOOD: Record<FinishingTouchPrep, PhraseSet> = {
  chopped: phrases(
    'finely chopped on the food as the edible garnish, with at most one small whole sprig as a plating accent (not a large bunch covering the dish)',
    'finely chopped across the food as a clearly visible garnish, with one or two small sprigs as plating accents, not a bouquet covering the dish',
    'a generous scatter of finely chopped garnish across the food, with a few small sprigs as plating accents, leaving the dish still recognizable',
  ),
  sliced: phrases(
    'thinly sliced on the food (fine rings or slivers, not thick chunks)',
    'several thin slices on the food (fine rings or slivers, not thick chunks)',
    'a generous layer of thin slices on the food (fine rings or slivers, not thick chunks), leaving the dish still visible',
  ),
  leaves: phrases(
    'as small leaves, or at most one light sprig, on the food — not a large clump or bouquet',
    'as a clearly visible scatter of leaves, or two light sprigs, on the food, not a large clump or bouquet',
    'as a generous scatter of leaves and a few light sprigs on the food, leaving the dish still recognizable',
  ),
  whole: phrases(
    'on the food',
    'as a clearly visible amount on the food, not a heap',
    'as a generous amount on the food, leaving the dish still recognizable',
  ),
  halved: phrases(
    'as fruit cut cleanly in half, cut-side up — not wedges, slices, or wheels',
    'as two or three pieces of fruit cut cleanly in half, cut-side up, not wedges, slices, or wheels',
    'as several pieces of fruit cut cleanly in half, cut-side up, not wedges, slices, or wheels, and not covering the dish',
  ),
  intact: phrases(
    'as a whole intact piece on the food, not sliced or chopped',
    'as two or three whole intact pieces on the food, not sliced or chopped',
    'as several whole intact pieces on the food, not sliced or chopped, leaving the dish still recognizable',
  ),
  wedge: phrases(
    'as a small wedge on the food, not a full half',
    'as two or three small wedges on the food, not full halves',
    'as several small wedges on the food, not full halves, leaving the dish still recognizable',
  ),
  'fine-chop': phrases(
    'finely chopped on the food into small pieces, not left whole',
    'a clearly visible scatter of finely chopped pieces on the food, not left whole',
    'a generous scatter of finely chopped pieces across the food, not left whole, leaving the dish still recognizable',
  ),
  crushed: phrases(
    'roughly chopped or crushed on the food, not left whole',
    'a clearly visible scatter of roughly chopped or crushed pieces on the food, not left whole',
    'a generous scatter of roughly chopped or crushed pieces across the food, not left whole, leaving the dish still recognizable',
  ),
  sprig: phrases(
    'as small leaves, or at most one light sprig, on the food — not a large clump or bouquet',
    'as a few leaves and one or two light sprigs on the food, not a large clump or bouquet',
    'as a generous cluster of leaves and a few light sprigs on the food, leaving the dish still recognizable',
  ),
  'whole-scatter': phrases(
    'on the food',
    'as a clearly visible amount on the food, not a heap',
    'as a generous amount on the food, leaving the dish still recognizable',
  ),
  dusted: phrases(
    'as a light dusting on the food — do not bury or fully coat the food',
    'as a clearly visible dusting on the food. Do not bury or fully coat the food',
    'as a generous dusting across the food. Do not bury or fully coat the food',
  ),
  shavings: phrases(
    'as a small amount of shavings on the food, not a mound',
    'as a clearly visible amount of shavings on the food, not a mound',
    'as a generous amount of shavings across the food, not a mound that hides it',
  ),
  drizzle: phrases(
    'as a thin zigzag drizzle on the food, not a flood, and do not add a sauce jug',
    'as a few thin zigzag drizzles on the food, not a flood, and do not add a sauce jug',
    'as several thin zigzag drizzles across the food, still not a flood or a sauce jug',
  ),
  swirl: phrases(
    'as one small swirl on the food, not a covering',
    'as one clearly visible swirl on the food, not a covering',
    'as one generous swirl on the food, not a covering that hides it',
  ),
}

const SCENE_MATCHING = phrases(
  'a few matching pieces lightly scattered on the existing tabletop around the vessel',
  'a clearly visible scatter of matching pieces on the existing tabletop around the vessel',
  'a generous scatter of matching pieces on the existing tabletop around the vessel, still sparse enough to see the table',
)

const SCENE_CHUNKIER = phrases(
  'a few larger, more recognizable pieces lightly scattered on the existing tabletop around the vessel — these table pieces may be chunkier than the garnish on the food',
  'several larger, more recognizable pieces scattered on the existing tabletop around the vessel. These table pieces may be chunkier than the garnish on the food',
  'a generous scatter of larger, more recognizable pieces on the existing tabletop around the vessel, without hiding the table. These table pieces may be chunkier than the garnish on the food',
)

const SCENE_SPRIG = phrases(
  'a small whole sprig or bunch, or a few larger recognizable pieces, lightly scattered on the existing tabletop around the vessel — these table pieces may be chunkier than the garnish on the food',
  'a couple of small whole sprigs or bunches, or several larger recognizable pieces, scattered on the existing tabletop around the vessel. These table pieces may be chunkier than the garnish on the food',
  'a few small whole sprigs or bunches, or a generous scatter of larger recognizable pieces, on the existing tabletop around the vessel, without hiding the table. These table pieces may be chunkier than the garnish on the food',
)

const SCENE: Record<FinishingTouchPrep, PhraseSet> = {
  chopped: SCENE_SPRIG,
  leaves: SCENE_SPRIG,
  sliced: SCENE_CHUNKIER,
  whole: SCENE_MATCHING,
  halved: phrases(
    'one matching half on the existing tabletop around the vessel',
    'one or two matching halves on the existing tabletop around the vessel',
    'two or three matching halves on the existing tabletop around the vessel',
  ),
  intact: phrases(
    'one whole matching piece on the existing tabletop around the vessel',
    'one or two whole matching pieces on the existing tabletop around the vessel',
    'two or three whole matching pieces on the existing tabletop around the vessel',
  ),
  wedge: phrases(
    'one small wedge on the existing tabletop around the vessel',
    'one or two small wedges on the existing tabletop around the vessel',
    'two or three small wedges on the existing tabletop around the vessel',
  ),
  'fine-chop': SCENE_CHUNKIER,
  crushed: SCENE_CHUNKIER,
  sprig: SCENE_SPRIG,
  'whole-scatter': phrases(
    'a few whole pieces lightly scattered on the existing tabletop around the vessel — these table pieces should be whole, not chopped',
    'several whole pieces scattered on the existing tabletop around the vessel. These table pieces should be whole, not chopped',
    'a generous scatter of whole pieces on the existing tabletop around the vessel, without hiding the table. These table pieces should be whole, not chopped',
  ),
  dusted: SCENE_MATCHING,
  shavings: SCENE_MATCHING,
  drizzle: SCENE_MATCHING,
  swirl: SCENE_MATCHING,
}

const VESSEL_DEFAULT = phrases(
  'on or beside the vessel rim, without covering the main dish',
  'as a clearly visible accent on or beside the vessel rim, without covering the main dish',
  'as a generous accent on or beside the vessel rim, without covering the main dish',
)

const VESSEL_BY_FORM: Partial<Record<FinishingTouchPrep, PhraseSet>> = {
  wedge: phrases(
    'as a small wedge on or beside the vessel rim, without covering the main dish',
    'as one or two small wedges on or beside the vessel rim, without covering the main dish',
    'as two or three small wedges on or beside the vessel rim, without covering the main dish',
  ),
  whole: phrases(
    'a few pieces on the existing plate beside the dish, without covering it',
    'several pieces on the existing plate beside the dish, without covering it',
    'a generous cluster of pieces on the existing plate beside the dish, without covering it',
  ),
  drizzle: phrases(
    'as a thin drizzle or a few dots on the existing plate, not a pool, flood, or sauce jug',
    'as a few thin drizzles or several dots on the existing plate, not a pool, flood, or sauce jug',
    'as several thin drizzles or a clear scatter of dots on the existing plate, not a pool, flood, or sauce jug',
  ),
  swirl: phrases(
    'as one swirl or quenelle on the existing plate beside the dish, without covering it',
    'as one clearly visible swirl or quenelle on the existing plate beside the dish, without covering it',
    'as one generous swirl or quenelle on the existing plate beside the dish, without covering it',
  ),
}

export function onFoodPhrase(prep: FinishingTouchPrep, amount: FinishingTouchAmount): string {
  return ON_FOOD[prep][amount]
}

export function scenePhrase(prep: FinishingTouchPrep, amount: FinishingTouchAmount): string {
  return SCENE[prep][amount]
}

export function vesselPhrase(prep: FinishingTouchPrep, amount: FinishingTouchAmount): string {
  return (VESSEL_BY_FORM[prep] ?? VESSEL_DEFAULT)[amount]
}

export function finishingTouchesRule(amount: FinishingTouchAmount = 'small'): string {
  const quantity =
    amount === 'high'
      ? 'use a generous, obvious amount of each item without burying the dish'
      : amount === 'medium'
        ? 'use a clearly visible medium amount of each item'
        : 'keep quantities restrained'
  return `Place items naturally and irregularly, not in a grid, and ${quantity}. Do not add bowls, cutlery, napkins, glasses, or ramekins beyond target.finishingTouches and target.props.`
}
