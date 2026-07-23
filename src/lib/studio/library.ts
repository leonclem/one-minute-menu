/**
 * Photo Studio per-dish image library helpers (Chunk 3).
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type { StudioImageRecord } from '@/lib/studio/types'

const BUCKET_NAME = 'ai-generated-images'

export async function listStudioImagesForDish(
  userId: string,
  dishId: string,
  options?: { includeArchived?: boolean },
): Promise<StudioImageRecord[]> {
  const supabase = createAdminSupabaseClient()
  let query = supabase
    .from('studio_images')
    .select('*')
    .eq('user_id', userId)
    .eq('dish_id', dishId)
    .order('created_at', { ascending: false })

  if (!options?.includeArchived) {
    query = query.is('archived_at', null)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to list studio images: ${error.message}`)
  }

  return (data ?? []) as StudioImageRecord[]
}

export async function getStudioImage(
  userId: string,
  imageId: string,
): Promise<StudioImageRecord | null> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_images')
    .select('*')
    .eq('user_id', userId)
    .eq('id', imageId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio image: ${error.message}`)
  }

  return (data as StudioImageRecord | null) ?? null
}

/**
 * Mark one image as favourite for its dish; clears other favourites on that dish.
 */
export async function setStudioImageFavourite(
  userId: string,
  imageId: string,
  isFavourite: boolean,
): Promise<StudioImageRecord> {
  const supabase = createAdminSupabaseClient()
  const image = await getStudioImage(userId, imageId)
  if (!image) {
    throw new Error('Image not found')
  }
  if (image.archived_at) {
    throw new Error('Cannot favourite an archived image')
  }
  if (!image.dish_id) {
    throw new Error('Image is not assigned to a dish')
  }

  if (isFavourite) {
    const { error: clearError } = await supabase
      .from('studio_images')
      .update({ is_favourite: false })
      .eq('user_id', userId)
      .eq('dish_id', image.dish_id)
      .eq('is_favourite', true)

    if (clearError) {
      throw new Error(`Failed to clear previous favourite: ${clearError.message}`)
    }
  }

  const { data, error } = await supabase
    .from('studio_images')
    .update({ is_favourite: isFavourite })
    .eq('user_id', userId)
    .eq('id', imageId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to update favourite: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioImageRecord
}

export async function updateStudioImageMetadata(
  userId: string,
  imageId: string,
  metadataPatch: Record<string, unknown>,
): Promise<StudioImageRecord> {
  const supabase = createAdminSupabaseClient()
  const image = await getStudioImage(userId, imageId)
  if (!image) {
    throw new Error('Image not found')
  }

  const nextMetadata = {
    ...(image.metadata ?? {}),
    ...metadataPatch,
  }

  const { data, error } = await supabase
    .from('studio_images')
    .update({ metadata: nextMetadata })
    .eq('user_id', userId)
    .eq('id', imageId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to update image metadata: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioImageRecord
}

export async function archiveStudioImage(
  userId: string,
  imageId: string,
): Promise<StudioImageRecord> {
  const supabase = createAdminSupabaseClient()
  const image = await getStudioImage(userId, imageId)
  if (!image) {
    throw new Error('Image not found')
  }

  const { data, error } = await supabase
    .from('studio_images')
    .update({
      archived_at: new Date().toISOString(),
      is_favourite: false,
    })
    .eq('user_id', userId)
    .eq('id', imageId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to archive image: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioImageRecord
}

/**
 * Hard-delete an image. Blocks if non-archived generated children still reference it.
 */
export async function deleteStudioImage(userId: string, imageId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const image = await getStudioImage(userId, imageId)
  if (!image) {
    throw new Error('Image not found')
  }

  if (image.role === 'source') {
    const { count, error: childError } = await supabase
      .from('studio_images')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_image_id', imageId)
      .is('archived_at', null)

    if (childError) {
      throw new Error(`Failed to check dependent images: ${childError.message}`)
    }

    if ((count ?? 0) > 0) {
      throw new Error(
        'Archive or delete generated variants that use this image before deleting it.',
      )
    }
  }

  // Clear source_image_id on all children so FK does not block delete
  await supabase
    .from('studio_images')
    .update({ source_image_id: null })
    .eq('user_id', userId)
    .eq('source_image_id', imageId)

  const { error: deleteError } = await supabase
    .from('studio_images')
    .delete()
    .eq('user_id', userId)
    .eq('id', imageId)

  if (deleteError) {
    throw new Error(`Failed to delete image: ${deleteError.message}`)
  }

  await supabase.storage.from(BUCKET_NAME).remove([image.storage_path]).catch(() => undefined)
}
