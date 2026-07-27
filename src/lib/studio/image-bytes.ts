/**
 * Load studio image bytes from Supabase Storage for server-side Gemini calls.
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import {
  PHOTO_CONTROL_MAX_IMAGE_BYTES,
  PHOTO_CONTROL_MAX_IMAGE_MB,
  type PhotoControlMimeType,
} from '@/lib/photo-control/request-validation'
import { getStudioImage } from '@/lib/studio/library'
import {
  STUDIO_STORAGE_BUCKET,
  assertStudioStoragePathOwnedByUser,
  isPhotoControlMimeType,
} from '@/lib/studio/storage-paths'

export class StudioImageLoadError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'StudioImageLoadError'
    this.status = status
  }
}

export interface StudioImageBytes {
  mimeType: PhotoControlMimeType
  base64: string
  byteLength: number
}

/**
 * Fetch a studio image the user owns, enforce the size limit, return base64 for Gemini.
 */
export async function loadStudioImageBytes(
  userId: string,
  imageId: string,
): Promise<StudioImageBytes> {
  const image = await getStudioImage(userId, imageId)
  if (!image) {
    throw new StudioImageLoadError('Image not found', 404)
  }

  assertStudioStoragePathOwnedByUser(image.storage_path, userId)

  if (!isPhotoControlMimeType(image.mime_type)) {
    throw new StudioImageLoadError('Invalid image MIME type stored for studio image', 400)
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage
    .from(STUDIO_STORAGE_BUCKET)
    .download(image.storage_path)

  if (error || !data) {
    throw new StudioImageLoadError(
      error?.message ?? 'Failed to download studio image from storage',
      404,
    )
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  if (buffer.length > PHOTO_CONTROL_MAX_IMAGE_BYTES) {
    throw new StudioImageLoadError(
      `Image exceeds the ${PHOTO_CONTROL_MAX_IMAGE_MB} MB size limit`,
      400,
    )
  }

  return {
    mimeType: image.mime_type,
    base64: buffer.toString('base64'),
    byteLength: buffer.length,
  }
}

/**
 * Download bytes at an expected storage path (used when registering a client upload).
 */
export async function downloadStudioStorageObject(
  storagePath: string,
  userId: string,
): Promise<{ buffer: Buffer; byteLength: number }> {
  assertStudioStoragePathOwnedByUser(storagePath, userId)

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage
    .from(STUDIO_STORAGE_BUCKET)
    .download(storagePath)

  if (error || !data) {
    throw new StudioImageLoadError(
      error?.message ?? 'Uploaded image not found in storage',
      404,
    )
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  if (buffer.length > PHOTO_CONTROL_MAX_IMAGE_BYTES) {
    throw new StudioImageLoadError(
      `Image exceeds the ${PHOTO_CONTROL_MAX_IMAGE_MB} MB size limit`,
      400,
    )
  }

  if (buffer.length === 0) {
    throw new StudioImageLoadError('Uploaded image is empty', 400)
  }

  return { buffer, byteLength: buffer.length }
}
