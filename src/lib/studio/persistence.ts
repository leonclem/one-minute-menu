/**
 * Persist Photo Studio images to Supabase Storage + studio_images.
 */

import { randomUUID } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type { StudioImageRecord, StudioImageRole } from '@/lib/studio/types'

export type { StudioImageRecord, StudioImageRole } from '@/lib/studio/types'

const BUCKET_NAME = 'ai-generated-images'

export interface PersistStudioImageInput {
  userId: string
  role: StudioImageRole
  /** Raw base64 (no data-URL prefix). */
  imageBase64: string
  mimeType: string
  sourceImageId?: string | null
  prompt?: string | null
  model?: string | null
  metadata?: Record<string, unknown>
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

function normalizeStoragePublicUrl(publicUrl: string): string {
  try {
    const url = new URL(publicUrl)
    // Keep path as returned; only normalize accidental double slashes in pathname.
    url.pathname = url.pathname.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch {
    return publicUrl
  }
}

/**
 * Upload image bytes to `{userId}/studio/{imageId}.{ext}` and insert a studio_images row.
 * Uses the service-role client (caller must already have authenticated the user).
 */
export async function persistStudioImage(
  input: PersistStudioImageInput,
): Promise<StudioImageRecord> {
  const supabase = createAdminSupabaseClient()
  const imageId = randomUUID()
  const ext = extensionForMime(input.mimeType)
  const storagePath = `${input.userId}/studio/${imageId}.${ext}`
  const buffer = Buffer.from(input.imageBase64, 'base64')

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: input.mimeType,
      cacheControl: '31536000',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload studio image: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
  const publicUrl = normalizeStoragePublicUrl(urlData.publicUrl)

  const row = {
    id: imageId,
    user_id: input.userId,
    role: input.role,
    source_image_id: input.sourceImageId ?? null,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: input.mimeType,
    width: null as number | null,
    height: null as number | null,
    prompt: input.prompt ?? null,
    model: input.model ?? null,
    metadata: input.metadata ?? {},
  }

  const { data, error: insertError } = await supabase
    .from('studio_images')
    .insert(row)
    .select('*')
    .single()

  if (insertError || !data) {
    // Best-effort cleanup of the orphaned storage object
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]).catch(() => undefined)
    throw new Error(`Failed to insert studio image row: ${insertError?.message ?? 'unknown'}`)
  }

  return data as StudioImageRecord
}

export function getStudioDailyGenerationLimit(): number {
  const raw = process.env.STUDIO_DAILY_GENERATION_LIMIT
  const parsed = raw ? Number.parseInt(raw, 10) : 25
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25
}

/**
 * Count generated studio images created by the user since UTC midnight today.
 */
export async function countTodayGeneratedStudioImages(userId: string): Promise<number> {
  const supabase = createAdminSupabaseClient()
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('studio_images')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'generated')
    .gte('created_at', startOfDay.toISOString())

  if (error) {
    throw new Error(`Failed to count daily studio generations: ${error.message}`)
  }

  return count ?? 0
}
