/**
 * Client-side direct upload of studio source images to Supabase Storage.
 * Bypasses Vercel's 4.5 MB request-body limit.
 */

import { supabase } from '@/lib/supabase'
import { validateImageFileForUpload, type AllowedMimeType } from '@/lib/photo-control/image-uploader'
import { buildStudioStoragePath, normalizeStoragePublicUrl, STUDIO_STORAGE_BUCKET } from '@/lib/studio/storage-paths'

export type StudioClientUploadResult =
  | {
      ok: true
      imageId: string
      mimeType: AllowedMimeType
      bytes: number
      publicUrl: string
      storagePath: string
    }
  | { ok: false; error: string }

const UPLOAD_TIMEOUT_MS = 90_000
const CLEANUP_TIMEOUT_MS = 10_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise.then(resolve, reject).finally(() => window.clearTimeout(timeout))
  })
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export async function uploadStudioSourceFile(file: File): Promise<StudioClientUploadResult> {
  const validation = validateImageFileForUpload(file)
  if (!validation.ok) {
    return { ok: false, error: validation.error }
  }

  try {
    // getSession reads the locally persisted session and does not wait for remote
    // validation or token refresh. Storage RLS and the source-registration API
    // both enforce authentication server-side before accepting this upload.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      return { ok: false, error: 'You must be signed in to upload images.' }
    }

    const imageId = crypto.randomUUID()
    const storagePath = buildStudioStoragePath(session.user.id, imageId, validation.mimeType)

    const { error: uploadError } = await withTimeout(
      supabase.storage.from(STUDIO_STORAGE_BUCKET).upload(storagePath, file, {
        contentType: validation.mimeType,
        cacheControl: '31536000',
        upsert: false,
      }),
      UPLOAD_TIMEOUT_MS,
      'The image upload timed out. Check your connection and try again.',
    )

    if (uploadError) {
      return {
        ok: false,
        error: uploadError.message || 'Failed to upload image to storage.',
      }
    }

    const { data: urlData } = supabase.storage
      .from(STUDIO_STORAGE_BUCKET)
      .getPublicUrl(storagePath)
    const publicUrl = normalizeStoragePublicUrl(urlData.publicUrl)

    return {
      ok: true,
      imageId,
      mimeType: validation.mimeType,
      bytes: validation.bytes,
      publicUrl,
      storagePath,
    }
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error, 'Failed to upload image. Refresh and try again.'),
    }
  }
}

export async function removeStudioStorageObject(storagePath: string): Promise<void> {
  try {
    await withTimeout(
      supabase.storage.from(STUDIO_STORAGE_BUCKET).remove([storagePath]),
      CLEANUP_TIMEOUT_MS,
      'Storage cleanup timed out',
    )
  } catch {
    // Cleanup is best effort and must never keep the Studio UI in a busy state.
  }
}
