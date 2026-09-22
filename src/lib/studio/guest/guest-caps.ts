import { createAdminSupabaseClient } from '@/lib/supabase-server'
import {
  GUEST_MAX_CROP_CHILDREN,
  GUEST_MAX_DISHES,
  GUEST_MAX_SOURCE_IMAGES,
} from '@/lib/studio/guest/guest-path'

export class GuestCapError extends Error {
  constructor(
    message: string,
    readonly code: 'GUEST_DISH_LIMIT' | 'GUEST_SOURCE_LIMIT' | 'GUEST_CROP_LIMIT',
  ) {
    super(message)
    this.name = 'GuestCapError'
  }
}

export async function assertGuestCanCreateDish(userId: string): Promise<void> {
  const admin = createAdminSupabaseClient()
  const { count, error } = await admin
    .from('studio_dishes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to count dishes: ${error.message}`)
  if ((count ?? 0) >= GUEST_MAX_DISHES) {
    throw new GuestCapError('Sign up to add another dish.', 'GUEST_DISH_LIMIT')
  }
}

export async function assertGuestCanRegisterSource(userId: string): Promise<void> {
  const admin = createAdminSupabaseClient()
  const { count, error } = await admin
    .from('studio_images')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'source')
  if (error) throw new Error(`Failed to count source images: ${error.message}`)
  if ((count ?? 0) >= GUEST_MAX_SOURCE_IMAGES) {
    throw new GuestCapError('Sign up to upload another photo.', 'GUEST_SOURCE_LIMIT')
  }
}

export async function assertGuestCanCrop(userId: string): Promise<void> {
  const admin = createAdminSupabaseClient()
  const { count, error } = await admin
    .from('studio_images')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'generated')
  if (error) throw new Error(`Failed to count cropped images: ${error.message}`)
  if ((count ?? 0) >= GUEST_MAX_CROP_CHILDREN) {
    throw new GuestCapError('Sign up to crop more variants.', 'GUEST_CROP_LIMIT')
  }
}
