import { fetchJsonWithRetry } from '@/lib/retry'
import { parseExtractionResponse } from '@/lib/photo-control/gemini-extraction-client'
import { STUDIO_EXTRACTION_MODEL } from '@/lib/studio/model-config'
import {
  PROP_SUGGESTION_LIMIT,
  propIdListForPrompt,
  sanitizeRecommendedPropIds,
  type StudioProp,
} from '@/lib/studio/props'
import { logger } from '@/lib/logger'
import { logDevGreenText } from '@/lib/studio/prompt-logging'
import type { FinishingTouchCatalogueItem, FinishingTouchFamily } from './catalogue'
import {
  FINISHING_TOUCH_SUGGESTION_LIMIT,
  catalogueIdListForPrompt,
  diagnoseRecommendedStackIds,
  existingComponentNames,
  fallbackFinishingTouchStack,
  inferFinishingTouchFamilyFromText,
  parseRecommendFamilyFromPayload,
  parseRecommendIdsFromPayload,
  parseRecommendPropIdsFromPayload,
} from './rank'

const RECOMMEND_SYSTEM_PROMPT =
  'You rank finishing touches for a food photograph. Return only JSON with family (savory or cake), an ids array of garnish catalogue ids from that family, and a propIds array of prop catalogue ids.'

const RECOMMEND_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    family: { type: 'STRING', enum: ['savory', 'cake'] },
    ids: { type: 'ARRAY', items: { type: 'STRING' } },
    propIds: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['family', 'ids', 'propIds'],
} as const

export interface FinishingTouchRecommendation {
  family: FinishingTouchFamily
  stack: FinishingTouchCatalogueItem[]
  props: StudioProp[]
}

export interface RecommendFinishingTouchesInput {
  dishName?: string
  mainItem?: string
  garnishes?: string[]
  sides?: string[]
  description?: string
}

export type RecommendFetchJson = <T>(
  url: string,
  init: RequestInit,
  options: { retries: number; baseDelayMs: number; maxDelayMs: number; timeoutMs: number },
) => Promise<T>

function parseGeminiJson(apiResponse: unknown): unknown {
  const text: unknown =
    (apiResponse as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> })
      ?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text === 'string') {
    return parseExtractionResponse(text)
  }
  return parseExtractionResponse(apiResponse)
}

function fallbackStackForInput(
  input: RecommendFinishingTouchesInput,
  existing: readonly string[],
): FinishingTouchCatalogueItem[] {
  return fallbackFinishingTouchStack(
    existing,
    inferFinishingTouchFamilyFromText(input),
  )
}

export function buildFinishingTouchesUserPrompt(
  input: RecommendFinishingTouchesInput,
): string {
  const existing = existingComponentNames(input)
  return [
    input.dishName?.trim()
      ? `User-provided dish name: ${input.dishName.trim()}.`
      : '',
    `Visual identification: ${input.mainItem?.trim() || 'unknown food dish'}.`,
    input.description?.trim()
      ? `Original photograph analysis: ${input.description.trim()}`
      : '',
    input.description?.trim()
      ? 'This analysis describes the original photograph. Treat garnishes mentioned there as evidence of culinary compatibility, not as proof they remain on the current variant.'
      : '',
    existing.length > 0
      ? `Currently present on this variant: ${existing.join(', ')}.`
      : 'The current variant has no listed garnishes or sides.',
    'Return family as "savory" or "cake", plus catalogue ids from that family in best-first order.',
    'Dessert bakes are family cake, including cake, cheesecake, cupcake, pie, brownie, cookie, gateau, torte, pavlova, and banana bread. Chocolate, caramel, or a fruit tart also means family cake. A savoury tart, such as tomato or onion, is family savory.',
    'Crab cakes, fish cakes, corn cakes, rice cakes, potato cakes, shepherd\'s pie, cottage pie, pot pie, meat pie, and anything uncertain are family savory.',
    `Recommend up to ${FINISHING_TOUCH_SUGGESTION_LIMIT} ids from the chosen family, best-first. Return fewer when a garnish is not genuinely appropriate.`,
    'When family is cake, choose only from cake ids. When family is savory, choose only from savory ids.',
    'Prioritize culinary authenticity for the identified dish and cuisine over generic visual decoration.',
    'Do not repeat items currently present on this variant. Original-photo garnishes may be recommended when absent from the current variant. Do not invent ids.',
    `Also return propIds: up to ${PROP_SUGGESTION_LIMIT} prop ids that belong on the table beside this dish, best-first. When family is cake, choose only props marked cake or any. When family is savory, choose only props marked savory or any. Do not invent prop ids.`,
    `Savory ids: ${catalogueIdListForPrompt('savory')}.`,
    `Cake ids: ${catalogueIdListForPrompt('cake')}.`,
    `Props: ${propIdListForPrompt()}.`,
  ]
    .filter(Boolean)
    .join(' ')
}

