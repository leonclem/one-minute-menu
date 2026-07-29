/**
 * Photo Control — MutationEngine (Phase B Image Mutation)
 *
 * Dispatches a composed mutation request to the configured Studio Flash model
 * and returns the mutated image as a base64 string along with an optional thought
 * signature for future multi-turn use.
 *
 * Design notes:
 *  - Delegates to `getNanoBananaClient().generateImage(...)` with the source
 *    image passed as an inline base64 reference image with `role: 'dish'`.
 *    (Requirements 10.2, 10.7)
 *  - Resolves the default model through `STUDIO_FLASH_MODEL`, while allowing a
 *    caller override via the `model` parameter. (Requirement 10.2)
 *  - Throws `NanoBananaError` with code `'NO_IMAGE_PRODUCED'` and status 502
 *    when the API returns an empty images array. (Requirement 10.5)
 *  - Exposes `thoughtSignature` in the response payload as a future extension
 *    point for multi-turn reuse. The NanoBananaClient metadata does not
 *    currently carry a thought signature, so it is always `undefined` for now.
 *    (Requirement 16.2)
 *
 * Requirements: 10.2, 10.7, 16.2
 */

import { getNanoBananaClient, NanoBananaError } from '../nano-banana'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import type { NanoBananaParams } from '@/types'
import { logger } from '@/lib/logger'
import {
  configuredStudioImageSize,
  configuredThinkingLevel,
  modelSupportsThinkingLevel,
  referenceLimitForModel,
  STUDIO_FLASH_MODEL,
} from '@/lib/studio/model-config'
import { fitReferenceToSubject } from '@/lib/studio/reference-image-fit'

// ============================================================================
// Types
// ============================================================================

export interface StyleReferenceImage {
  /** Base64-encoded reference image data (no data-URL prefix). */
  data: string
  /** MIME type of the reference image. */
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  /** Role of the reference image. */
  role: 'style' | 'scene' | 'layout' | 'other'
  /** Optional instruction/comment for how the model should use this image. */
  comment?: string
}

/**
 * Input to the mutation engine.
 *
 * `prompt` is the fully composed directive + JSON anchors string produced by
 * `PromptComposer`, bounded to ≤ 2000 characters per the NanoBananaClient
 * budget. (Requirement 10.1)
 */
export interface MutationInput {
  /** Base64-encoded source image data (no data-URL prefix). */
  sourceImageBase64: string
  /** MIME type of the source image. */
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  /** Composed directive + JSON anchors, ≤ 2000 chars. */
  prompt: string
  /** Optional canonical model override (for example, the configured Pro model). */
  model?: string
  /** Optional style reference images (e.g. lighting, background, plating). */
  styleReferences?: StyleReferenceImage[]
  /** Attach static camera-angle steering references when an admin/sandbox caller opts in. */
  includeSteeringImages?: boolean
  /** Internal request discriminator forwarded only by the customer Studio mutation route. */
  request_scope?: 'studio_foh_mutation'
}

/**
 * Output from the mutation engine.
 *
 * `thoughtSignature` is reserved for future multi-turn reuse once the
 * underlying model exposes it. (Requirement 16.2)
 */
export interface MutationOutput {
  /** Base64-encoded mutated image data (no data-URL prefix). */
  imageBase64: string
  /**
   * Gemini thought signature, when returned by the model.
   * Currently always `undefined`; present as an extension point for
   * future multi-turn workflows. (Requirement 16.2)
   */
  thoughtSignature?: string
}

type ReferenceImage = NonNullable<NanoBananaParams['reference_images']>[number]

// ============================================================================
// MutationEngine
// ============================================================================

/**
 * Dispatches a mutation request to the Gemini image generation model via
 * `NanoBananaClient`, passing the source image as an inline base64 reference
 * image with `role: 'dish'`. (Requirements 10.2, 10.7)
 */
export class MutationEngine {
  private steeringImages: ReferenceImage[] = []

  constructor() {
    this.loadSteeringImages()
  }

  /**
   * Load static steering images from the filesystem.
   * These images help guide the model's understanding of camera angles.
   */
  private loadSteeringImages() {
    try {
      const assetsDir = path.join(process.cwd(), 'src', 'assets', 'photo-control')
      
      const tablePath = path.join(assetsDir, 'steering-angle-table.png')
      if (fs.existsSync(tablePath)) {
        this.steeringImages.push({
          data: fs.readFileSync(tablePath).toString('base64'),
          mimeType: 'image/png',
          role: 'style',
          label: 'steering-angle-table.png',
          comment: 'Reference table for industry-standard camera angle terminology and synonyms.',
        })
      }

      const diagramPath = path.join(assetsDir, 'steering-angle-diagram.png')
      if (fs.existsSync(diagramPath)) {
        this.steeringImages.push({
          data: fs.readFileSync(diagramPath).toString('base64'),
          mimeType: 'image/png',
          role: 'layout',
          label: 'steering-angle-diagram.png',
          comment: 'Visual diagram showing the expected camera perspectives for Overhead, 45-Degree, and Eye-Level shots.',
        })
      }
    } catch (err) {
      // Non-blocking: if steering images fail to load, the engine still works without them.
      console.warn('⚠️ [MutationEngine] Failed to load steering images:', err)
    }
  }

