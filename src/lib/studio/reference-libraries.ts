/**
 * Photo Studio lighting + background reference libraries (Chunk 4).
 *
 * Display helpers omit prompt_fragment / negative_constraints.
 * Resolve helpers return full rows for server-side directive composition.
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type {
  StudioBackgroundCategory,
  StudioBackgroundStyleDisplay,
  StudioBackgroundStyleRecord,
  StudioLightingStyleDisplay,
  StudioLightingStyleRecord,
} from '@/lib/studio/types'

export type {
  StudioBackgroundCategory,
  StudioBackgroundStyleDisplay,
  StudioBackgroundStyleRecord,
  StudioLightingStyleDisplay,
  StudioLightingStyleRecord,
} from '@/lib/studio/types'

const LIGHTING_DISPLAY_COLUMNS =
  'id, key, name, short_description, thumbnail_path, sort_order'

const BACKGROUND_DISPLAY_COLUMNS =
  'id, key, name, short_description, category, thumbnail_path, is_premium, sort_order'

const LIGHTING_FULL_COLUMNS = `${LIGHTING_DISPLAY_COLUMNS}, prompt_fragment, negative_constraints, is_active, created_at, updated_at`

const BACKGROUND_FULL_COLUMNS = `${BACKGROUND_DISPLAY_COLUMNS}, prompt_fragment, negative_constraints, is_active, created_at, updated_at`

function normalizeKey(key: string): string | null {
  const trimmed = key.trim().toLowerCase().replace(/\s+/g, '-')
  if (!trimmed || trimmed.length > 80) return null
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) return null
  return trimmed
}

function normalizeName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 120)
}

export async function listActiveLightingStyles(): Promise<StudioLightingStyleDisplay[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_lighting_styles')
    .select(LIGHTING_DISPLAY_COLUMNS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to list lighting styles: ${error.message}`)
  }

  return (data ?? []) as StudioLightingStyleDisplay[]
}

export async function listActiveBackgroundStyles(): Promise<StudioBackgroundStyleDisplay[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_background_styles')
    .select(BACKGROUND_DISPLAY_COLUMNS)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to list background styles: ${error.message}`)
  }

  return (data ?? []) as StudioBackgroundStyleDisplay[]
}

export async function resolveLightingStyle(
  key: string,
): Promise<StudioLightingStyleRecord | null> {
  const normalized = key.trim()
  if (!normalized) return null

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_lighting_styles')
    .select(LIGHTING_FULL_COLUMNS)
    .eq('key', normalized)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve lighting style: ${error.message}`)
  }

  return (data as StudioLightingStyleRecord | null) ?? null
}

export async function resolveBackgroundStyle(
  key: string,
): Promise<StudioBackgroundStyleRecord | null> {
  const normalized = key.trim()
  if (!normalized) return null

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_background_styles')
    .select(BACKGROUND_FULL_COLUMNS)
    .eq('key', normalized)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve background style: ${error.message}`)
  }

  return (data as StudioBackgroundStyleRecord | null) ?? null
}

export async function listAllLightingStyles(): Promise<StudioLightingStyleRecord[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_lighting_styles')
    .select(LIGHTING_FULL_COLUMNS)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to list all lighting styles: ${error.message}`)
  }

  return (data ?? []) as StudioLightingStyleRecord[]
}

export async function listAllBackgroundStyles(): Promise<StudioBackgroundStyleRecord[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_background_styles')
    .select(BACKGROUND_FULL_COLUMNS)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to list all background styles: ${error.message}`)
  }

  return (data ?? []) as StudioBackgroundStyleRecord[]
}

export interface UpsertLightingStyleInput {
  key: string
  name: string
  shortDescription?: string | null
  promptFragment: string
  negativeConstraints?: string | null
  thumbnailPath?: string | null
  isActive?: boolean
  sortOrder?: number
}

export interface UpsertBackgroundStyleInput {
  key: string
  name: string
  shortDescription?: string | null
  category: StudioBackgroundCategory
  promptFragment: string
  negativeConstraints?: string | null
  thumbnailPath?: string | null
  isPremium?: boolean
  isActive?: boolean
  sortOrder?: number
}

export async function createLightingStyle(
  input: UpsertLightingStyleInput,
): Promise<StudioLightingStyleRecord> {
  const key = normalizeKey(input.key)
  const name = normalizeName(input.name)
  const promptFragment = input.promptFragment.trim()
  if (!key) throw new Error('key is required and must be a kebab-case slug')
  if (!name) throw new Error('name is required')
  if (!promptFragment) throw new Error('promptFragment is required')

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_lighting_styles')
    .insert({
      key,
      name,
      short_description: input.shortDescription?.trim() || null,
      prompt_fragment: promptFragment,
      negative_constraints: input.negativeConstraints?.trim() || null,
      thumbnail_path: input.thumbnailPath?.trim() || null,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select(LIGHTING_FULL_COLUMNS)
    .single()

  if (error) {
    throw new Error(`Failed to create lighting style: ${error.message}`)
  }

  return data as StudioLightingStyleRecord
}

export async function createBackgroundStyle(
  input: UpsertBackgroundStyleInput,
): Promise<StudioBackgroundStyleRecord> {
  const key = normalizeKey(input.key)
  const name = normalizeName(input.name)
  const promptFragment = input.promptFragment.trim()
  if (!key) throw new Error('key is required and must be a kebab-case slug')
  if (!name) throw new Error('name is required')
  if (!promptFragment) throw new Error('promptFragment is required')

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_background_styles')
    .insert({
      key,
      name,
      short_description: input.shortDescription?.trim() || null,
      category: input.category,
      prompt_fragment: promptFragment,
      negative_constraints: input.negativeConstraints?.trim() || null,
      thumbnail_path: input.thumbnailPath?.trim() || null,
      is_premium: input.isPremium ?? false,
      is_active: input.isActive ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select(BACKGROUND_FULL_COLUMNS)
    .single()

  if (error) {
    throw new Error(`Failed to create background style: ${error.message}`)
  }

  return data as StudioBackgroundStyleRecord
}

export async function updateLightingStyle(
  id: string,
  patch: Partial<UpsertLightingStyleInput>,
): Promise<StudioLightingStyleRecord> {
  const updates: Record<string, unknown> = {}

  if (patch.key !== undefined) {
    const key = normalizeKey(patch.key)
    if (!key) throw new Error('key is required and must be a kebab-case slug')
    updates.key = key
  }
  if (patch.name !== undefined) {
    const name = normalizeName(patch.name)
    if (!name) throw new Error('name is required')
    updates.name = name
  }
  if (patch.shortDescription !== undefined) {
    updates.short_description = patch.shortDescription?.trim() || null
  }
  if (patch.promptFragment !== undefined) {
    const promptFragment = patch.promptFragment.trim()
    if (!promptFragment) throw new Error('promptFragment is required')
    updates.prompt_fragment = promptFragment
  }
  if (patch.negativeConstraints !== undefined) {
    updates.negative_constraints = patch.negativeConstraints?.trim() || null
  }
  if (patch.thumbnailPath !== undefined) {
    updates.thumbnail_path = patch.thumbnailPath?.trim() || null
  }
  if (patch.isActive !== undefined) updates.is_active = patch.isActive
  if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_lighting_styles')
    .update(updates)
    .eq('id', id)
    .select(LIGHTING_FULL_COLUMNS)
    .single()

  if (error) {
    throw new Error(`Failed to update lighting style: ${error.message}`)
  }

  return data as StudioLightingStyleRecord
}

export async function updateBackgroundStyle(
  id: string,
  patch: Partial<UpsertBackgroundStyleInput>,
): Promise<StudioBackgroundStyleRecord> {
  const updates: Record<string, unknown> = {}

  if (patch.key !== undefined) {
    const key = normalizeKey(patch.key)
    if (!key) throw new Error('key is required and must be a kebab-case slug')
    updates.key = key
  }
  if (patch.name !== undefined) {
    const name = normalizeName(patch.name)
    if (!name) throw new Error('name is required')
    updates.name = name
  }
  if (patch.shortDescription !== undefined) {
    updates.short_description = patch.shortDescription?.trim() || null
  }
  if (patch.category !== undefined) updates.category = patch.category
  if (patch.promptFragment !== undefined) {
    const promptFragment = patch.promptFragment.trim()
    if (!promptFragment) throw new Error('promptFragment is required')
    updates.prompt_fragment = promptFragment
  }
  if (patch.negativeConstraints !== undefined) {
    updates.negative_constraints = patch.negativeConstraints?.trim() || null
  }
  if (patch.thumbnailPath !== undefined) {
    updates.thumbnail_path = patch.thumbnailPath?.trim() || null
  }
  if (patch.isPremium !== undefined) updates.is_premium = patch.isPremium
  if (patch.isActive !== undefined) updates.is_active = patch.isActive
  if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update')
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_background_styles')
    .update(updates)
    .eq('id', id)
    .select(BACKGROUND_FULL_COLUMNS)
    .single()

  if (error) {
    throw new Error(`Failed to update background style: ${error.message}`)
  }

  return data as StudioBackgroundStyleRecord
}

export async function deleteLightingStyle(id: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('studio_lighting_styles').delete().eq('id', id)
  if (error) {
    throw new Error(`Failed to delete lighting style: ${error.message}`)
  }
}

export async function deleteBackgroundStyle(id: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('studio_background_styles').delete().eq('id', id)
  if (error) {
    throw new Error(`Failed to delete background style: ${error.message}`)
  }
}

/**
 * Build a directive clause from a resolved style row (prompt + optional constraints).
 */
export function buildStyleDirectiveClause(
  promptFragment: string,
  negativeConstraints?: string | null,
): string {
  const parts = [promptFragment.trim()]
  const constraints = negativeConstraints?.trim()
  if (constraints) parts.push(constraints)
  return parts.filter(Boolean).join(' ')
}
