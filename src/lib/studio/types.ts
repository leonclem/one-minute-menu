export type StudioImageRole = 'source' | 'generated'

export interface StudioImageRecord {
  id: string
  user_id: string
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
  created_at: string
}
