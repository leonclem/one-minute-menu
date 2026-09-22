import { createAdminSupabaseClient } from '@/lib/supabase-server'
import {
  buildStudioStoragePath,
  normalizeStoragePublicUrl,
  STUDIO_STORAGE_BUCKET,
} from '@/lib/studio/storage-paths'
import { logger } from '@/lib/logger'

type ClaimRow = {
  guest_user_id: string | null
  claimed: boolean
}

function extensionFromPath(storagePath: string): string {
  const match = storagePath.match(/\.([a-z0-9]+)$/i)
  return match?.[1]?.toLowerCase() ?? 'png'
}

function mimeFromExtension(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

async function rewriteGuestStoragePaths(guestUserId: string, verifiedUserId: string): Promise<void> {
  const admin = createAdminSupabaseClient()
  const { data: images, error } = await admin
    .from('studio_images')
    .select('id, storage_path, mime_type')
    .eq('user_id', verifiedUserId)
    .like('storage_path', `${guestUserId}/studio/%`)

  if (error) {
    throw new Error(`Failed to list guest images for storage move: ${error.message}`)
  }

  for (const image of images ?? []) {
    const ext = extensionFromPath(image.storage_path)
    const mimeType = image.mime_type || mimeFromExtension(ext)
    const nextPath = buildStudioStoragePath(verifiedUserId, image.id, mimeType)

    const { error: moveError } = await admin.storage
      .from(STUDIO_STORAGE_BUCKET)
      .move(image.storage_path, nextPath)

    if (moveError) {
      logger.warn('[studio-guest] Storage move failed; leaving original path', {
        imageId: image.id,
        from: image.storage_path,
        error: moveError.message,
      })
      continue
    }

    const { data: urlData } = admin.storage.from(STUDIO_STORAGE_BUCKET).getPublicUrl(nextPath)
    await admin
      .from('studio_images')
      .update({
        storage_path: nextPath,
        public_url: normalizeStoragePublicUrl(urlData.publicUrl),
      })
      .eq('id', image.id)
      .eq('user_id', verifiedUserId)
  }
}

export async function claimGuestStudioWork(input: {
  claimToken: string
  verifiedUserId: string
}): Promise<{ claimed: boolean; guestUserId: string | null }> {
  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.rpc('studio_claim_guest_work', {
    p_claim_token: input.claimToken,
    p_verified_user_id: input.verifiedUserId,
  })

  if (error) {
    throw new Error(`Guest claim failed: ${error.message}`)
  }

  const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | null
  const guestUserId = row?.guest_user_id ?? null
  const claimed = Boolean(row?.claimed)

  if (!claimed || !guestUserId || guestUserId === input.verifiedUserId) {
    return { claimed, guestUserId }
  }

  await rewriteGuestStoragePaths(guestUserId, input.verifiedUserId)

  const { error: deleteError } = await admin.auth.admin.deleteUser(guestUserId)
  if (deleteError) {
    logger.warn('[studio-guest] Failed to delete claimed guest user', {
      guestUserId,
      error: deleteError.message,
    })
  }

  return { claimed: true, guestUserId }
}
