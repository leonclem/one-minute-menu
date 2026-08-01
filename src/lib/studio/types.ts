import type {
  StudioExportFileType,
  StudioExportGenerationMethod,
  StudioExportStatus,
  StudioExportVariantType,
} from '@/lib/studio/export-presets'

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
  descriptor: Record<string, unknown> | null
  prompt_fragment: string
  negative_constraints: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Full background style row including server-only prompt fields. */
export interface StudioBackgroundStyleRecord extends StudioBackgroundStyleDisplay {
  descriptor: Record<string, unknown> | null
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
  /** Consecutive billable provider failures; reset on successful generate. */
  generation_failure_count: number
  /** When set, mutates for this dish are blocked until admin clears. */
  generation_blocked_at: string | null
  generation_blocked_reason: string | null
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

/** Row shape of `studio_export_variants` (migration 077). */
export interface StudioExportVariantRecord {
  id: string
  user_id: string
  dish_id: string
  source_image_id: string
  parent_image_id: string | null
  variant_type: StudioExportVariantType
  width: number
  height: number
  aspect_ratio: string
  file_type: StudioExportFileType
  status: StudioExportStatus
  storage_path: string | null
  preview_url: string | null
  generation_method: StudioExportGenerationMethod
  estimated_credits: number
  credits_charged: number | null
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * One export tile as returned to the Studio client: the preset merged with any
 * persisted variant row, plus the credit quote for generating it now.
 */
export interface StudioExportTile {
  variantType: StudioExportVariantType
  label: string
  hint: string
  width: number
  height: number
  aspectRatio: string
  fileType: StudioExportFileType
  status: StudioExportStatus
  generationMethod: StudioExportGenerationMethod
  estimatedCredits: number
  creditsCharged: number | null
  previewUrl: string | null
  errorMessage: string | null
  /** False when the underlying pipeline is unavailable (e.g. cut-out disabled). */
  available: boolean
  unavailableReason: string | null
  updatedAt: string | null
}
