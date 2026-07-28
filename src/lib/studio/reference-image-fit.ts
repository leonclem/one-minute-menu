import sharp from 'sharp'

import { logger } from '@/lib/logger'

export interface ReferenceImageForFit {
  /** Base64-encoded image data without a data-URL prefix. */
  data: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  /** The source photograph is identified by this role and is never modified. */
  role?: string
  comment?: string
}

export interface ReferenceImageFitInput {
  ref: ReferenceImageForFit
  subjectPixels: number
  subjectBytes: number
}

const MAX_FIT_ATTEMPTS = 32

function hasPositiveLimit(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function pixelArea(width: number | undefined, height: number | undefined): number | null {
  if (!width || !height) return null
  return width * height
}

function logRejection(
  reason: string,
  ref: ReferenceImageForFit,
  referencePixels: number | null,
  referenceBytes: number,
  subjectPixels: number,
  subjectBytes: number,
): void {
  logger.warn('[Studio reference fit] Rejected reference image that cannot fit the subject limits.', {
    reason,
    mimeType: ref.mimeType,
    role: ref.role,
    referencePixels,
    referenceBytes,
    subjectPixels,
    subjectBytes,
  })
}

/**
 * Fits a non-subject reference within the subject's pixel-area and byte-size limits.
 * Oversized images are re-encoded as PNG after aspect-ratio-preserving downscaling.
 * Returns null and emits a warning when no valid PNG can satisfy both limits.
 */
export async function fitReferenceToSubject({
  ref,
  subjectPixels,
  subjectBytes,
}: ReferenceImageFitInput): Promise<ReferenceImageForFit | null> {
  // The source photograph is the identity anchor. This helper is intentionally
  // safe if a caller accidentally sends it through the style-reference path.
  if (ref.role === 'dish') return ref

  if (!hasPositiveLimit(subjectPixels) || !hasPositiveLimit(subjectBytes)) {
    logRejection('invalid_subject_limits', ref, null, 0, subjectPixels, subjectBytes)
    return null
  }

  try {
    const input = Buffer.from(ref.data, 'base64')
    const metadata = await sharp(input).metadata()
    const originalPixels = pixelArea(metadata.width, metadata.height)

    if (originalPixels === null) {
      logRejection('missing_reference_dimensions', ref, null, input.length, subjectPixels, subjectBytes)
      return null
    }

    if (originalPixels <= subjectPixels && input.length <= subjectBytes) {
      return ref
    }

    const areaScale = Math.sqrt(Math.min(1, subjectPixels / originalPixels))
    const byteScale = Math.sqrt(Math.min(1, subjectBytes / input.length))
    let width = Math.max(1, Math.floor(metadata.width! * Math.min(areaScale, byteScale)))
    let height = Math.max(1, Math.floor(metadata.height! * Math.min(areaScale, byteScale)))

    for (let attempt = 0; attempt < MAX_FIT_ATTEMPTS; attempt += 1) {
      const fittedBuffer = await sharp(input)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
      const fittedMetadata = await sharp(fittedBuffer).metadata()
      const fittedPixels = pixelArea(fittedMetadata.width, fittedMetadata.height)

      if (fittedPixels !== null && fittedPixels <= subjectPixels && fittedBuffer.length <= subjectBytes) {
        return {
          ...ref,
          data: fittedBuffer.toString('base64'),
          mimeType: 'image/png',
        }
      }

      if (width === 1 && height === 1) break

      const pixelScale = fittedPixels && fittedPixels > subjectPixels
        ? Math.sqrt(subjectPixels / fittedPixels)
        : 1
      const outputByteScale = Math.sqrt(Math.min(1, subjectBytes / fittedBuffer.length))
      const nextScale = Math.min(0.85, pixelScale, outputByteScale)
      const nextWidth = Math.max(1, Math.floor(width * nextScale))
      const nextHeight = Math.max(1, Math.floor(height * nextScale))

      if (nextWidth === width && nextHeight === height) break
      width = nextWidth
      height = nextHeight
    }

    logRejection('limits_unreachable_after_downscale', ref, originalPixels, input.length, subjectPixels, subjectBytes)
    return null
  } catch (error) {
    logRejection(
      'reference_processing_failed',
      ref,
      null,
      Buffer.byteLength(ref.data, 'base64'),
      subjectPixels,
      subjectBytes,
    )
    return null
  }
}
