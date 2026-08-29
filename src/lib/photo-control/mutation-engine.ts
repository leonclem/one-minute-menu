/**
 * Photo Control — MutationEngine (Phase B Image Mutation)
 *
 * Dispatches a composed mutation request to Gemini through NanoBananaClient.
 * Customer Studio scopes are isolated from sandbox style/steering references.
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { getNanoBananaClient, NanoBananaError } from '../nano-banana'
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
import { detectStudioImageMimeType } from '@/lib/studio/image-format'
import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'

export interface StyleReferenceImage {
  data: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  role: 'style' | 'scene' | 'layout' | 'other'
  comment?: string
}

export interface AnnotationReferenceImage {
  /** The server-rendered annotated Image B. */
  data: string
  mimeType: 'image/png'
}

interface MutationBaseInput {
  /** Base64-encoded clean source image data (no data-URL prefix). */
  sourceImageBase64: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  /** Fully composed instruction, bounded by the NanoBananaClient budget. */
  prompt: string
  model?: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '4:5'
}

/** Existing Studio and sandbox mutation contract. */
export interface LegacyMutationInput extends MutationBaseInput {
  styleReferences?: StyleReferenceImage[]
  includeSteeringImages?: boolean
  request_scope?: 'studio_foh_mutation'
}

/**
 * Object edits have exactly two image inputs: clean source Image A followed by
 * the server-rendered annotation Image B. Style and steering references cannot
 * be supplied to this scope.
 */
export interface ObjectEditMutationInput extends MutationBaseInput {
  request_scope: 'studio_object_edit'
  annotationReference: AnnotationReferenceImage
  styleReferences?: never
  includeSteeringImages?: never
}

export type MutationInput = LegacyMutationInput | ObjectEditMutationInput

function isObjectEditMutationInput(input: MutationInput): input is ObjectEditMutationInput {
  return input.request_scope === 'studio_object_edit'
}

export interface MutationOutput {
  imageBase64: string
  /** Detected from the returned bytes; null if the provider returned an unsupported container. */
  mimeType: PhotoControlMimeType | null
  /** Provider's inlineData MIME claim, retained only for diagnostics and persistence auditing. */
  providerMimeType: string | null
  thoughtSignature?: string
  /** Provider-reported identity only; never a configured fallback. */
  providerModelIdentity: string | null
}

type ReferenceImage = NonNullable<NanoBananaParams['reference_images']>[number]
type ReferenceCandidate = { image: ReferenceImage; name: string }

export class MutationEngine {
  private steeringImages: ReferenceImage[] = []

  constructor() {
    this.loadSteeringImages()
  }

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
      console.warn('⚠️ [MutationEngine] Failed to load steering images:', err)
    }
  }

  async mutate(input: MutationInput): Promise<MutationOutput> {
    const client = getNanoBananaClient()
    const targetModel = input.model || STUDIO_FLASH_MODEL
    const maxRefs = referenceLimitForModel(targetModel)
    const sourceReference: ReferenceImage = {
      mimeType: input.mimeType,
      data: input.sourceImageBase64,
      role: 'dish',
    }
    const isCustomerFohMutation = input.request_scope === 'studio_foh_mutation'
    let candidates: ReferenceCandidate[]

    if (isObjectEditMutationInput(input)) {
      const untypedObjectEditInput = input as unknown as {
        styleReferences?: unknown
        includeSteeringImages?: unknown
      }
      if (
        untypedObjectEditInput.styleReferences !== undefined ||
        untypedObjectEditInput.includeSteeringImages !== undefined
      ) {
        throw new NanoBananaError(
          'Object-edit generation accepts only the clean source and annotation reference images.',
          'INVALID_PARAMS',
          400,
        )
      }
      if (!input.annotationReference?.data || input.annotationReference.mimeType !== 'image/png') {
        throw new NanoBananaError(
          'Object-edit generation requires one PNG annotation reference image.',
          'INVALID_PARAMS',
          400,
        )
      }
      if (maxRefs < 2) {
        throw new NanoBananaError(
          `The selected model supports only ${maxRefs} reference image(s); object edits require two.`,
          'INVALID_PARAMS',
          400,
        )
      }

      candidates = [
        { image: sourceReference, name: 'clean source image' },
        {
          image: {
            mimeType: input.annotationReference.mimeType,
            data: input.annotationReference.data,
            role: 'other',
          },
          name: 'annotated reference image',
        },
      ]
    } else {
      const styleReferences = input.styleReferences || []
      const includeSteeringImages = Boolean(input.includeSteeringImages)
      candidates = [{ image: sourceReference, name: 'source photograph' }]
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

      // FOH style intent remains in its descriptor. Its one-source behavior is
      // intentionally preserved while sandbox callers retain their legacy path.
      if (!isCustomerFohMutation) {
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

        if (includeSteeringImages) {
          for (let index = 0; index < this.steeringImages.length; index += 1) {
            const steeringImage = this.steeringImages[index]
            candidates.push({
              image: steeringImage,
              name: steeringImage.label || steeringImage.comment || `steering reference ${index + 1}`,
            })
          }
        }
      }
    }

    // Object-edit capacity was checked above, so this preserves A/B exactly.
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
      model: targetModel,
      reference_images: referenceImages,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      number_of_images: 1,
      image_size: configuredStudioImageSize(),
      aspect_ratio: input.aspectRatio,
      request_scope: input.request_scope,
      thinking_level: modelSupportsThinkingLevel(targetModel) ? configuredThinkingLevel() : undefined,
    })

    if (!result.images || result.images.length === 0) {
      throw new NanoBananaError(
        'Mutation engine produced no image. The model returned an empty images array.',
        'NO_IMAGE_PRODUCED',
        502,
      )
    }

    const imageBase64 = result.images[0]
    // `imageMimeTypes` was added after the initial client contract. Treat its
    // absence as an unknown provider claim so alternate/test clients remain
    // compatible while the byte container stays authoritative.
    const providerMimeType = result.imageMimeTypes?.[0] ?? null
    const mimeType = detectStudioImageMimeType(Buffer.from(imageBase64, 'base64'))
    if (providerMimeType !== mimeType) {
      logger.warn('Provider image MIME claim differs from the returned byte container', {
        providerMimeType,
        detectedMimeType: mimeType,
        requestScope: input.request_scope ?? 'unspecified',
      })
    }

    return {
      imageBase64,
      mimeType,
      providerMimeType,
      thoughtSignature: undefined,
      providerModelIdentity: result.metadata.providerModelIdentity,
    }
  }
}

let mutationEngine: MutationEngine | null = null

export function getMutationEngine(): MutationEngine {
  if (!mutationEngine) {
    mutationEngine = new MutationEngine()
  }
  return mutationEngine
}
