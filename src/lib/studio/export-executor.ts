/**
 * Photo Studio — export variant executor.
 *
 * Runs the actual paid work for one claimed export variant: Gemini outpainting
 * or Replicate background removal, then upload and credit debit.
 *
 * Mirrors `executeImageGenerationJob`: this module does the work and throws.
 * Status transitions on failure (retry vs terminal) belong to the caller so the
 * worker's shared retry strategy stays in one place.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/logger'
import { createWorkerSupabaseClient } from '@/lib/supabase-worker'
import {
  assertCanAffordStudioCredits,
  debitForStudioExportVariant,
  StudioCreditsError,
} from '@/lib/studio/credits'
import {
  getExportPreset,
  type StudioExportGenerationMethod,
} from '@/lib/studio/export-presets'
import { renderExportVariant } from '@/lib/studio/export-renderers'
import {
  completeExportVariant,
  StudioExportError,
  type ExportDbClient,
} from '@/lib/studio/export-variants'
import {
  assertStudioStoragePathOwnedByUser,
  isPhotoControlMimeType,
  STUDIO_STORAGE_BUCKET,
  toBrowserPublicUrl,
} from '@/lib/studio/storage-paths'
import type { StudioExportVariantRecord } from '@/lib/studio/types'

/**
 * Minimal shape the executor needs from a claimed variant row.
 *
 * `variant_type` and `generation_method` arrive widened to `string` from the
 * claim RPC, so they are validated here rather than trusted.
 */
export interface ExecutableExportVariant {
  id: string
  user_id: string
  dish_id: string
  source_image_id: string
  variant_type: string
  generation_method: string
  estimated_credits: number
  metadata: Record<string, unknown>
}

const GENERATION_METHODS: readonly StudioExportGenerationMethod[] = [
  'crop_resize',
  'ai_expand',
  'ai_recompose',
  'cutout',
]

function assertGenerationMethod(value: string): StudioExportGenerationMethod {
  const match = GENERATION_METHODS.find((method) => method === value)
  if (!match) {
    throw new StudioExportError(
      `Unsupported export generation method: ${value}`,
      'EXPORT_METHOD_UNSUPPORTED',
      400,
    )
  }
  return match
}

export interface ExportExecutionResult {
  variantId: string
  previewUrl: string | null
  creditsCharged: number
  processingTimeMs: number
  aspectRatioHonoured: boolean | null
}

/**
 * Execute one export variant end to end.
 *
 * @throws StudioExportError for terminal domain problems (missing image,
 *   unknown preset, insufficient credits).
 * @throws provider errors unchanged so the caller can classify and retry.
 */
