/**
 * Shared guard rails for Studio generation routes (mutate, reshoot).
 */

import { NextResponse } from 'next/server'
import { NanoBananaError } from '@/lib/nano-banana'
import { getStudioDish, type StudioDishRecord } from '@/lib/studio/dishes'
import { setStudioDishCurrentImage } from '@/lib/studio/dishes'
import {
  countTodayGeneratedStudioImages,
  getStudioDailyGenerationLimit,
  persistStudioImage,
  type PersistStudioImageInput,
} from '@/lib/studio/persistence'
import {
  assertCanAffordStudioCredits,
  debitForStudioGeneration,
  getCreditCostForModel,
  StudioCreditsError,
} from '@/lib/studio/credits'
import {
  assertDishNotBlocked,
  isBillableProviderFailure,
  recordBillableGenerationFailure,
  recordGenerationSuccess,
  StudioDishBlockedError,
} from '@/lib/studio/generation-failures'
import { StudioImageLoadError } from '@/lib/studio/image-bytes'
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import { logger } from '@/lib/logger'

export interface StudioGenerationGuardContext {
  userId: string
  dishId: string
}

export interface StudioGenerationGuardResult {
  dish: StudioDishRecord
  creditCost: number
  requestedModel: string
  usedToday: number
  dailyLimit: number
}

export function resolveRequestedStudioModel(model: unknown): string {
  return typeof model === 'string' && model === STUDIO_PRO_MODEL
    ? STUDIO_PRO_MODEL
    : STUDIO_FLASH_MODEL
}

export async function guardStudioGeneration(
  userId: string,
  dishId: string,
  model: unknown,
): Promise<StudioGenerationGuardResult | NextResponse> {
  const dish = await getStudioDish(userId, dishId)
  if (!dish) {
    return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
  }

  assertDishNotBlocked(dish)

  const dailyLimit = getStudioDailyGenerationLimit()
  const usedToday = await countTodayGeneratedStudioImages(userId)
  if (usedToday >= dailyLimit) {
    return NextResponse.json(
      {
        error: `Daily generation limit of ${dailyLimit} reached. Try again tomorrow.`,
        code: 'STUDIO_DAILY_LIMIT',
      },
      { status: 429 },
    )
  }

  const requestedModel = resolveRequestedStudioModel(model)
  const creditCost = getCreditCostForModel(requestedModel)
  await assertCanAffordStudioCredits(userId, creditCost)

  return { dish, creditCost, requestedModel, usedToday, dailyLimit }
}

export interface FinaliseStudioGenerationInput {
  userId: string
  dishId: string
  persistInput: PersistStudioImageInput
  creditCost: number
  requestedModel: string
}

export interface FinaliseStudioGenerationResult {
  record: Awaited<ReturnType<typeof persistStudioImage>>
  debit: Awaited<ReturnType<typeof debitForStudioGeneration>>
}

export async function finaliseStudioGeneration({
  userId,
  dishId,
  persistInput,
  creditCost,
  requestedModel,
}: FinaliseStudioGenerationInput): Promise<FinaliseStudioGenerationResult> {
  const record = await persistStudioImage(persistInput)

  const debit = await debitForStudioGeneration({
    userId,
    cost: creditCost,
    studioImageId: record.id,
    model: requestedModel,
  })

  await setStudioDishCurrentImage(userId, dishId, record.id).catch(() => undefined)
  await recordGenerationSuccess(userId, dishId).catch((err) => {
    logger.warn('⚠️ [Studio Generation] Failed to reset dish failure counter', { err })
  })

  return { record, debit }
}

export async function mapStudioGenerationError(
  error: unknown,
  failureContext: StudioGenerationGuardContext | null,
  logLabel: string,
): Promise<NextResponse> {
  if (error instanceof StudioDishBlockedError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        failureCount: error.failureCount,
      },
      { status: error.status },
    )
  }

  if (error instanceof StudioCreditsError) {
    return NextResponse.json(
      { error: error.message, code: 'STUDIO_INSUFFICIENT_CREDITS' },
      { status: error.status },
    )
  }

  if (error instanceof StudioImageLoadError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof NanoBananaError) {
    let status: number

    switch (error.code) {
      case 'CONTENT_POLICY_VIOLATION':
      case 'SAFETY_FILTER_BLOCKED':
        status = 403
        break
      case 'RATE_LIMIT_EXCEEDED':
        status = 429
        break
      case 'AUTHENTICATION_ERROR':
        status = 401
        break
      case 'SERVICE_UNAVAILABLE':
        status = 503
        break
      case 'TIMEOUT':
        status = 504
        break
      case 'NO_IMAGE_PRODUCED':
        status = 502
        break
      default:
        status = 400
        break
    }

    logger.warn(`⚠️ [${logLabel}] NanoBananaError`, {
      code: error.code,
      status,
      message: error.message,
    })

    if (failureContext && isBillableProviderFailure(error)) {
      return await handleBillableFailure(error, failureContext, status, logLabel)
    }

    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        retryAfter: error.retryAfter,
        filterReason: error.filterReason,
        suggestions: error.suggestions,
      },
      { status },
    )
  }

  logger.error(`❌ [${logLabel}] Internal error`, { error })
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

async function handleBillableFailure(
  error: NanoBananaError,
  failureContext: StudioGenerationGuardContext,
  status: number,
  logLabel: string,
): Promise<NextResponse> {
  try {
    const updated = await recordBillableGenerationFailure(
      failureContext.userId,
      failureContext.dishId,
      error.code,
    )
    if (updated.generation_blocked_at) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          dishBlocked: true,
          dishBlockCode: 'STUDIO_DISH_GENERATION_BLOCKED',
          retryAfter: error.retryAfter,
          filterReason: error.filterReason,
          suggestions: error.suggestions,
        },
        { status },
      )
    }
  } catch (recordErr) {
    logger.warn(`⚠️ [${logLabel}] Failed to record billable failure`, { recordErr })
  }

  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
      retryAfter: error.retryAfter,
      filterReason: error.filterReason,
      suggestions: error.suggestions,
    },
    { status },
  )
}
