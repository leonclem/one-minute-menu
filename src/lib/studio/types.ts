export type StudioImageRole = 'source' | 'generated'

export type StudioBackgroundCategory = 'surface' | 'environment' | 'backdrop'

/** Display fields safe to return to FOH clients (no prompt fragments). */
export interface StudioLightingStyleDisplay {
  id: string
  key: string
  name: string
  short_description: string | null
  thumbnail_path: string | null
  sort_order: number
}

/** Display fields safe to return to FOH clients (no prompt fragments). */
export interface StudioBackgroundStyleDisplay {
  id: string
  key: string
  name: string
  short_description: string | null
  category: StudioBackgroundCategory
  thumbnail_path: string | null
  is_premium: boolean
  sort_order: number
}

/** Full lighting style row including server-only prompt fields. */
export interface StudioLightingStyleRecord extends StudioLightingStyleDisplay {
  prompt_fragment: string
  negative_constraints: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Full background style row including server-only prompt fields. */
export interface StudioBackgroundStyleRecord extends StudioBackgroundStyleDisplay {
  prompt_fragment: string
  negative_constraints: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StudioDishRecord {
  id: string
  user_id: string
  name: string
  description: string | null
  current_image_id: string | null
  created_at: string
  updated_at: string
}

/** Dish row plus Current preview URL for picker UI. */
export interface StudioDishListItem extends StudioDishRecord {
  current_image_url: string | null
}

export interface StudioImageRecord {
  id: string
  user_id: string
  dish_id: string | null
  role: StudioImageRole
  source_image_id: string | null
  storage_path: string
  public_url: string
  mime_type: string
  width: number | null
  height: number | null
  prompt: string | null
  model: string | null
  metadata: Record<string, unknown>
  is_favourite: boolean
  archived_at: string | null
  created_at: string
}
