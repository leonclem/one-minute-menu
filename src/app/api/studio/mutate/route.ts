/**
 * Photo Studio — Phase B Mutation Route (customer-facing)
 *
 * POST /api/studio/mutate
 *
 * Generates via MutationEngine (fixed standard model), persists the output to
 * studio_images + storage, and returns the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { NanoBananaError } from '@/lib/nano-banana'
import { getMutationEngine, type StyleReferenceImage } from '@/lib/photo-control/mutation-engine'
import { composePrompt } from '@/lib/photo-control/prompt-composer'
import { loadStudioImageBytes, StudioImageLoadError } from '@/lib/studio/image-bytes'
import { CENTER, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { getStudioDish, setStudioDishCurrentImage } from '@/lib/studio/dishes'
import { editorStateToMetadata } from '@/lib/studio/editor-state-storage'
import {
  countTodayGeneratedStudioImages,
  getStudioDailyGenerationLimit,
  persistStudioImage,
} from '@/lib/studio/persistence'
import {
  mergeDirectiveWithStyleClauses,
  resolveStyleDirectiveClauses,
} from '@/lib/studio/resolve-style-directives'
import {
  clientValidationPayload,
  runStudioOutputValidation,
  validationToMetadata,
} from '@/lib/studio/output-validation'
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
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const STUDIO_MODEL = STUDIO_FLASH_MODEL

function loadStyleReferenceImage(
  thumbnailPath: string | null | undefined,
  role: 'style' | 'scene',
  styleName: string,
): StyleReferenceImage | null {
  if (!thumbnailPath) return null
  try {
    const subPath = thumbnailPath.includes('/') ? thumbnailPath : `controls/${thumbnailPath}`
    const filePath = path.join(process.cwd(), 'public', 'studio', `${subPath}.png`)
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath).toString('base64')
      return {
        data,
        mimeType: 'image/png',
        role,
        comment: `Reference image for ${role === 'style' ? 'lighting and color palette' : 'background environment and surface tabletop'}: ${styleName}`,
      }
    }
  } catch (err) {
    logger.warn(`⚠️ [Studio Mutate] Failed to load style reference image for ${styleName}:`, err)
  }
  return null
}

export async function POST(request: NextRequest) {
  let failureContext: { userId: string; dishId: string } | null = null

  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 },
      )
    }

    const body = (await request.json()) as {
      sourceImageId?: unknown
      originalState?: unknown
      targetState?: unknown
      directive?: unknown
      dishId?: unknown
      changeSummary?: unknown
      model?: unknown
    }

    const {
      sourceImageId,
      originalState,
      targetState,
      directive,
      dishId,
      changeSummary,
      model,
    } = body

    const changeSummaryChips = Array.isArray(changeSummary)
      ? changeSummary.filter((item): item is string => typeof item === 'string')
      : []

    if (typeof dishId !== 'string' || !dishId) {
      return NextResponse.json({ error: 'dishId is required' }, { status: 400 })
    }

    const dish = await getStudioDish(auth.user.id, dishId)
    if (!dish) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
    }

    failureContext = { userId: auth.user.id, dishId }

    assertDishNotBlocked(dish)

    const dailyLimit = getStudioDailyGenerationLimit()
    const usedToday = await countTodayGeneratedStudioImages(auth.user.id)
    if (usedToday >= dailyLimit) {
      return NextResponse.json(
        {
          error: `Daily generation limit of ${dailyLimit} reached. Try again tomorrow.`,
          code: 'STUDIO_DAILY_LIMIT',
        },
        { status: 429 },
      )
    }

    const requestedModelEarly =
      typeof model === 'string' && model === STUDIO_PRO_MODEL
        ? STUDIO_PRO_MODEL
        : STUDIO_MODEL
    const creditCost = getCreditCostForModel(requestedModelEarly)
    await assertCanAffordStudioCredits(auth.user.id, creditCost)

    if (typeof sourceImageId !== 'string' || !sourceImageId) {
      return NextResponse.json(
        { error: 'sourceImageId is required and must be a string' },
        { status: 400 },
      )
    }

    if (!originalState || typeof originalState !== 'object') {
      return NextResponse.json(
        { error: 'originalState is required and must be an object' },
        { status: 400 },
      )
    }

    if (!targetState || typeof targetState !== 'object') {
      return NextResponse.json(
        { error: 'targetState is required and must be an object' },
        { status: 400 },
      )
    }

    if (typeof directive !== 'string' || !directive.trim()) {
      return NextResponse.json(
        { error: 'directive is required and must be a non-empty string' },
        { status: 400 },
      )
    }

    const { mimeType, base64: sourceImageBase64, byteLength: imageBytes } =
      await loadStudioImageBytes(auth.user.id, sourceImageId)

    const originalSchema = originalState as MinimalSchema
    const targetSchema = targetState as MinimalSchema

    // Normalize optional spin field on older clients / persisted states.
    if (typeof originalSchema.scene_setup?.spin !== 'string') {
      originalSchema.scene_setup = {
        ...originalSchema.scene_setup,
        spin: '0',
      }
    }
    if (typeof targetSchema.scene_setup?.spin !== 'string') {
      targetSchema.scene_setup = {
        ...targetSchema.scene_setup,
        spin: '0',
      }
    }

    // Normalize optional Chunk 4 field on older clients / persisted states.
    if (typeof originalSchema.canvas?.background_style !== 'string') {
      originalSchema.canvas = {
        ...originalSchema.canvas,
        background_style: '',
      }
    }
    if (typeof targetSchema.canvas?.background_style !== 'string') {
      targetSchema.canvas = {
        ...targetSchema.canvas,
        background_style: '',
      }
    }

    if (typeof originalSchema.canvas?.surface_style !== 'string') {
      originalSchema.canvas = {
        ...originalSchema.canvas,
        surface_style: '',
      }
    }
    if (typeof targetSchema.canvas?.surface_style !== 'string') {
      targetSchema.canvas = {
        ...targetSchema.canvas,
        surface_style: '',
      }
    }

    const styleResolution = await resolveStyleDirectiveClauses(originalSchema, targetSchema)
    if (styleResolution.error) {
      return NextResponse.json({ error: styleResolution.error }, { status: 400 })
    }

    const mergedDirective = mergeDirectiveWithStyleClauses(
      directive.trim(),
      styleResolution.clauses,
    )

    const compositionResult = composePrompt({
      directive: mergedDirective,
      originalState: originalSchema,
      targetState: targetSchema,
    })

    if (!compositionResult.ok) {
      return NextResponse.json(
        { error: compositionResult.error, code: compositionResult.code },
        { status: 400 },
      )
    }

    const requestedModel = requestedModelEarly

    logger.info('🎨 [Studio Mutate] Request', {
      userId: auth.user.id,
      mimeType,
      imageBytes,
      promptLength: compositionResult.prompt.length,
      usedToday,
      dailyLimit,
      creditCost,
    })

    const styleReferences: StyleReferenceImage[] = []

    if (styleResolution.lightingStyle) {
      const img = loadStyleReferenceImage(
        styleResolution.lightingStyle.thumbnail_path,
        'style',
        styleResolution.lightingStyle.name,
      )
      if (img) styleReferences.push(img)
    }

    if (styleResolution.backgroundStyle) {
      const img = loadStyleReferenceImage(
        styleResolution.backgroundStyle.thumbnail_path,
        'scene',
        styleResolution.backgroundStyle.name,
      )
      if (img) styleReferences.push(img)
    }

    if (styleResolution.surfaceStyle) {
      const img = loadStyleReferenceImage(
        styleResolution.surfaceStyle.thumbnail_path,
        'scene',
        styleResolution.surfaceStyle.name,
      )
      if (img) styleReferences.push(img)
    }

    const engine = getMutationEngine()
    const { imageBase64 } = await engine.mutate({
      sourceImageBase64,
      mimeType,
      prompt: compositionResult.prompt,
      model: requestedModel,
      styleReferences,
      request_scope: 'studio_foh_mutation',
    })

    // Soft post-gen validation: never fails the generation on extract/score errors.
    const validationResult = await runStudioOutputValidation({
      imageBase64,
      mimeType: 'image/png',
      expected: targetSchema,
    })
    const validationClient = clientValidationPayload(validationResult)

    const record = await persistStudioImage({
      userId: auth.user.id,
      dishId,
      role: 'generated',
      imageBase64,
      mimeType: 'image/png',
      sourceImageId,
      prompt: compositionResult.prompt,
      model: requestedModel,
      metadata: {
        directive: mergedDirective,
        changeSummary: changeSummaryChips,
        cost_credits: creditCost,
        editorState: editorStateToMetadata({
          schema: targetSchema,
          position: { ...CENTER },
        }),
        validation: validationToMetadata(validationResult),
      },
    })

    const debit = await debitForStudioGeneration({
      userId: auth.user.id,
      cost: creditCost,
      studioImageId: record.id,
      model: requestedModel,
    })

    await setStudioDishCurrentImage(auth.user.id, dishId, record.id).catch(() => undefined)
    await recordGenerationSuccess(auth.user.id, dishId).catch((err) => {
      logger.warn('⚠️ [Studio Mutate] Failed to reset dish failure counter', { err })
    })

    logger.info('✅ [Studio Mutate] Success', {
      userId: auth.user.id,
      imageId: record.id,
      dishId,
      model: requestedModel,
      creditCost,
      balanceAfter: debit.balanceAfter,
      validationStatus: validationResult.status,
      validationScore: validationResult.score,
    })

    return NextResponse.json({
      imageUrl: record.public_url,
      imageId: record.id,
      dishId: record.dish_id,
      model: requestedModel,
      validation: validationClient,
      credits: { cost: debit.cost, balanceAfter: debit.balanceAfter },
    })
  } catch (error) {
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
        case 'NO_IMAGE_PRODUCED':
          status = 502
          break
        default:
          status = 400
          break
      }

      logger.warn('⚠️ [Studio Mutate] NanoBananaError', {
        code: error.code,
        status,
        message: error.message,
      })

      if (failureContext && isBillableProviderFailure(error)) {
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
          logger.warn('⚠️ [Studio Mutate] Failed to record billable failure', {
            recordErr,
          })
        }
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

    logger.error('❌ [Studio Mutate] Internal error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
