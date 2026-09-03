/**
 * Server-only: EXIF-orient then sharp.extract a normalised crop window.
 */

import sharp from 'sharp'
import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'
import {
  pixelExtractFromNormalized,
  type NormalizedCropRect,
} from '@/lib/studio/crop/geometry'

export class StudioCropRenderError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status = 400) {
    super(message)
    this.name = 'StudioCropRenderError'
    this.code = code
    this.status = status
  }
}

const JPEG_QUALITY = 90

export type CroppedImageBytes = {
  buffer: Buffer
  mimeType: PhotoControlMimeType
  width: number
  height: number
}

/**
 * Apply EXIF orientation first so the window matches the browser-displayed photo.
 */
export async function renderWorkbenchCrop(input: {
  sourceBuffer: Buffer
  sourceMimeType: PhotoControlMimeType
  crop: NormalizedCropRect
}): Promise<CroppedImageBytes> {
  try {
    const oriented = sharp(input.sourceBuffer).rotate()
    const meta = await oriented.metadata()
    const naturalWidth = meta.width
    const naturalHeight = meta.height
    if (!naturalWidth || !naturalHeight) {
      throw new StudioCropRenderError('Could not read this image.', 'CROP_READ_FAILED', 400)
    }

    const natural = { width: naturalWidth, height: naturalHeight }

    const region = pixelExtractFromNormalized(input.crop, natural)
    let pipeline = oriented.clone().extract(region)

    if (input.sourceMimeType === 'image/jpeg') {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4', mozjpeg: true })
    } else if (input.sourceMimeType === 'image/webp') {
      pipeline = pipeline.webp({ quality: JPEG_QUALITY })
    } else {
      pipeline = pipeline.png({ compressionLevel: 9 })
    }

    const buffer = await pipeline.toBuffer()
    return {
      buffer,
      mimeType: input.sourceMimeType,
      width: region.width,
      height: region.height,
    }
  } catch (error) {
    if (error instanceof StudioCropRenderError) throw error
    throw new StudioCropRenderError(
      `Failed to crop image: ${error instanceof Error ? error.message : 'unknown error'}`,
      'CROP_RENDER_FAILED',
      500,
    )
  }
}
