/**
 * Photo Control — MutationEngine (Phase B Image Mutation)
 *
 * Dispatches a composed mutation request to the NanoBananaClient, targeting
 * `gemini-3.1-flash-image-preview`, and returns the mutated image as a base64
 * string along with an optional thought signature for future multi-turn use.
 *
 * Design notes:
 *  - Delegates to `getNanoBananaClient().generateImage(...)` with the source
 *    image passed as an inline base64 reference image with `role: 'dish'`.
 *    (Requirements 10.2, 10.7)
 *  - Always targets `gemini-3.1-flash-image-preview` explicitly via the
 *    `model` parameter. (Requirement 10.2)
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
import type { NanoBananaParams } from '@/types'

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
  /** Optional model override (e.g. 'gemini-3.1-pro-preview'). */
  model?: string
  /** Optional style reference images (e.g. lighting, background, plating). */
  styleReferences?: StyleReferenceImage[]
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
          comment: 'Reference table for industry-standard camera angle terminology and synonyms.',
        })
      }

      const diagramPath = path.join(assetsDir, 'steering-angle-diagram.png')
      if (fs.existsSync(diagramPath)) {
        this.steeringImages.push({
          data: fs.readFileSync(diagramPath).toString('base64'),
          mimeType: 'image/png',
          role: 'layout',
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
   *  - `model`: `'gemini-3.1-flash-image-preview'` (Requirement 10.2)
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

    const targetModel = input.model || 'gemini-3.1-flash-image-preview'
    const isPro = targetModel.includes('pro')
    const maxRefs = isPro ? 14 : 3

    const referenceImages: ReferenceImage[] = [
      {
        mimeType: input.mimeType,
        data: input.sourceImageBase64,
        role: 'dish',
      },
    ]

    // Add user-selected style reference images (lighting, background, plating) first.
    // These take priority as they represent explicit user choices.
    if (input.styleReferences && input.styleReferences.length > 0) {
      for (const ref of input.styleReferences) {
        if (referenceImages.length < maxRefs) {
          referenceImages.push({
            mimeType: ref.mimeType,
            data: ref.data,
            role: ref.role,
            comment: ref.comment,
          })
        }
      }
    }

    // Add static steering images as structural alignment guides if there is still room.
    // These help the model break its 45-degree bias by providing explicit
    // visual anchors for the target perspective.
    if (referenceImages.length < maxRefs) {
      for (const steeringImg of this.steeringImages) {
        if (referenceImages.length < maxRefs) {
          referenceImages.push(steeringImg)
        }
      }
    }

    const result = await client.generateImage({
      prompt: input.prompt,
      model: targetModel, // Requirement 10.2
      reference_images: referenceImages,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      number_of_images: 1,
      // Gemini 3 Pro does not support thinkingLevel in generationConfig; only Flash supports it.
      thinking_level: isPro ? undefined : 'high',
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
