import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type { StudioDishRecord, StudioImageRecord } from '@/lib/studio/types'

/**
 * A deliberately non-specific not-found error used at the ownership boundary.
 * It prevents callers from distinguishing missing, cross-user, cross-dish, and
 * archived Studio sources.
 */
export class OwnedStudioSourceNotFoundError extends Error {
  readonly status = 404

  constructor() {
    super('Studio source image not found')
    this.name = 'OwnedStudioSourceNotFoundError'
  }
}

export interface OwnedDishSource {
  dish: StudioDishRecord
  image: StudioImageRecord
}

/**
 * Proves the authenticated user owns both the dish and its current, non-archived
 * source image. This is intentionally metadata-only: callers must invoke it
 * before loading storage bytes, starting provider work, or performing any
 * generation-side effect.
 */
export async function loadOwnedDishSource(input: {
  userId: string
  dishId: string
  sourceImageId: string
}): Promise<OwnedDishSource> {
  const { userId, dishId, sourceImageId } = input
  if (!userId || !dishId || !sourceImageId) {
    throw new OwnedStudioSourceNotFoundError()
  }

  const supabase = createAdminSupabaseClient()
  const { data: dish, error: dishError } = await supabase
    .from('studio_dishes')
    .select('*')
    .eq('id', dishId)
    .eq('user_id', userId)
    .maybeSingle()

  if (dishError) {
    throw new Error(`Failed to load Studio dish: ${dishError.message}`)
  }
  if (!dish) {
    throw new OwnedStudioSourceNotFoundError()
  }

  const { data: image, error: imageError } = await supabase
    .from('studio_images')
    .select('*')
    .eq('id', sourceImageId)
    .eq('user_id', userId)
    .eq('dish_id', dishId)
    .is('archived_at', null)
    .maybeSingle()

  if (imageError) {
    throw new Error(`Failed to load Studio source image: ${imageError.message}`)
  }
  if (!image) {
    throw new OwnedStudioSourceNotFoundError()
  }

  return {
    dish: dish as StudioDishRecord,
    image: image as StudioImageRecord,
  }
}
