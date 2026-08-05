/**
 * Photo Studio dish CRUD (Chunk 3).
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { STUDIO_STORAGE_BUCKET } from '@/lib/studio/storage-paths'
import type { StudioDishListItem, StudioDishRecord } from '@/lib/studio/types'

export type { StudioDishListItem, StudioDishRecord } from '@/lib/studio/types'

const DEFAULT_DISH_NAME = 'My dishes'

function normalizeDishName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 200)
}

export async function listStudioDishes(userId: string): Promise<StudioDishRecord[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_dishes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to list studio dishes: ${error.message}`)
  }

  return (data ?? []) as StudioDishRecord[]
}

/**
 * List dishes with Current variant public URLs for the dish picker modal.
 */
export async function listStudioDishesWithThumbnails(
  userId: string,
): Promise<StudioDishListItem[]> {
  const dishes = await listStudioDishes(userId)
  if (dishes.length === 0) return []

  const currentIds = dishes
    .map((d) => d.current_image_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const urlById = new Map<string, string>()
  if (currentIds.length > 0) {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('studio_images')
      .select('id, public_url')
      .eq('user_id', userId)
      .in('id', currentIds)

    if (error) {
      throw new Error(`Failed to load dish thumbnails: ${error.message}`)
    }

    for (const row of data ?? []) {
      urlById.set(row.id as string, row.public_url as string)
    }
  }

  return dishes.map((dish) => ({
    ...dish,
    current_image_url: dish.current_image_id
      ? (urlById.get(dish.current_image_id) ?? null)
      : null,
  }))
}

/**
 * Ensure the user has at least one dish. Creates "My dishes" if none exist.
 */
export async function ensureDefaultStudioDish(userId: string): Promise<StudioDishRecord> {
  const existing = await listStudioDishes(userId)
  if (existing.length > 0) return existing[0]

  return createStudioDish(userId, DEFAULT_DISH_NAME)
}

export async function createStudioDish(
  userId: string,
  name: string,
  description?: string | null,
): Promise<StudioDishRecord> {
  const normalized = normalizeDishName(name)
  if (!normalized) {
    throw new Error('Dish name is required')
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_dishes')
    .insert({
      user_id: userId,
      name: normalized,
      description: description?.trim() || null,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create studio dish: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioDishRecord
}

export async function getStudioDish(
  userId: string,
  dishId: string,
): Promise<StudioDishRecord | null> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_dishes')
    .select('*')
    .eq('user_id', userId)
    .eq('id', dishId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio dish: ${error.message}`)
  }

  return (data as StudioDishRecord | null) ?? null
}

export async function renameStudioDish(
  userId: string,
  dishId: string,
  name: string,
): Promise<StudioDishRecord> {
  const normalized = normalizeDishName(name)
  if (!normalized) {
    throw new Error('Dish name is required')
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_dishes')
    .update({ name: normalized, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', dishId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to rename studio dish: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioDishRecord
}

export async function setStudioDishCurrentImage(
  userId: string,
  dishId: string,
  imageId: string | null,
): Promise<StudioDishRecord> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_dishes')
    .update({
      current_image_id: imageId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', dishId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to set current image: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioDishRecord
}

export interface StudioDishDeletionSummary {
  imageCount: number
  exportVariantCount: number
}

interface StudioDishAssets {
  imageCount: number
  imagePaths: string[]
  exportVariantCount: number
  exportPaths: string[]
}

async function getStudioDishAssets(userId: string, dishId: string): Promise<StudioDishAssets> {
  const supabase = createAdminSupabaseClient()
  const [imagesResult, exportsResult] = await Promise.all([
    supabase
      .from('studio_images')
      .select('id, storage_path')
      .eq('user_id', userId)
      .eq('dish_id', dishId),
    supabase
      .from('studio_export_variants')
      .select('id, storage_path')
      .eq('user_id', userId)
      .eq('dish_id', dishId),
  ])

  if (imagesResult.error) {
    throw new Error(`Failed to list dish images: ${imagesResult.error.message}`)
  }
  if (exportsResult.error) {
    throw new Error(`Failed to list dish export variants: ${exportsResult.error.message}`)
  }

  return {
    imageCount: (imagesResult.data ?? []).length,
    imagePaths: (imagesResult.data ?? [])
      .map((row) => row.storage_path as string | null)
      .filter((path): path is string => Boolean(path)),
    exportVariantCount: (exportsResult.data ?? []).length,
    exportPaths: (exportsResult.data ?? [])
      .map((row) => row.storage_path as string | null)
      .filter((path): path is string => Boolean(path)),
  }
}

/** Return the assets that will be permanently removed with a dish. */
export async function getStudioDishDeletionSummary(
  userId: string,
  dishId: string,
): Promise<StudioDishDeletionSummary> {
  const assets = await getStudioDishAssets(userId, dishId)
  return {
    imageCount: assets.imageCount,
    exportVariantCount: assets.exportVariantCount,
  }
}

/**
 * Permanently remove a dish and every image and export variant it owns.
 * Export rows must be removed before images so their storage paths can be
 * cleaned up before their foreign-key cascade deletes the database rows.
 */
export async function deleteStudioDish(userId: string, dishId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { imagePaths, exportPaths } = await getStudioDishAssets(userId, dishId)

  const storagePaths = Array.from(new Set([...imagePaths, ...exportPaths]))
  if (storagePaths.length > 0) {
    await supabase.storage.from(STUDIO_STORAGE_BUCKET).remove(storagePaths).catch(() => undefined)
  }

  const { error: exportsError } = await supabase
    .from('studio_export_variants')
    .delete()
    .eq('user_id', userId)
    .eq('dish_id', dishId)

  if (exportsError) {
    throw new Error(`Failed to remove dish export variants: ${exportsError.message}`)
  }

  const { error: imagesError } = await supabase
    .from('studio_images')
    .delete()
    .eq('user_id', userId)
    .eq('dish_id', dishId)

  if (imagesError) {
    throw new Error(`Failed to remove dish images: ${imagesError.message}`)
  }

  const { error: deleteError } = await supabase
    .from('studio_dishes')
    .delete()
    .eq('user_id', userId)
    .eq('id', dishId)

  if (deleteError) {
    throw new Error(`Failed to delete studio dish: ${deleteError.message}`)
  }
}

export async function touchStudioDish(userId: string, dishId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  await supabase
    .from('studio_dishes')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', dishId)
}
