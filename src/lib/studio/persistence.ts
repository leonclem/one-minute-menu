/**
 * Persist Photo Studio images to Supabase Storage + studio_images.
 */

import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { touchStudioDish } from '@/lib/studio/dishes'
import { downloadStudioStorageObject, StudioImageLoadError } from '@/lib/studio/image-bytes'
import {
  buildStudioStoragePath,
  normalizeStoragePublicUrl,
  STUDIO_STORAGE_BUCKET,
} from '@/lib/studio/storage-paths'
import type { StudioImageRecord, StudioImageRole } from '@/lib/studio/types'

export type { StudioImageRecord, StudioImageRole } from '@/lib/studio/types'

export interface PersistStudioImageInput {
  userId: string
  dishId: string
  role: StudioImageRole
  /** Raw base64 (no data-URL prefix). */
  imageBase64: string
  mimeType: string
  sourceImageId?: string | null
  prompt?: string | null
  model?: string | null
  metadata?: Record<string, unknown>
}

export interface RegisterStudioSourceImageInput {
  userId: string
  dishId: string
  imageId: string
  mimeType: string
}

/**
 * Register a source image the client uploaded directly to Supabase Storage.
 */
/**
 * Measure an image without letting a decode failure block persistence.
 * Dimensions drive export-variant credit quotes, so they are recorded up front.
 */
async function readImageDimensions(
  buffer: Buffer,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(buffer).metadata()
    return { width: meta.width ?? null, height: meta.height ?? null }
  } catch {
    return { width: null, height: null }
  }
}

export async function registerStudioSourceImage(
  input: RegisterStudioSourceImageInput,
): Promise<StudioImageRecord> {
  if (!input.dishId) {
    throw new Error('dishId is required')
  }

  const storagePath = buildStudioStoragePath(input.userId, input.imageId, input.mimeType)
  const { buffer } = await downloadStudioStorageObject(storagePath, input.userId)
  const dimensions = await readImageDimensions(buffer)

  const supabase = createAdminSupabaseClient()
  const { data: urlData } = supabase.storage.from(STUDIO_STORAGE_BUCKET).getPublicUrl(storagePath)
  const publicUrl = normalizeStoragePublicUrl(urlData.publicUrl)

  const row = {
    id: input.imageId,
    user_id: input.userId,
    dish_id: input.dishId,
    role: 'source' as const,
    source_image_id: null,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: input.mimeType,
    width: dimensions.width,
    height: dimensions.height,
    prompt: null,
    model: null,
    metadata: {},
    is_favourite: false,
    archived_at: null as string | null,
  }

  const { data, error: insertError } = await supabase
    .from('studio_images')
    .insert(row)
    .select('*')
    .single()

  if (insertError || !data) {
    await supabase.storage.from(STUDIO_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined)
    throw new Error(`Failed to insert studio image row: ${insertError?.message ?? 'unknown'}`)
  }

  await touchStudioDish(input.userId, input.dishId).catch(() => undefined)

  return data as StudioImageRecord
}

/**
 * Upload image bytes to `{userId}/studio/{imageId}.{ext}` and insert a studio_images row.
 * Uses the service-role client (caller must already have authenticated the user).
 */
export async function persistStudioImage(
  input: PersistStudioImageInput,
): Promise<StudioImageRecord> {
  if (!input.dishId) {
    throw new Error('dishId is required')
  }

  const supabase = createAdminSupabaseClient()
  const imageId = randomUUID()
  const storagePath = buildStudioStoragePath(input.userId, imageId, input.mimeType)
  const buffer = Buffer.from(input.imageBase64, 'base64')
  const dimensions = await readImageDimensions(buffer)

  const { error: uploadError } = await supabase.storage
    .from(STUDIO_STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: input.mimeType,
      cacheControl: '31536000',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload studio image: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from(STUDIO_STORAGE_BUCKET).getPublicUrl(storagePath)
  const publicUrl = normalizeStoragePublicUrl(urlData.publicUrl)

  const row = {
    id: imageId,
    user_id: input.userId,
    dish_id: input.dishId,
    role: input.role,
    source_image_id: input.sourceImageId ?? null,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: input.mimeType,
    width: dimensions.width,
    height: dimensions.height,
    prompt: input.prompt ?? null,
    model: input.model ?? null,
    metadata: input.metadata ?? {},
    is_favourite: false,
    archived_at: null as string | null,
  }

  const { data, error: insertError } = await supabase
    .from('studio_images')
    .insert(row)
    .select('*')
    .single()

  if (insertError || !data) {
    await supabase.storage.from(STUDIO_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined)
    throw new Error(`Failed to insert studio image row: ${insertError?.message ?? 'unknown'}`)
  }

  await touchStudioDish(input.userId, input.dishId).catch(() => undefined)

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

export { StudioImageLoadError }