export async function recommendFinishingTouches(
  input: RecommendFinishingTouchesInput,
  deps?: { fetchJson?: RecommendFetchJson; apiKey?: string },
): Promise<FinishingTouchRecommendation> {
  const existing = existingComponentNames(input)
  const apiKey = deps?.apiKey ?? process.env.NANO_BANANA_API_KEY ?? ''
  const userPrompt = buildFinishingTouchesUserPrompt(input)
  if (!apiKey) {
    const family = inferFinishingTouchFamilyFromText(input)
    const stack = fallbackStackForInput(input, existing)
    if (process.env.NODE_ENV === 'development') {
      logDevGreenText(userPrompt)
      logger.debug('🔎 [Finishing Touches] Recommendation diagnostics', {
        systemPrompt: RECOMMEND_SYSTEM_PROMPT,
        existingNames: existing,
        rawGeminiResponse: null,
        rawIds: null,
        validIds: [],
        droppedUnknownIds: [],
        droppedExistingIds: [],
        droppedOverflowIds: [],
        fallbackUsed: true,
        fallbackReason: 'missing_api_key',
        finalIds: stack.map((item) => item.id),
        finalPropIds: [],
      })
    }
    return { family, stack, props: [] }
  }

  const fetchJson = deps?.fetchJson ?? fetchJsonWithRetry
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${STUDIO_EXTRACTION_MODEL}:generateContent`,
  )
  url.searchParams.set('key', apiKey)

  try {
    const apiResponse = await fetchJson<unknown>(
      url.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'OneMinuteMenu/1.0',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: RECOMMEND_SYSTEM_PROMPT,
              },
            ],
          },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseModalities: ['TEXT'],
            responseMimeType: 'application/json',
            responseSchema: RECOMMEND_RESPONSE_SCHEMA,
            temperature: 0,
            thinkingConfig: { thinkingBudget: 512 },
          },
        }),
      },
      { retries: 1, baseDelayMs: 400, maxDelayMs: 2000, timeoutMs: 15000 },
    )
    const payload = parseGeminiJson(apiResponse)
    const diagnostics = diagnoseRecommendedStackIds(
      parseRecommendIdsFromPayload(payload),
      existing,
      parseRecommendFamilyFromPayload(payload),
    )
    const props = sanitizeRecommendedPropIds(
      parseRecommendPropIdsFromPayload(payload),
      diagnostics.family,
    )
    if (process.env.NODE_ENV === 'development') {
      logDevGreenText(userPrompt)
      logger.debug('🔎 [Finishing Touches] Recommendation diagnostics', {
        systemPrompt: RECOMMEND_SYSTEM_PROMPT,
        existingNames: existing,
        rawGeminiResponse: apiResponse,
        parsedPayload: payload,
        rawIds: diagnostics.rawIds,
        family: diagnostics.family,
        validIds: diagnostics.validIds,
        droppedUnknownIds: diagnostics.droppedUnknownIds,
        droppedCrossFamilyIds: diagnostics.droppedCrossFamilyIds,
        droppedExistingIds: diagnostics.droppedExistingIds,
        droppedOverflowIds: diagnostics.droppedOverflowIds,
        fallbackUsed: diagnostics.fallbackUsed,
        fallbackReason: diagnostics.fallbackUsed ? 'no_usable_ids' : null,
        finalIds: diagnostics.stack.map((item) => item.id),
        finalPropIds: props.map((prop) => prop.id),
      })
    }
    return { family: diagnostics.family, stack: diagnostics.stack, props }
  } catch (error) {
    logger.warn('⚠️ [Finishing Touches] Recommend fell back after ranker error', { error })
    const family = inferFinishingTouchFamilyFromText(input)
    const stack = fallbackStackForInput(input, existing)
    if (process.env.NODE_ENV === 'development') {
      logDevGreenText(userPrompt)
      logger.debug('🔎 [Finishing Touches] Recommendation diagnostics', {
        systemPrompt: RECOMMEND_SYSTEM_PROMPT,
        existingNames: existing,
        rawGeminiResponse: null,
        fallbackUsed: true,
        fallbackReason: 'request_or_parse_error',
        finalIds: stack.map((item) => item.id),
        finalPropIds: [],
      })
    }
    return { family, stack, props: [] }
  }
}
