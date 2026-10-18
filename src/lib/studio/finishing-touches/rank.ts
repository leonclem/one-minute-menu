import {
  MAX_FINISHING_TOUCH_LEVEL,
  type FinishingTouchCatalogueItem,
  type FinishingTouchFamily,
  catalogueItemsForFamily,
  finishingTouchFamily,
  finishingTouchLabels,
  getFinishingTouchById,
  getFinishingTouchByName,
  normalizeFinishingTouchLabel,
  stackFromIds,
} from './catalogue'

/** Ranked ids kept for the chip list. The UI shows them in pages of four. */
export const FINISHING_TOUCH_SUGGESTION_LIMIT = 12

/** Conservative stack when ranking is empty or the dish is unknown. */
export const GENERIC_FINISHING_TOUCH_STACK_IDS = [
  'coriander',
  'lime_wedge',
  'red_chilli',
  'sesame_seeds',
] as const

/** Cake-only fallback. Never used for savoury dishes. */
export const GENERIC_CAKE_FINISHING_TOUCH_STACK_IDS = [
  'fresh_berries',
  'powdered_sugar',
  'chocolate_shavings',
  'mint_sprig',
] as const

const SAVORY_CAKE_RE =
  /\b(crab|fish|salmon|tuna|cod|corn|rice|potato)\s*-?\s*cakes?\b|\b(crabcake|fishcake)s?\b/i
