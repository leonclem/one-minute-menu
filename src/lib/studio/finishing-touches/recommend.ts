import { fetchJsonWithRetry } from '@/lib/retry'
import { parseExtractionResponse } from '@/lib/photo-control/gemini-extraction-client'
import { STUDIO_EXTRACTION_MODEL } from '@/lib/studio/model-config'
import { logger } from '@/lib/logger'
import type { FinishingTouchCatalogueItem } from './catalogue'
import {
  catalogueIdListForPrompt,
  diagnoseRecommendedStackIds,
  existingComponentNames,
  fallbackFinishingTouchStack,
  inferFinishingTouchFamilyFromText,
  parseRecommendFamilyFromPayload,
  parseRecommendIdsFromPayload,
} from './rank'

const RECOMMEND_SYSTEM_PROMPT =
  'You rank finishing touches for a food photograph. Return only JSON with family (savory or cake) and an ids array of catalogue ids from that family.'

const RECOMMEND_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    family: { type: 'STRING', enum: ['savory', 'cake'] },
    ids: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['family', 'ids'],
} as const

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
    'Dessert cakes including cheesecake, cupcake, gateau, torte, banana bread, and other sweet bakes are family cake.',
    'Crab cakes, fish cakes, corn cakes, rice cakes, potato cakes, and anything uncertain are family savory.',
    'When family is savory, recommend up to 4 ids. When family is cake, rank every appropriate cake id; omit only ids that do not fit the dish.',
    'When family is cake, choose only from cake ids. When family is savory, choose only from savory ids.',
    'Prioritize culinary authenticity for the identified dish and cuisine over generic visual decoration.',
    'For savory, return fewer than 4 ids rather than include a garnish that is not genuinely appropriate.',
    'Do not repeat items currently present on this variant. Original-photo garnishes may be recommended when absent from the current variant. Do not invent ids.',
    `Savory ids: ${catalogueIdListForPrompt('savory')}.`,
    `Cake ids: ${catalogueIdListForPrompt('cake')}.`,
  ]
    .filter(Boolean)
    .join(' ')
}

export async function recommendFinishingTouches(
  input: RecommendFinishingTouchesInput,
  deps?: { fetchJson?: RecommendFetchJson; apiKey?: string },
): Promise<FinishingTouchCatalogueItem[]> {
  const existing = existingComponentNames(input)
  const apiKey = deps?.apiKey ?? process.env.NANO_BANANA_API_KEY ?? ''
  const userPrompt = buildFinishingTouchesUserPrompt(input)
  if (!apiKey) {
    const stack = fallbackStackForInput(input, existing)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🔎 [Finishing Touches] Recommendation diagnostics', {
        systemPrompt: RECOMMEND_SYSTEM_PROMPT,
        userPrompt,
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
      })
    }
    return stack
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
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🔎 [Finishing Touches] Recommendation diagnostics', {
        systemPrompt: RECOMMEND_SYSTEM_PROMPT,
        userPrompt,
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
      })
    }
    return diagnostics.stack
  } catch (error) {
    logger.warn('⚠️ [Finishing Touches] Recommend fell back after ranker error', { error })
    const stack = fallbackStackForInput(input, existing)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🔎 [Finishing Touches] Recommendation diagnostics', {
        systemPrompt: RECOMMEND_SYSTEM_PROMPT,
        userPrompt,
        existingNames: existing,
        rawGeminiResponse: null,
        fallbackUsed: true,
        fallbackReason: 'request_or_parse_error',
        finalIds: stack.map((item) => item.id),
      })
    }
    return stack
  }
}