export async function executeStudioExportVariant(
  variant: ExecutableExportVariant,
  supabaseClient?: SupabaseClient,
): Promise<ExportExecutionResult> {
  const supabase = (supabaseClient ?? createWorkerSupabaseClient()) as ExportDbClient
  const startedAt = Date.now()

  const preset = getExportPreset(variant.variant_type)
  if (!preset) {
    throw new StudioExportError(
      `Unknown export format: ${variant.variant_type}`,
      'EXPORT_PRESET_UNKNOWN',
      400,
    )
  }

  const method = assertGenerationMethod(variant.generation_method)

  // Load the hero image row directly through the injected client rather than
  // the request-scoped library helpers, so this runs cleanly in the worker.
  const { data: imageRow, error: imageError } = await supabase
    .from('studio_images')
    .select('id, user_id, storage_path, public_url, mime_type, width, height')
    .eq('id', variant.source_image_id)
    .eq('user_id', variant.user_id)
    .maybeSingle()

  if (imageError) {
    throw new Error(`Failed to load hero image: ${imageError.message}`)
  }
  if (!imageRow) {
    throw new StudioExportError(
      'Source image no longer exists.',
      'EXPORT_SOURCE_MISSING',
      404,
    )
  }

  assertStudioStoragePathOwnedByUser(imageRow.storage_path as string, variant.user_id)

  const mimeType = imageRow.mime_type as string
  if (!isPhotoControlMimeType(mimeType)) {
    throw new StudioExportError(
      'Source image has an unsupported MIME type.',
      'EXPORT_SOURCE_MIME_INVALID',
      400,
    )
  }

  const cost = variant.estimated_credits ?? 0

  // Re-check affordability at execution time: the balance may have dropped
  // between enqueue and claim. Failing here avoids doing paid work for free.
  if (cost > 0) {
    await assertCanAffordStudioCredits(variant.user_id, cost, supabase)
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(STUDIO_STORAGE_BUCKET)
    .download(imageRow.storage_path as string)

  if (downloadError || !blob) {
    throw new StudioExportError(
      downloadError?.message ?? 'Failed to download source image.',
      'EXPORT_SOURCE_DOWNLOAD_FAILED',
      404,
    )
  }

  const sourceBuffer = Buffer.from(await blob.arrayBuffer())

  logger.info('🎬 [Studio Export] Executing variant', {
    variantId: variant.id,
    variantType: variant.variant_type,
    method,
    cost,
  })

  const renderWithSourceUrl = (sourceUrl: string) =>
    renderExportVariant({
      method,
      preset,
      sourceBuffer,
      sourceBase64: sourceBuffer.toString('base64'),
      sourceMimeType: mimeType,
      sourceUrl,
    })

  let rendered: Awaited<ReturnType<typeof renderWithSourceUrl>>
  const browserSourceUrl = toBrowserPublicUrl(imageRow.public_url as string)

  if (method === 'cutout') {
    // Replicate runs outside the local Docker network. Reuse the legacy
    // cut-out pipeline's temporary public-image proxy for local Supabase URLs.
    const { resolvePublicImageUrl } = await import(
      '@/lib/background-removal/local-image-proxy'
    )
    const { url: resolvedSourceUrl, cleanup } = await resolvePublicImageUrl(
      browserSourceUrl,
    )

    try {
      rendered = await renderWithSourceUrl(resolvedSourceUrl)
    } finally {
      await cleanup()
    }
  } else {
    rendered = await renderWithSourceUrl(browserSourceUrl)
  }

  const processingTimeMs = Date.now() - startedAt
  const targetAspect = preset.width / preset.height
  const aspectRatioHonoured =
    rendered.modelWidth && rendered.modelHeight
      ? Math.abs(rendered.modelWidth / rendered.modelHeight - targetAspect) / targetAspect <= 0.1
      : null

  const ready = await completeExportVariant({
    userId: variant.user_id,
    variant: variant as StudioExportVariantRecord,
    buffer: rendered.buffer,
    mimeType: rendered.mimeType,
    creditsCharged: cost,
    client: supabase,
    metadata: {
      generation_method: variant.generation_method,
      duration_ms: processingTimeMs,
      bytes: rendered.buffer.length,
      source_width: (imageRow.width as number | null) ?? null,
      source_height: (imageRow.height as number | null) ?? null,
      prompt: rendered.prompt ?? null,
      model: rendered.model ?? null,
      requested_aspect_ratio: rendered.requestedAspectRatio ?? null,
      model_width: rendered.modelWidth ?? null,
      model_height: rendered.modelHeight ?? null,
      aspect_ratio_honoured: aspectRatioHonoured,
    },
  })

  // Debit only after the asset exists. A failure here leaves the user with a
  // free asset, which is the right way round to be wrong.
  if (cost > 0) {
    try {
      await debitForStudioExportVariant({
        userId: variant.user_id,
        cost,
        variantId: variant.id,
        variantType: variant.variant_type,
        generationMethod: variant.generation_method,
        client: supabase,
      })
    } catch (error) {
      if (error instanceof StudioCreditsError) {
        logger.error('❌ [Studio Export] Asset produced but credit debit failed', {
          variantId: variant.id,
          userId: variant.user_id,
          cost,
          code: error.code,
        })
      } else {
        throw error
      }
    }
  }

  logger.info('✅ [Studio Export] Variant ready', {
    variantId: variant.id,
    variantType: variant.variant_type,
    method: variant.generation_method,
    creditsCharged: cost,
    processingTimeMs,
    aspectRatioHonoured,
  })

  return {
    variantId: variant.id,
    previewUrl: ready.preview_url,
    creditsCharged: cost,
    processingTimeMs,
    aspectRatioHonoured,
  }
}
