import type { User } from '@/types'

/**
 * Runtime limits for AI image generation (non-persisted).
 * These are intentionally separate from monthly quota enforcement.
 */
export function getItemDailyGenerationLimit(plan: User['plan'], role?: User['role']): number {
  // Admins are effectively unlimited for operational purposes
  if (role === 'admin') return 999999

  switch (plan) {
    case 'free':
      return 20
    case 'grid_plus':
      return 100
    case 'grid_plus_premium':
      return 250
    // Legacy plans map to the nearest modern tier
    case 'premium':
      return 100
    case 'enterprise':
      return 250
    default:
      return 20
  }
}