  /**
   * Mutates the source image according to the composed prompt.
   *
   * Calls `getNanoBananaClient().generateImage(...)` with:
   *  - `model`: configured Studio Flash default or the caller override (Requirement 10.2)
   *  - `reference_images`: the source image as an inline base64 part with
   *    `role: 'dish'` plus optional steering images. (Requirement 10.7)
   *  - `safety_filter_level`: `'block_some'`
   *  - `person_generation`: `'dont_allow'`
   *  - `number_of_images`: `1`
   *
   * @throws {NanoBananaError} with code `'NO_IMAGE_PRODUCED'` and status 502
   *   when the API returns an empty images array. (Requirement 10.5)
   * @throws {NanoBananaError} for content-policy, safety-filter, rate-limit,
   *   auth, and service errors (propagated from NanoBananaClient).
   */
  async mutate(input: MutationInput): Promise<MutationOutput> {
    const client = getNanoBananaClient()
    const targetModel = input.model || STUDIO_FLASH_MODEL
    const maxRefs = referenceLimitForModel(targetModel)

    const sourceReference: ReferenceImage = {
      mimeType: input.mimeType,
      data: input.sourceImageBase64,
      role: 'dish',
    }
    const candidates: Array<{ image: ReferenceImage; name: string }> = [
      { image: sourceReference, name: 'source photograph' },
    ]

    let subjectLimits: { pixels: number; bytes: number } | null = null
    try {
      const sourceBytes = Buffer.from(input.sourceImageBase64, 'base64')
      const metadata = await sharp(sourceBytes).metadata()
      if (metadata.width && metadata.height) {
        subjectLimits = {
          pixels: metadata.width * metadata.height,
          bytes: sourceBytes.length,
        }
      }
    } catch {
      // Each style-reference drop below is logged with its individual name.
    }

    const isCustomerFohMutation = input.request_scope === 'studio_foh_mutation'

    // Customer FOH carries style intent in the scene descriptor, not in image
    // references. Keep the source as the sole candidate on that path so staged
    // styles and steering images cannot attach regardless of their count.
    if (!isCustomerFohMutation) {
      const styleReferences = input.styleReferences || []
      for (let index = 0; index < styleReferences.length; index += 1) {
        const ref = styleReferences[index]
        const referenceName = ref.comment || `${ref.role} style reference ${index + 1}`
        if (!subjectLimits) {
          logger.warn('[MutationEngine] Dropped reference image because source dimensions could not be read.', {
            referenceName,
            role: ref.role,
            reason: 'subject_metrics_unavailable',
          })
          continue
        }

        const fitted = await fitReferenceToSubject({
          ref,
          subjectPixels: subjectLimits.pixels,
          subjectBytes: subjectLimits.bytes,
        })
        if (!fitted) {
          logger.warn('[MutationEngine] Dropped reference image after it could not fit the source subject.', {
            referenceName,
            role: ref.role,
            reason: 'reference_fit_failed',
          })
          continue
        }

        candidates.push({
          image: {
            mimeType: fitted.mimeType,
            data: fitted.data,
            role: fitted.role,
            comment: fitted.comment,
          },
          name: referenceName,
        })
      }

      // The caller's explicit opt-in, rather than spare cap capacity, decides
      // whether static angle references participate in this request.
      if (input.includeSteeringImages) {
        for (let index = 0; index < this.steeringImages.length; index += 1) {
          const steeringImage = this.steeringImages[index]
          candidates.push({
            image: steeringImage,
            name: steeringImage.label || steeringImage.comment || `steering reference ${index + 1}`,
          })
        }
      }
    }

    const referenceImages = candidates.slice(0, maxRefs).map(({ image }) => image)
    for (const { image, name } of candidates.slice(maxRefs)) {
      logger.warn('[MutationEngine] Dropped reference image because the model reference limit was reached.', {
        referenceName: name,
        role: image.role,
        model: targetModel,
        referenceLimit: maxRefs,
      })
    }

    const result = await client.generateImage({
      prompt: input.prompt,
      model: targetModel, // Requirement 10.2
      reference_images: referenceImages,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      number_of_images: 1,
      image_size: configuredStudioImageSize(),
      request_scope: input.request_scope,
      // Gemini 3 Pro does not support thinkingLevel in generationConfig; only Flash supports it.
      thinking_level: modelSupportsThinkingLevel(targetModel) ? configuredThinkingLevel() : undefined,
    })

    // Guard: the API must return at least one image. (Requirement 10.5)
    if (!result.images || result.images.length === 0) {
      throw new NanoBananaError(
        'Mutation engine produced no image. The model returned an empty images array.',
        'NO_IMAGE_PRODUCED',
        502,
      )
    }

    const imageBase64 = result.images[0]

    // `thoughtSignature` is an extension point for future multi-turn reuse.
    // The NanoBananaClient metadata does not currently carry a thought
    // signature, so it is always undefined here. (Requirement 16.2)
    return {
      imageBase64,
      thoughtSignature: undefined,
    }
  }
}

// ============================================================================
// Singleton factory
// ============================================================================

/** Singleton instance, lazily initialised. */
let mutationEngine: MutationEngine | null = null

/**
 * Returns the shared `MutationEngine` singleton.
 *
 * Mirrors the `getNanoBananaClient()` singleton pattern used throughout the
 * photo-control pipeline.
 */
export function getMutationEngine(): MutationEngine {
  if (!mutationEngine) {
    mutationEngine = new MutationEngine()
  }
  return mutationEngine
}
