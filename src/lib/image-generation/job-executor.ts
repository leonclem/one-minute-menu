import type { SupabaseClient } from '@supabase/supabase-js'
import { CutoutGenerationService } from '@/lib/background-removal/cutout-service'
import { isCutoutFeatureEnabled } from '@/lib/background-removal/feature-flag'
import { getBackgroundRemovalProvider } from '@/lib/background-removal/provider-factory'
import { ImageProcessingService } from '@/lib/image-processing'
import { logger } from '@/lib/logger'
import { syncMenuItemImageToJsonb } from '@/lib/menu-item-image-sync'
import { getNanoBananaClient, NanoBananaError } from '@/lib/nano-banana'
import { createWorkerSupabaseClient } from '@/lib/supabase-worker'
import type { NanoBananaParams } from '@/types'

export type ExecutableImageGenerationJob = {
  id: string
  user_id: string
  menu_id: string | null
  menu_item_id: string
  prompt: string
  negative_prompt?: string | null
  api_params: Record<string, any> | null
  number_of_variations: number
}

export type ImageGenerationExecutionResult = {
  imageIds: string[]
  processingTimeMs: number
  resultCount: number
}

function buildApiParams(job: ExecutableImageGenerationJob): NanoBananaParams {
  const apiParams = (job.api_params || {}) as Partial<NanoBananaParams> & Record<string, any>

  return {
    ...apiParams,
    prompt: apiParams.prompt || job.prompt,
    negative_prompt: apiParams.negative_prompt || job.negative_prompt || undefined,
    number_of_images: apiParams.number_of_images || job.number_of_variations || 1,
    safety_filter_level: apiParams.safety_filter_level || 'block_some',
    person_generation: apiParams.person_generation || 'dont_allow',
    context: apiParams.context || 'food',
  }
}

function getErrorCode(error: unknown): string | undefined {
  if (error instanceof NanoBananaError) return error.code
  return (error as any)?.code
}

export async function executeImageGenerationJob(
  job: ExecutableImageGenerationJob,
  supabaseClient?: SupabaseClient
): Promise<ImageGenerationExecutionResult> {
  if (!job.menu_id) {
    throw new Error('Image generation job is missing menu_id')
  }

  const supabase = supabaseClient || createWorkerSupabaseClient()
  const imageProcessing = new ImageProcessingService(supabase)
  const apiParams = buildApiParams(job)
  const startTime = Date.now()

  logger.info('[ImageGenerationJob] Generating image', {
    jobId: job.id,
    menuId: job.menu_id,
    menuItemId: job.menu_item_id,
    numberOfImages: apiParams.number_of_images,
    hasReferenceImages: !!apiParams.reference_images?.length,
  })

  try {
    const genResult = await getNanoBananaClient().generateImage(apiParams)
    const imageIds: string[] = []

    for (const base64Image of genResult.images) {
      const processed = await imageProcessing.processGeneratedImage(
        base64Image,
        {
          menuItemId: job.menu_item_id,
          generationJobId: job.id,
          originalPrompt: apiParams.prompt,
          aspectRatio: apiParams.aspect_ratio || '1:1',
          generatedAt: new Date(),
          metadata: {
            angle: (job.api_params as any)?.style_params?.angle,
            batchIndex: (job.api_params as any)?.batch_index,
            modelVersion: genResult.metadata.modelVersion,
          },
        },
        job.user_id
      )

      await imageProcessing.storeImageMetadata(processed)
      imageIds.push(processed.id)
    }

    if (imageIds.length > 0) {
      const selectedImageId = imageIds[0]

      const { error: selectError } = await supabase.rpc('select_ai_image_for_menu_item', {
        p_menu_item_id: job.menu_item_id,
        p_image_id: selectedImageId,
      })
      if (selectError) {
        logger.error('[ImageGenerationJob] Failed to select generated image via RPC', {
          jobId: job.id,
          imageId: selectedImageId,
          error: selectError,
        })
      }

      const { error: itemUpdateError } = await supabase
        .from('menu_items')
        .update({
          ai_image_id: selectedImageId,
          image_source: 'ai',
          custom_image_url: null,
        })
        .eq('id', job.menu_item_id)

      if (itemUpdateError) {
        logger.error('[ImageGenerationJob] Failed to update menu_items image selection', {
          jobId: job.id,
          imageId: selectedImageId,
          error: itemUpdateError,
        })
      }

      await syncMenuItemImageToJsonb(supabase as any, job.menu_item_id)
      await requestCutoutsIfNeeded(supabase, job, imageIds)
    }

    const processingTimeMs = Date.now() - startTime
    logger.info('[ImageGenerationJob] Completed image generation', {
      jobId: job.id,
      resultCount: imageIds.length,
      processingTimeMs,
    })

    return {
      imageIds,
      processingTimeMs,
      resultCount: imageIds.length,
    }
  } catch (error) {
    logger.error('[ImageGenerationJob] Generation failed', {
      jobId: job.id,
      errorCode: getErrorCode(error),
      error,
    })
    throw error
  }
}

async function requestCutoutsIfNeeded(
  supabase: SupabaseClient,
  job: ExecutableImageGenerationJob,
  imageIds: string[]
): Promise<void> {
  if (!isCutoutFeatureEnabled()) return

  // Cutouts run on the final stored image (including composite/reference-image workflows).
  // Replicate fetches `original_url`; reference images only affected generation, not this step.

  try {
    const provider = getBackgroundRemovalProvider()
    const cutoutService = new CutoutGenerationService(provider, supabase)

    const { data: images, error } = await supabase
      .from('ai_generated_images')
      .select('id, original_url')
      .in('id', imageIds)

    if (error) {
      logger.warn('[ImageGenerationJob] Failed to load images for cutout requests', { jobId: job.id, error })
      return
    }

    for (const image of images || []) {
      await cutoutService.requestCutout({
        imageId: image.id,
        imageUrl: image.original_url,
        userId: job.user_id,
        menuId: job.menu_id!,
        menuItemId: job.menu_item_id,
      })
    }
  } catch (error) {
    logger.warn('[ImageGenerationJob] Cutout request failed; generation remains complete', {
      jobId: job.id,
      error,
    })
  }
}
