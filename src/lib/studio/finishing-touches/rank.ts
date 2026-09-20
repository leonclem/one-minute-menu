import {
  CAKE_FINISHING_TOUCH_CATALOGUE,
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
const DESSERT_CAKE_RE =
  /\b(cupcakes?|cheesecakes?|gateaux|gateau|gâteau|tortes?|birthday\s+cake|layer\s+cake|sponge\s+cake|bundt|banana\s+bread|loaf\s+cake)\b|\bcakes?\b/i

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

function completeCakeSuggestions(
  ranked: readonly FinishingTouchCatalogueItem[],
  existingNames: readonly string[],
): FinishingTouchCatalogueItem[] {
  const prefix = filterStackAgainstExisting(ranked, existingNames)
  const seen = new Set(prefix.map((item) => item.id))
  const rest = filterStackAgainstExisting(
    CAKE_FINISHING_TOUCH_CATALOGUE.filter((item) => !seen.has(item.id)),
    existingNames,
  )
  return [...prefix, ...rest]
}

export function fallbackFinishingTouchStack(
  existingNames: readonly string[] = [],
  family: FinishingTouchFamily = 'savory',
): FinishingTouchCatalogueItem[] {
  if (family === 'cake') {
    return completeCakeSuggestions(
      stackFromIds(GENERIC_CAKE_FINISHING_TOUCH_STACK_IDS),
      existingNames,
    )
  }
  return filterStackAgainstExisting(
    stackFromIds(GENERIC_FINISHING_TOUCH_STACK_IDS),
    existingNames,
  ).slice(0, MAX_FINISHING_TOUCH_LEVEL)
}

/**
 * Keyword assist for API failure only. Crab/fish/corn/rice/potato cakes stay
 * savoury. Primary classification is the Gemini `family` field.
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
  const suggestionLimit =
    resolvedFamily === 'cake'
      ? CAKE_FINISHING_TOUCH_CATALOGUE.length
      : MAX_FINISHING_TOUCH_LEVEL
  const rankedStack = filteredStack.slice(0, suggestionLimit)
  const familyIdSet = new Set(familyStack.map((item) => item.id))
  const filteredIdSet = new Set(filteredStack.map((item) => item.id))
  const droppedUnknownIds = Array.from(
    new Set(ids.filter((id) => !getFinishingTouchById(id))),
  )
  const droppedExistingIds = familyStack
    .filter((item) => !filteredIdSet.has(item.id))
    .map((item) => item.id)
  const droppedOverflowIds =
    resolvedFamily === 'savory'
      ? filteredStack.slice(MAX_FINISHING_TOUCH_LEVEL).map((item) => item.id)
      : []
  const fallbackUsed = rankedStack.length === 0
  const stack = fallbackUsed
    ? fallbackFinishingTouchStack(existingNames, resolvedFamily)
    : resolvedFamily === 'cake'
      ? completeCakeSuggestions(rankedStack, existingNames)
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

export function parseRecommendIdsFromPayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return []
  }
  const record = payload as Record<string, unknown>
  if (Array.isArray(record.ids)) return record.ids
  if (Array.isArray(record.stackIds)) return record.stackIds
  return []
}

export { getFinishingTouchById }
