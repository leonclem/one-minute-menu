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
    return toBrowserPublicUrl(url.toString())
  } catch {
    return publicUrl
  }
}

/**
 * Rewrite an internal storage host to the browser-facing Supabase origin.
 *
 * The Railway/Docker worker reaches Supabase over `host.docker.internal` (or an
 * explicit internal URL), so public URLs it builds are not loadable from a
 * browser. Mirrors the cut-out pipeline's handling of the same problem.
 */
export function toBrowserPublicUrl(publicUrl: string): string {
  const browserBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!browserBase) return publicUrl

  try {
    const browser = new URL(browserBase)
    const target = new URL(publicUrl)

    const internalOrigins = [
      process.env.SUPABASE_INTERNAL_URL,
      process.env.WORKER_SUPABASE_URL,
    ]
      .map((value) => {
        try {
          return value ? new URL(value).origin : null
        } catch {
          return null
        }
      })
      .filter((origin): origin is string => origin !== null)

    const isInternal =
      target.hostname === 'host.docker.internal' ||
      target.hostname === 'localhost' ||
      target.hostname === '127.0.0.1' ||
      internalOrigins.includes(target.origin)

    if (isInternal) {
      target.protocol = browser.protocol
      target.host = browser.host
    }

    return target.toString()
  } catch {
    return publicUrl
  }
}

export function isPhotoControlMimeType(value: string): value is PhotoControlMimeType {
  return value === 'image/png' || value === 'image/jpeg' || value === 'image/webp'
}
