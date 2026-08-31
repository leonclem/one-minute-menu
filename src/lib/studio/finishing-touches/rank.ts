import {
  FINISHING_TOUCH_CATALOGUE,
  MAX_FINISHING_TOUCH_LEVEL,
  type FinishingTouchCatalogueItem,
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
): FinishingTouchCatalogueItem[] {
  return filterStackAgainstExisting(
    stackFromIds(GENERIC_FINISHING_TOUCH_STACK_IDS),
    existingNames,
  ).slice(0, MAX_FINISHING_TOUCH_LEVEL)
}

export function sanitizeRecommendedStackIds(
  rawIds: unknown,
  existingNames: readonly string[] = [],
): FinishingTouchCatalogueItem[] {
  return diagnoseRecommendedStackIds(rawIds, existingNames).stack
}

export interface RecommendedStackDiagnostics {
  stack: FinishingTouchCatalogueItem[]
  rawIds: unknown
  validIds: string[]
  droppedUnknownIds: string[]
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
): RecommendedStackDiagnostics {
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  const validStack = stackFromIds(ids)
  const filteredStack = filterStackAgainstExisting(validStack, existingNames)
  const stack = filteredStack.slice(0, MAX_FINISHING_TOUCH_LEVEL)
  const validIdSet = new Set(validStack.map((item) => item.id))
  const filteredIdSet = new Set(filteredStack.map((item) => item.id))
  const droppedUnknownIds = Array.from(
    new Set(ids.filter((id) => !getFinishingTouchById(id))),
  )
  const droppedExistingIds = validStack
    .filter((item) => !filteredIdSet.has(item.id))
    .map((item) => item.id)
  const droppedOverflowIds = filteredStack
    .slice(MAX_FINISHING_TOUCH_LEVEL)
    .map((item) => item.id)
  const fallbackUsed = stack.length === 0

  return {
    stack: fallbackUsed ? fallbackFinishingTouchStack(existingNames) : stack,
    rawIds,
    validIds: ids.filter((id, index) => validIdSet.has(id) && ids.indexOf(id) === index),
    droppedUnknownIds,
    droppedExistingIds,
    droppedOverflowIds,
    fallbackUsed,
  }
}

export function catalogueIdListForPrompt(): string {
  return FINISHING_TOUCH_CATALOGUE.map((item) => `${item.id} (${item.name})`).join(', ')
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
