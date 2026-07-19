/**
 * Photo Studio — Phase B Mutation Route (customer-facing)
 *
 * POST /api/studio/mutate
 *
 * Generates via MutationEngine (fixed standard model), persists the output to
 * studio_images + storage, and returns the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/user-api-auth'
import { NanoBananaError } from '@/lib/nano-banana'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'
import { composePrompt } from '@/lib/photo-control/prompt-composer'
import { parseAndValidateImageDataUrl } from '@/lib/photo-control/request-validation'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { getStudioDish, setStudioDishCurrentImage } from '@/lib/studio/dishes'
import { editorStateToMetadata } from '@/lib/studio/editor-state-storage'
import {
  countTodayGeneratedStudioImages,
  getStudioDailyGenerationLimit,
  persistStudioImage,
} from '@/lib/studio/persistence'
import { CENTER, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const STUDIO_MODEL = 'gemini-3.1-flash-image-preview'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserApi()
    if (!auth.ok) return auth.response

    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 },
      )
    }

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

    const body = (await request.json()) as {
      sourceImageDataUrl?: unknown
      originalState?: unknown
      targetState?: unknown
      directive?: unknown
      sourceImageId?: unknown
      dishId?: unknown
      changeSummary?: unknown
    }

    const {
      sourceImageDataUrl,
      originalState,
      targetState,
      directive,
      sourceImageId,
      dishId,
      changeSummary,
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

    if (typeof sourceImageDataUrl !== 'string' || !sourceImageDataUrl) {
      return NextResponse.json(
        { error: 'sourceImageDataUrl is required and must be a string' },
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

    const parsed = parseAndValidateImageDataUrl(sourceImageDataUrl, {
      fieldLabel: 'sourceImageDataUrl',
    })
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { mimeType, base64: sourceImageBase64, byteLength: imageBytes } = parsed

    const compositionResult = composePrompt({
      directive: directive.trim(),
      originalState: originalState as MinimalSchema,
      targetState: targetState as MinimalSchema,
    })

    if (!compositionResult.ok) {
      return NextResponse.json(
        { error: compositionResult.error, code: compositionResult.code },
        { status: 400 },
      )
    }

    logger.info('🎨 [Studio Mutate] Request', {
      userId: auth.user.id,
      mimeType,
      imageBytes,
      promptLength: compositionResult.prompt.length,
      usedToday,
      dailyLimit,
    })

    const engine = getMutationEngine()
    const { imageBase64 } = await engine.mutate({
      sourceImageBase64,
      mimeType,
      prompt: compositionResult.prompt,
      model: STUDIO_MODEL,
    })

    const record = await persistStudioImage({
      userId: auth.user.id,
      dishId,
      role: 'generated',
      imageBase64,
      mimeType: 'image/png',
      sourceImageId: typeof sourceImageId === 'string' ? sourceImageId : null,
      prompt: compositionResult.prompt,
      model: STUDIO_MODEL,
      metadata: {
        directive: directive.trim(),
        changeSummary: changeSummaryChips,
        editorState: editorStateToMetadata({
          schema: targetState as MinimalSchema,
          position: { ...CENTER },
        }),
      },
    })

    await setStudioDishCurrentImage(auth.user.id, dishId, record.id).catch(() => undefined)

    logger.info('✅ [Studio Mutate] Success', {
      userId: auth.user.id,
      imageId: record.id,
      dishId,
      model: STUDIO_MODEL,
    })

    return NextResponse.json({
      imageUrl: record.public_url,
      imageId: record.id,
      dishId: record.dish_id,
      model: STUDIO_MODEL,
    })
  } catch (error) {
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
