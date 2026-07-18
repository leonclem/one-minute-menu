/**
 * Photo Studio dish CRUD (Chunk 3).
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type { StudioDishRecord } from '@/lib/studio/types'

export type { StudioDishRecord } from '@/lib/studio/types'

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

/**
 * Delete a dish only when it has no active (non-archived) images.
 * Archived images for the dish are hard-deleted (DB + storage) first.
 */
export async function deleteStudioDish(userId: string, dishId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()

  const { count: activeCount, error: activeError } = await supabase
    .from('studio_images')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('dish_id', dishId)
    .is('archived_at', null)

  if (activeError) {
    throw new Error(`Failed to check dish images: ${activeError.message}`)
  }

  if ((activeCount ?? 0) > 0) {
    throw new Error('Archive or delete all images in this dish before deleting it.')
  }

  const { data: archived, error: listError } = await supabase
    .from('studio_images')
    .select('id, storage_path')
    .eq('user_id', userId)
    .eq('dish_id', dishId)
    .not('archived_at', 'is', null)

  if (listError) {
    throw new Error(`Failed to list archived dish images: ${listError.message}`)
  }

  const paths = (archived ?? []).map((row) => row.storage_path as string).filter(Boolean)
  if (paths.length > 0) {
    await supabase.storage.from('ai-generated-images').remove(paths).catch(() => undefined)
  }

  if ((archived ?? []).length > 0) {
    const { error: wipeError } = await supabase
      .from('studio_images')
      .delete()
      .eq('user_id', userId)
      .eq('dish_id', dishId)

    if (wipeError) {
      throw new Error(`Failed to remove archived images: ${wipeError.message}`)
    }
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
