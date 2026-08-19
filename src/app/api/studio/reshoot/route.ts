/**
 * Photo Studio — Re-shoot Route (customer-facing)
 *
 * POST /api/studio/reshoot
 *
 * Re-photographs the dish from the source image, releasing composition, camera,
 * lighting and backdrop constraints while preserving dish identity.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'
import { composePrompt } from '@/lib/photo-control/prompt-composer'
import { buildReshootDescriptor } from '@/lib/photo-control/scene-descriptor'
import { loadStudioImageBytes } from '@/lib/studio/image-bytes'
import { CENTER, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { editorStateToMetadata } from '@/lib/studio/editor-state-storage'
import { resolveStylesByKeys } from '@/lib/studio/reference-libraries'
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
import { resolveReshootStyleDefaults } from '@/lib/studio/style-defaults'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const RESHOOT_DIRECTIVE = 'Re-shoot this dish with the target scene settings.'

function normalizeSchema(schema: MinimalSchema): MinimalSchema {
  const normalized = { ...schema }
  if (typeof normalized.scene_setup?.spin !== 'string') {
    normalized.scene_setup = { ...normalized.scene_setup, spin: '0' }
  }
  if (typeof normalized.canvas?.background_style !== 'string') {
    normalized.canvas = { ...normalized.canvas, background_style: '' }
  }
  if (typeof normalized.canvas?.surface_style !== 'string') {
    normalized.canvas = { ...normalized.canvas, surface_style: '' }
  }
  return normalized
}

function buildTargetSchema(
  base: MinimalSchema,
  styles: { lighting?: string; backdrop?: string; surface?: string },
): MinimalSchema {
  return {
    ...base,
    scene_setup: {
      ...base.scene_setup,
      ...(styles.lighting ? { lighting: styles.lighting } : {}),
    },
    canvas: {
      ...base.canvas,
      ...(styles.backdrop ? { background_style: styles.backdrop } : {}),
      ...(styles.surface ? { surface_style: styles.surface } : {}),
    },
  }
}

function validationMetadataForReshoot(
  validationResult: Awaited<ReturnType<typeof runStudioOutputValidation>>,
  improvePlating: boolean,
): Record<string, unknown> {
  const metadata = validationToMetadata(validationResult)
  if (!improvePlating) return metadata

  const itemCount = validationResult.dimensions.find((d) => d.id === 'item_count')
  if (!itemCount) return metadata

  const dimensions = validationResult.dimensions.filter((d) => d.id !== 'item_count')
  const adjustedStatus =
    dimensions.some((d) => d.status === 'fail')
      ? 'fail'
      : dimensions.some((d) => d.status === 'warn')
        ? 'warn'
        : validationResult.status

  return {
    status: adjustedStatus,
    score: validationResult.score,
    summary: validationResult.summary,
    dimensions,
    componentCountDrift: {
      expected: itemCount.note,
      status: itemCount.status,
    },
  }
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
      dishId?: unknown
      sourceImageId?: unknown
      baseState?: unknown
      styles?: { lighting?: string; backdrop?: string; surface?: string }
      improvePlating?: unknown
      extractionDiagnostics?: unknown
      model?: unknown
    }

    const {
      dishId,
      sourceImageId,
      baseState,
      styles: styleOverrides,
      improvePlating,
      extractionDiagnostics,
      model,
    } = body

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

    if (!baseState || typeof baseState !== 'object') {
      return NextResponse.json(
        { error: 'baseState is required and must be an object' },
        { status: 400 },
      )
    }

    const safeExtractionDiagnostics = sanitizeExtractionDiagnostics(extractionDiagnostics)
    const baseSchema = normalizeSchema(baseState as MinimalSchema)
    const resolvedDefaults = resolveReshootStyleDefaults(baseSchema, safeExtractionDiagnostics)
    const styleKeys = {
      lighting: styleOverrides?.lighting ?? resolvedDefaults.lighting,
      backdrop: styleOverrides?.backdrop ?? resolvedDefaults.backdrop,
      surface: styleOverrides?.surface ?? resolvedDefaults.surface,
    }

    const styleResolution = await resolveStylesByKeys(styleKeys)
    if (styleResolution.error) {
      return NextResponse.json({ error: styleResolution.error }, { status: 400 })
    }

    const targetSchema = buildTargetSchema(baseSchema, styleKeys)
    const improvePlatingEnabled = improvePlating === true

    const { mimeType, base64: sourceImageBase64, byteLength: imageBytes } =
      await loadStudioImageBytes(auth.user.id, sourceImageId)

    const labels = ['Image A', 'Image B', 'Image C', 'Image D']
    const descriptor = buildReshootDescriptor({
      base: targetSchema,
      styles: {
        lighting: styleResolution.lightingStyle,
        backdrop: styleResolution.backgroundStyle,
        surface: styleResolution.surfaceStyle,
      },
      observations: safeExtractionDiagnostics
        ? ({ ...(safeExtractionDiagnostics as unknown as Record<string, unknown>) })
        : {},
      labels,
      improvePlating: improvePlatingEnabled,
      includePromptFragmentFallback: false,
    })

    const compositionResult = composePrompt({
      directive: RESHOOT_DIRECTIVE,
      descriptor,
    })

    if (!compositionResult.ok) {
      return NextResponse.json(
        { error: compositionResult.error, code: compositionResult.code },
        { status: 400 },
      )
    }

    const stagedFields: OutputValidationStagedField[] = [
      'lighting',
      'background_style',
      'surface_style',
      'angle',
      'framing',
    ]

    logger.info('🎨 [Studio Reshoot] Request', {
      userId: auth.user.id,
      mimeType,
      imageBytes,
      promptLength: compositionResult.prompt.length,
      usedToday,
      dailyLimit,
      creditCost,
      improvePlating: improvePlatingEnabled,
    })

    const engine = getMutationEngine()
    const { imageBase64 } = await engine.mutate({
      sourceImageBase64,
      mimeType,
      prompt: compositionResult.prompt,
      model: requestedModel,
      styleReferences: [],
      request_scope: 'studio_foh_mutation',
    })

    const validationResult = await runStudioOutputValidation({
      imageBase64,
      mimeType: 'image/png',
      expected: targetSchema,
      stagedFields,
      requestedStyleDescriptors: {
        background_style: styleResolution.backgroundStyle?.descriptor,
        surface_style: styleResolution.surfaceStyle?.descriptor,
      },
    })

    const generatedMetadata: Record<string, unknown> = {
      mode: 'reshoot',
      improvePlating: improvePlatingEnabled,
      reshotFrom: sourceImageId,
      directive: RESHOOT_DIRECTIVE,
      cost_credits: creditCost,
      editorState: editorStateToMetadata({
        schema: targetSchema,
        position: { ...CENTER },
      }),
      validation: validationMetadataForReshoot(validationResult, improvePlatingEnabled),
    }
    if (safeExtractionDiagnostics) {
      generatedMetadata.extractionDiagnostics = safeExtractionDiagnostics
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
        mimeType: 'image/png',
        sourceImageId,
        prompt: compositionResult.prompt,
        model: requestedModel,
        metadata: generatedMetadata,
      },
    })

    logger.info('✅ [Studio Reshoot] Success', {
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
    return await mapStudioGenerationError(error, failureContext, 'Studio Reshoot')
  }
}
