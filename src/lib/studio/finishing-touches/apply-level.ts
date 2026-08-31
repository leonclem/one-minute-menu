import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  DEFAULT_FINISHING_TOUCH_LEVEL,
  MAX_FINISHING_TOUCH_LEVEL,
  type FinishingTouchCatalogueItem,
  getFinishingTouchByName,
  finishingTouchLabels,
  normalizeFinishingTouchLabel,
} from './catalogue'

export function cloneMinimalSchema(schema: MinimalSchema): MinimalSchema {
  return {
    scene_setup: { ...schema.scene_setup },
    canvas: { ...schema.canvas },
    food_components: {
      main_item: schema.food_components.main_item,
      garnishes: [...schema.food_components.garnishes],
      sides: [...schema.food_components.sides],
    },
  }
}

export function clampFinishingTouchLevel(level: number, stackLength: number): number {
  if (stackLength <= 0) return 0
  if (!Number.isFinite(level)) return Math.min(DEFAULT_FINISHING_TOUCH_LEVEL, stackLength)
  return Math.min(MAX_FINISHING_TOUCH_LEVEL, stackLength, Math.max(1, Math.round(level)))
}

function labelsForItem(item: FinishingTouchCatalogueItem): Set<string> {
  return new Set(finishingTouchLabels(item).map(normalizeFinishingTouchLabel))
}

function presentAliasSet(names: readonly string[]): Set<string> {
  const present = new Set<string>()
  for (const name of names) {
    present.add(normalizeFinishingTouchLabel(name))
    const item = getFinishingTouchByName(name)
    if (!item) continue
    for (const label of finishingTouchLabels(item)) {
      present.add(normalizeFinishingTouchLabel(label))
    }
  }
  return present
}

function itemIsPresent(
  item: FinishingTouchCatalogueItem,
  present: Set<string>,
): boolean {
  for (const label of Array.from(labelsForItem(item))) {
    if (present.has(label)) return true
  }
  return false
}

function isFinishingTouchAdd(
  name: string,
  baselineNames: Set<string>,
  stack: readonly FinishingTouchCatalogueItem[],
): boolean {
  const normalized = normalizeFinishingTouchLabel(name)
  if (baselineNames.has(normalized)) return false
  const matched = getFinishingTouchByName(name)
  if (!matched) {
    return stack.some((item) => labelsForItem(item).has(normalized))
  }
  return stack.some((item) => item.id === matched.id)
}

export interface ApplyFinishingTouchesLevelInput {
  baseline: MinimalSchema
  current?: MinimalSchema
  stack: readonly FinishingTouchCatalogueItem[]
  level: number
}

/**
 * Append the first `level` stack items onto the current extract JSON.
 * Previously staged finishing-touch names are replaced; extract garnishes stay
 * unless the user already removed them from `current`.
 *
 * Studio applies this at Generate time. The live Elements list should keep
 * `current` as the extract (minus removals) so staged additions do not appear
 * as removable items.
 */
export function applyFinishingTouchesLevel(
  input: ApplyFinishingTouchesLevelInput,
): MinimalSchema {
  const current = input.current ?? input.baseline
  const next = cloneMinimalSchema(current)
  const baselineGarnishes = presentAliasSet(input.baseline.food_components.garnishes)
  const baselineSides = presentAliasSet(input.baseline.food_components.sides)

  next.food_components.garnishes = current.food_components.garnishes.filter(
    (name) => !isFinishingTouchAdd(name, baselineGarnishes, input.stack),
  )
  next.food_components.sides = current.food_components.sides.filter(
    (name) => !isFinishingTouchAdd(name, baselineSides, input.stack),
  )

  const present = presentAliasSet([
    ...next.food_components.garnishes,
    ...next.food_components.sides,
  ])
  const targetCount = clampFinishingTouchLevel(input.level, input.stack.length)
  let added = 0
  for (const item of input.stack) {
    if (added >= targetCount) break
    if (itemIsPresent(item, present)) continue
    next.food_components[item.schemaField].push(item.name)
    for (const label of Array.from(labelsForItem(item))) present.add(label)
    added += 1
  }

  return next
}

export interface FinishingTouchLevelOption {
  level: number
  label: string
  ids: string[]
}

export function finishingTouchLevelOptions(
  stack: readonly FinishingTouchCatalogueItem[],
): FinishingTouchLevelOption[] {
  const limit = Math.min(MAX_FINISHING_TOUCH_LEVEL, stack.length)
  const options: FinishingTouchLevelOption[] = []
  for (let level = 1; level <= limit; level += 1) {
    const slice = stack.slice(0, level)
    options.push({
      level,
      label: slice.map((item) => item.name).join(', '),
      ids: slice.map((item) => item.id),
    })
  }
  return options
}
