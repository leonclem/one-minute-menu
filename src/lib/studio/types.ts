export type StudioImageRole = 'source' | 'generated'

export interface StudioDishRecord {
  id: string
  user_id: string
  name: string
  description: string | null
  current_image_id: string | null
  created_at: string
  updated_at: string
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