const SAVORY_PIE_RE =
  /\b(shepherd'?s|cottage|pot|meat|fish|chicken|steak)\s+pies?\b/i
/** Whole words only, so "caramelized onions" stays savoury. */
const SWEET_SIGNAL_RE = /\b(chocolates?|caramels?)\b/i
const TART_RE = /\btarts?\b/i
const DESSERT_FRUIT_RE =
  /\b(apples?|lemons?|limes?|oranges?|berr(?:y|ies)|strawberr(?:y|ies)|raspberr(?:y|ies)|blueberr(?:y|ies)|blackberr(?:y|ies)|cherr(?:y|ies)|pears?|peach(?:es)?|plums?|apricots?|figs?|bananas?|mango(?:es|s)?|pineapples?|passion\s*fruits?|rhubarbs?|quinces?|grapes?|kiwis?|coconuts?|melons?|nectarines?|cranberr(?:y|ies)|gooseberr(?:y|ies)|currants?|pomegranates?|fruits?)\b/i
const DESSERT_CAKE_RE =
  /\b(cupcakes?|cheesecakes?|gateaux|gateau|gâteau|tortes?|pies?|brownies?|blondies?|cookies?|doughnuts?|donuts?|eclairs?|profiteroles?|pavlovas?|tiramisu|macarons?|baklava|cannoli|gelato|ice\s*cream|mousses?|parfaits?|crumbles?|cobblers?|shortcakes?|birthday\s+cake|layer\s+cake|sponge\s+cake|bundt|banana\s+bread|loaf\s+cake)\b|\bcakes?\b/i

export function existingComponentNames(input: {
  garnishes?: readonly string[]
  sides?: readonly string[]
}): string[] {
  return [...(input.garnishes ?? []), ...(input.sides ?? [])].filter(
    (name) => name.trim().length > 0,
  )
}

export function presentFinishingTouchIds(names: readonly string[]): Set<string> {
  const ids = new Set<string>()
  for (const name of names) {
    const item = getFinishingTouchByName(name)
    if (item) ids.add(item.id)
  }
  return ids
}

export function filterStackAgainstExisting(
  stack: readonly FinishingTouchCatalogueItem[],
  existingNames: readonly string[],
): FinishingTouchCatalogueItem[] {
  const present = presentFinishingTouchIds(existingNames)
  const presentLabels = new Set(
    existingNames.map(normalizeFinishingTouchLabel),
  )
  return stack.filter((item) => {
    if (present.has(item.id)) return false
    return !finishingTouchLabels(item).some((label) =>
      presentLabels.has(normalizeFinishingTouchLabel(label)),
    )
  })
}

export function fallbackFinishingTouchStack(
  existingNames: readonly string[] = [],
  family: FinishingTouchFamily = 'savory',
): FinishingTouchCatalogueItem[] {
  const ids =
    family === 'cake'
      ? GENERIC_CAKE_FINISHING_TOUCH_STACK_IDS
      : GENERIC_FINISHING_TOUCH_STACK_IDS
  return filterStackAgainstExisting(stackFromIds(ids), existingNames).slice(
    0,
    MAX_FINISHING_TOUCH_LEVEL,
  )
}

/**
 * Keyword assist used before a rank exists, and again if ranking fails.
 * A tart is not enough on its own. Chocolate, caramel, or a fruit with the tart marks it as a dessert.
 * Crab/fish/corn/rice/potato cakes and savoury pies stay savoury.
 * Once Gemini returns a family, that result replaces this guess.
 */
export function inferFinishingTouchFamilyFromText(input: {
  dishName?: string
  mainItem?: string
  description?: string
}): FinishingTouchFamily {
  const text = [input.dishName, input.mainItem, input.description]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
  if (!text) return 'savory'
  if (SAVORY_CAKE_RE.test(text)) return 'savory'
  if (SAVORY_PIE_RE.test(text)) return 'savory'
  if (SWEET_SIGNAL_RE.test(text)) return 'cake'
  if (TART_RE.test(text) && DESSERT_FRUIT_RE.test(text)) return 'cake'
  if (DESSERT_CAKE_RE.test(text)) return 'cake'
  return 'savory'
}

export function sanitizeRecommendedStackIds(
  rawIds: unknown,
  existingNames: readonly string[] = [],
  family: FinishingTouchFamily = 'savory',
): FinishingTouchCatalogueItem[] {
  return diagnoseRecommendedStackIds(rawIds, existingNames, family).stack
}

export interface RecommendedStackDiagnostics {
  stack: FinishingTouchCatalogueItem[]
  rawIds: unknown
  family: FinishingTouchFamily
  validIds: string[]
  droppedUnknownIds: string[]
  droppedCrossFamilyIds: string[]
  droppedExistingIds: string[]
  droppedOverflowIds: string[]
  fallbackUsed: boolean
}

/**
 * Apply the production ranking rules while exposing each processing step.
 * This powers development diagnostics; `sanitizeRecommendedStackIds` remains
 * the behaviour-preserving public convenience wrapper.
 */
export function diagnoseRecommendedStackIds(
  rawIds: unknown,
  existingNames: readonly string[] = [],
  family: FinishingTouchFamily = 'savory',
): RecommendedStackDiagnostics {
  const resolvedFamily: FinishingTouchFamily = family === 'cake' ? 'cake' : 'savory'
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  const resolvedStack = stackFromIds(ids)
  const familyStack = resolvedStack.filter(
    (item) => finishingTouchFamily(item) === resolvedFamily,
  )
  const droppedCrossFamilyIds = resolvedStack
    .filter((item) => finishingTouchFamily(item) !== resolvedFamily)
    .map((item) => item.id)
  const filteredStack = filterStackAgainstExisting(familyStack, existingNames)
  const rankedStack = filteredStack.slice(0, FINISHING_TOUCH_SUGGESTION_LIMIT)
  const familyIdSet = new Set(familyStack.map((item) => item.id))
  const filteredIdSet = new Set(filteredStack.map((item) => item.id))
  const droppedUnknownIds = Array.from(
    new Set(ids.filter((id) => !getFinishingTouchById(id))),
  )
  const droppedExistingIds = familyStack
    .filter((item) => !filteredIdSet.has(item.id))
    .map((item) => item.id)
  const droppedOverflowIds = filteredStack
    .slice(FINISHING_TOUCH_SUGGESTION_LIMIT)
    .map((item) => item.id)
  const fallbackUsed = rankedStack.length === 0
  const stack = fallbackUsed
    ? fallbackFinishingTouchStack(existingNames, resolvedFamily)
    : rankedStack

  return {
    stack,
    rawIds,
    family: resolvedFamily,
    validIds: ids.filter((id, index) => familyIdSet.has(id) && ids.indexOf(id) === index),
    droppedUnknownIds,
    droppedCrossFamilyIds,
    droppedExistingIds,
    droppedOverflowIds,
    fallbackUsed,
  }
}

export function catalogueIdListForPrompt(family: FinishingTouchFamily): string {
  return catalogueItemsForFamily(family)
    .map((item) => `${item.id} (${item.name})`)
    .join(', ')
}

export function parseRecommendFamilyFromPayload(payload: unknown): FinishingTouchFamily {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'savory'
  }
  return (payload as Record<string, unknown>).family === 'cake' ? 'cake' : 'savory'
}

function payloadRecord(payload: unknown): Record<string, unknown> | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }
  return payload as Record<string, unknown>
}

export function parseRecommendIdsFromPayload(payload: unknown): unknown {
  const record = payloadRecord(payload)
  if (!record) return []
  if (Array.isArray(record.ids)) return record.ids
  if (Array.isArray(record.stackIds)) return record.stackIds
  return []
}

export function parseRecommendPropIdsFromPayload(payload: unknown): unknown {
  const record = payloadRecord(payload)
  if (!record || !Array.isArray(record.propIds)) return []
  return record.propIds
}

export { getFinishingTouchById }
