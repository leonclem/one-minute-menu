/**
 * Photo Studio — Phase B Mutation Route (customer-facing)
 *
 * POST /api/studio/mutate
 *
 * Generates via MutationEngine (fixed standard model), persists the output to
 * studio_images + storage, and returns the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'
import { composePrompt } from '@/lib/photo-control/prompt-composer'
import { buildSceneDescriptor } from '@/lib/photo-control/scene-descriptor'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { loadStudioImageBytes } from '@/lib/studio/image-bytes'
import { CENTER, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { editorStateToMetadata } from '@/lib/studio/editor-state-storage'
import { resolveStyleDirectiveClauses } from '@/lib/studio/resolve-style-directives'
import {
  runStudioOutputValidation,
  validationToMetadata,
} from '@/lib/studio/output-validation'
import type { OutputValidationStagedField } from '@/lib/photo-control/output-validator'
import {
  finaliseStudioGeneration,
  guardStudioGeneration,
  mapStudioGenerationError,
} from '@/lib/studio/generation-request'
import { sanitizeExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'
import { parseFinishingTouchesMetadata } from '@/lib/studio/finishing-touches/metadata'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

function normalizeSchemaFields(schema: MinimalSchema): MinimalSchema {
  if (typeof schema.scene_setup?.spin !== 'string') {
    schema.scene_setup = { ...schema.scene_setup, spin: '0' }
  }
  if (typeof schema.canvas?.background_style !== 'string') {
    schema.canvas = { ...schema.canvas, background_style: '' }
  }
  if (typeof schema.canvas?.surface_style !== 'string') {
    schema.canvas = { ...schema.canvas, surface_style: '' }
  }
  return schema
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
      extractionDiagnostics?: unknown
      finishingTouches?: unknown
    }

    const {
      sourceImageId,
      originalState,
      targetState,
      directive,
      dishId,
      changeSummary,
      model,
      extractionDiagnostics,
      finishingTouches: finishingTouchesRaw,
    } = body
    const safeExtractionDiagnostics = sanitizeExtractionDiagnostics(extractionDiagnostics)
    const finishingTouches = parseFinishingTouchesMetadata(finishingTouchesRaw)

    const changeSummaryChips = Array.isArray(changeSummary)
      ? changeSummary.filter((item): item is string => typeof item === 'string')
      : []

    if (typeof dishId !== 'string' || !dishId) {
      return NextResponse.json({ error: 'dishId is required' }, { status: 400 })
    }

    failureContext = { userId: auth.user.id, dishId }

    const guard = await guardStudioGeneration(auth.user.id, dishId, model)
    if (guard instanceof NextResponse) return guard

    const { creditCost, requestedModel, usedToday, dailyLimit } = guard

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

    const originalSchema = normalizeSchemaFields(originalState as MinimalSchema)
    const targetSchema = normalizeSchemaFields(targetState as MinimalSchema)

    const styleResolution = await resolveStyleDirectiveClauses(originalSchema, targetSchema)
    if (styleResolution.error) {
      return NextResponse.json({ error: styleResolution.error }, { status: 400 })
    }

    const labels: string[] = []
    const delta = computeDelta(
      { schema: originalSchema, position: CENTER },
      { schema: targetSchema, position: CENTER },
    )
    const stagedFields: OutputValidationStagedField[] = []
    for (const change of delta.scalarChanges) {
      if (change.path === 'scene_setup.lighting') stagedFields.push('lighting')
      if (change.path === 'canvas.background_style') stagedFields.push('background_style')
      if (change.path === 'canvas.surface_style') stagedFields.push('surface_style')
      if (change.path === 'scene_setup.angle') stagedFields.push('angle')
      if (change.path === 'scene_setup.spin') stagedFields.push('spin')
    }
    const descriptor = buildSceneDescriptor({
      original: originalSchema,
      target: targetSchema,
      delta,
      styles: {
        lighting: styleResolution.lightingStyle,
        backdrop: styleResolution.backgroundStyle,
        surface: styleResolution.surfaceStyle,
      },
      observations:
        safeExtractionDiagnostics
          ? ({ ...(safeExtractionDiagnostics as unknown as Record<string, unknown>) })
          : {},
      labels,
      includePromptFragmentFallback: false,
    })
    const directiveText = directive.trim()
    const compositionResult = composePrompt({
      directive: directiveText,
      descriptor,
      originalState: originalSchema,
      targetState: targetSchema,
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
      creditCost,
    })

    const engine = getMutationEngine()
    const { imageBase64, mimeType: generatedMimeType, providerMimeType } = await engine.mutate({
      sourceImageBase64,
      mimeType,
      prompt: compositionResult.prompt,
      model: requestedModel,
      styleReferences: [],
      request_scope: 'studio_foh_mutation',
    })

    const validationResult = await runStudioOutputValidation({
      imageBase64,
      mimeType: generatedMimeType ?? 'image/png',
      expected: targetSchema,
      stagedFields,
      requestedStyleDescriptors: {
        background_style: styleResolution.backgroundStyle?.descriptor,
        surface_style: styleResolution.surfaceStyle?.descriptor,
      },
    })

    const generatedMetadata: Record<string, unknown> = {
      directive: directiveText,
      changeSummary: changeSummaryChips,
      cost_credits: creditCost,
      editorState: editorStateToMetadata({
        schema: targetSchema,
        position: { ...CENTER },
      }),
      validation: validationToMetadata(validationResult),
    }
    if (safeExtractionDiagnostics) {
      generatedMetadata.extractionDiagnostics = safeExtractionDiagnostics
    }
    if (finishingTouches) {
      generatedMetadata.finishingTouches = finishingTouches
    }

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
        sourceImageId,
        prompt: compositionResult.prompt,
        model: requestedModel,
        metadata: generatedMetadata,
      },
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
      validationStatus: validationResult.status,
      credits: { cost: debit.cost, balanceAfter: debit.balanceAfter },
    })
  } catch (error) {
    return await mapStudioGenerationError(error, failureContext, 'Studio Mutate')
  }
}
