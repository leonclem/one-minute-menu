import type { User } from '@/types'

/**
 * Definition of "onboarding complete" for gating purposes.
 * Username is optional, but restaurant details are required to enhance AI prompts.
 */
export function isOnboardingComplete(profile: User | null | undefined): boolean {
  if (!profile) return false
  
  return !!(
    profile.onboardingCompleted &&
    profile.restaurantName?.trim() &&
    profile.establishmentType?.trim() &&
    profile.primaryCuisine?.trim()
  )
}

/**
 * Gets a human-readable reason for why onboarding is considered incomplete.
 * Used for structured logging.
 */
export function getOnboardingBlockReason(profile: User | null | undefined): string {
  if (!profile) return 'no_profile'
  if (!profile.onboardingCompleted) return 'flag_not_set'
  if (!profile.restaurantName?.trim()) return 'missing_restaurant_name'
  if (!profile.establishmentType?.trim()) return 'missing_establishment_type'
  if (!profile.primaryCuisine?.trim()) return 'missing_primary_cuisine'
  return 'unknown'
}
