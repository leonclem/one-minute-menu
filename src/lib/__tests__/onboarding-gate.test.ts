import { isOnboardingComplete, getOnboardingBlockReason } from '../onboarding-gate'
import type { User } from '@/types'

describe('isOnboardingComplete', () => {
  const baseProfile: User = {
    id: 'u1',
    email: 'test@test.com',
    plan: 'free',
    limits: {} as any,
    createdAt: new Date(),
    role: 'user',
    isApproved: true,
    onboardingCompleted: true,
    restaurantName: 'Test Resto',
    establishmentType: 'casual',
    primaryCuisine: 'italian'
  }

  test('returns true when all fields are present', () => {
    expect(isOnboardingComplete(baseProfile)).toBe(true)
  })

  test('returns false when onboardingCompleted flag is false', () => {
    expect(isOnboardingComplete({ ...baseProfile, onboardingCompleted: false })).toBe(false)
  })

  test('returns false when restaurantName is missing', () => {
    expect(isOnboardingComplete({ ...baseProfile, restaurantName: '' })).toBe(false)
    expect(isOnboardingComplete({ ...baseProfile, restaurantName: undefined as any })).toBe(false)
  })

  test('returns false when establishmentType is missing', () => {
    expect(isOnboardingComplete({ ...baseProfile, establishmentType: '' })).toBe(false)
  })

  test('returns false when primaryCuisine is missing', () => {
    expect(isOnboardingComplete({ ...baseProfile, primaryCuisine: '' })).toBe(false)
  })

  test('returns false for null/undefined profile', () => {
    expect(isOnboardingComplete(null)).toBe(false)
    expect(isOnboardingComplete(undefined)).toBe(false)
  })
})

describe('getOnboardingBlockReason', () => {
  test('returns specific missing fields', () => {
    expect(getOnboardingBlockReason(null)).toBe('no_profile')
    expect(getOnboardingBlockReason({ onboardingCompleted: false } as any)).toBe('flag_not_set')
    expect(getOnboardingBlockReason({ onboardingCompleted: true, restaurantName: '' } as any)).toBe('missing_restaurant_name')
  })
})
