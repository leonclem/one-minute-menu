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

export async function uploadStudioSourceFile(file: File): Promise<StudioClientUploadResult> {
  const validation = validateImageFileForUpload(file)
  if (!validation.ok) {
    return { ok: false, error: validation.error }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: 'You must be signed in to upload images.' }
  }

  const imageId = crypto.randomUUID()
  const storagePath = buildStudioStoragePath(user.id, imageId, validation.mimeType)

  const { error: uploadError } = await supabase.storage
    .from(STUDIO_STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: validation.mimeType,
      cacheControl: '31536000',
      upsert: false,
    })

  if (uploadError) {
    return {
      ok: false,
      error: uploadError.message || 'Failed to upload image to storage.',
    }
  }

  const { data: urlData } = supabase.storage.from(STUDIO_STORAGE_BUCKET).getPublicUrl(storagePath)
  const publicUrl = normalizeStoragePublicUrl(urlData.publicUrl)

  return {
    ok: true,
    imageId,
    mimeType: validation.mimeType,
    bytes: validation.bytes,
    publicUrl,
    storagePath,
  }
}

export async function removeStudioStorageObject(storagePath: string): Promise<void> {
  await supabase.storage.from(STUDIO_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined)
}
