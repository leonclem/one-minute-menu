import type { StateDelta } from '@/lib/photo-control/minimal-schema'
import { harmonizeTabletopLanguage } from '@/lib/studio/tabletop-language'
import {
  DEFAULT_FINISHING_TOUCH_AMOUNT,
  finishingTouchesRule,
  onFoodPhrase,
  scenePhrase,
  vesselPhrase,
  type FinishingTouchAmount,
} from './amount'
import {
  type FinishingTouchPlacement,
  type FinishingTouchPrep,
  getFinishingTouchByName,
} from './catalogue'

export type { FinishingTouchAmount }
export { DEFAULT_FINISHING_TOUCH_AMOUNT, finishingTouchesRule }

/** Small-amount rule. Medium and high use finishingTouchesRule. */
export const FINISHING_TOUCHES_RULE = finishingTouchesRule('small')

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
  amount: FinishingTouchAmount,
): string {
  if (placement === 'on-vessel') return vesselPhrase(form, amount)
  if (placement === 'scene') return scenePhrase(form, amount)
  return onFoodPhrase(form, amount)
}

function placementText(name: string, amount: FinishingTouchAmount): string {
  const item = getFinishingTouchByName(name)
  const placements = item?.placements ?? (['on-food', 'scene'] as const)
  const onFoodPrep = item?.prep ?? 'whole'
  const scenePrep = item?.scenePrep ?? onFoodPrep
  const phrases = placements.map((placement) =>
    placementPhrase(
      placement,
      formForPlacement(placement, onFoodPrep, scenePrep),
      amount,
    ),
  )
  return phrases.join('; ')
}

export interface FinishingTouchTarget {
  item: string
  placement: string
}

export interface FinishingTouchTargetOptions {
  surfaceChanging?: boolean
  vesselChanging?: boolean
  /** Defaults to small, which is the previous restrained wording. */
  amount?: FinishingTouchAmount
}

function harmonizeVesselLanguage(text: string, vesselChanging: boolean): string {
  if (!vesselChanging) return text
  return text.replace(/the existing plate/g, 'the vessel').replace(/existing plate/g, 'the vessel')
}

/** Placement for target.finishingTouches. The directive only points at this list. */
export function finishingTouchTargets(
  names: readonly string[],
  options?: FinishingTouchTargetOptions,
): FinishingTouchTarget[] {
  const surfaceChanging = options?.surfaceChanging ?? false
  const vesselChanging = options?.vesselChanging ?? false
  const amount = options?.amount ?? DEFAULT_FINISHING_TOUCH_AMOUNT
  return names.map((name) => ({
    item: name,
    placement: harmonizeVesselLanguage(
      harmonizeTabletopLanguage(placementText(name, amount), surfaceChanging),
      vesselChanging,
    ),
  }))
}

/**
 * Pointer only. Placement, restraint, and the prop ban live on target.
 */
export function buildFinishingTouchesAdditionClause(
  addedItems: readonly string[],
  _delta: StateDelta,
  _allowedPropLabels: readonly string[] = [],
): string {
  if (addedItems.length === 0) return ''
  return 'Add only the finishing touches in target.finishingTouches.'
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
