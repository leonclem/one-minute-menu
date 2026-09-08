/**
 * Photo Studio — workbench Expand (generative zoom-out).
 *
 * POST /api/studio/expand
 *
 * Pads the current shot, asks Flash/Pro to fill the new scene, and persists
 * Gemini's bytes as a generated child. Does not restore source pixels.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import {
  loadOwnedDishSource,
  OwnedStudioSourceNotFoundError,
} from '@/lib/studio/owned-source'
import { loadStudioImageBytes } from '@/lib/studio/image-bytes'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'
import {
  guardStudioGeneration,
  finaliseStudioGeneration,
  mapStudioGenerationError,
} from '@/lib/studio/generation-request'
import {
  EXPAND_PRESET_IDS,
  buildExpandChildMetadata,
  buildExpandScenePrompt,
  expandPresetDef,
  nearestFlashAspectRatio,
} from '@/lib/studio/expand'
import { padExpandCanvas, StudioExpandCanvasError } from '@/lib/studio/expand/canvas'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const ExpandBodyZ = z
  .object({
    sourceImageId: z.string().min(1),
    dishId: z.string().min(1),
    preset: z.enum(EXPAND_PRESET_IDS),
    model: z.string().optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  let failureContext: { userId: string; dishId: string } | null = null

  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'A valid expand preset is required.', code: 'EXPAND_INVALID' },
        { status: 400 },
      )
    }

    const parsed = ExpandBodyZ.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A valid expand preset is required.', code: 'EXPAND_INVALID' },
        { status: 400 },
      )
    }

    const { sourceImageId, dishId, preset, model } = parsed.data
    failureContext = { userId: auth.user.id, dishId }

    const { image: parent } = await loadOwnedDishSource({
      userId: auth.user.id,
      dishId,
      sourceImageId,
    })

    const guard = await guardStudioGeneration(auth.user.id, dishId, model)
    if (guard instanceof NextResponse) return guard

    const { creditCost, requestedModel } = guard
    const padRatio = expandPresetDef(preset).padRatio
    const loaded = await loadStudioImageBytes(auth.user.id, parent.id)
    const padded = await padExpandCanvas(Buffer.from(loaded.base64, 'base64'), padRatio)
    const aspectRatio = nearestFlashAspectRatio(padded.width, padded.height)
    const prompt = buildExpandScenePrompt(aspectRatio)

    logger.info('Studio workbench expand requested', {
      userId: auth.user.id,
      dishId,
      parentImageId: parent.id,
      preset,
      padRatio,
      aspectRatio,
      creditCost,
    })

    const engine = getMutationEngine()
    const { imageBase64, mimeType: generatedMimeType, providerMimeType } = await engine.mutate({
      sourceImageBase64: padded.buffer.toString('base64'),
      mimeType: 'image/png',
      prompt,
      model: requestedModel,
      aspectRatio,
      styleReferences: [],
      request_scope: 'studio_foh_mutation',
    })

    const { record, debit } = await finaliseStudioGeneration({
      userId: auth.user.id,
      dishId,
      creditCost,
      requestedModel,
      persistInput: {
        userId: auth.user.id,
        dishId,
        role: 'generated',
        imageBase64,
        mimeType: generatedMimeType ?? 'image/png',
        providerMimeType,
        sourceImageId: parent.id,
        prompt,
        model: requestedModel,
        metadata: {
          ...buildExpandChildMetadata({
            parentMetadata: parent.metadata,
            preset,
            padRatio,
          }),
          cost_credits: creditCost,
        },
      },
    })

    logger.info('Studio workbench expand persisted', {
      userId: auth.user.id,
      dishId,
      parentImageId: parent.id,
      imageId: record.id,
      preset,
      creditCost,
      balanceAfter: debit.balanceAfter,
    })

    return NextResponse.json({
      image: record,
      imageUrl: record.public_url,
      imageId: record.id,
      dishId: record.dish_id,
      model: requestedModel,
      credits: { cost: debit.cost, balanceAfter: debit.balanceAfter },
    })
  } catch (error) {
    if (error instanceof OwnedStudioSourceNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof StudioExpandCanvasError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }
    return await mapStudioGenerationError(error, failureContext, 'Studio Expand')
  }
}
