/**
 * Shared Supabase Storage path helpers for Photo Studio images.
 */

import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'

export const STUDIO_STORAGE_BUCKET = 'ai-generated-images'

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

export function buildStudioStoragePath(
  userId: string,
  imageId: string,
  mimeType: string,
): string {
  const ext = extensionForMime(mimeType)
  return `${userId}/studio/${imageId}.${ext}`
}

export function assertStudioStoragePathOwnedByUser(storagePath: string, userId: string): void {
  const expectedPrefix = `${userId}/studio/`
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new Error('Storage path does not belong to the authenticated user')
  }
}

export function normalizeStoragePublicUrl(publicUrl: string): string {
  try {
    const url = new URL(publicUrl)
    url.pathname = url.pathname.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch {
    return publicUrl
  }
}

export function isPhotoControlMimeType(value: string): value is PhotoControlMimeType {
  return value === 'image/png' || value === 'image/jpeg' || value === 'image/webp'
}
