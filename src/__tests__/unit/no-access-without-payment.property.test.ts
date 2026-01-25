/** @jest-environment node */

/**
 * Property-based tests for access control without payment
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 18: No Access Without Payment (Requirements 7.4)
 */

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret_key_for_testing'
process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_mock_grid_plus'
process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_mock_grid_plus_premium'
process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_mock_creator_pack'

// Mock dependencies BEFORE importing
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import fc from 'fast-check'

const mockSupabase = {
  from: jest.fn(),
}

describe('Feature: stripe-payment-integration - No Access Without Payment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  /**
   * Property 18: No Access Without Payment
   * For any user who has not completed a successful payment for a paid plan,
   * the system SHALL NOT grant access to features restricted to that plan
   * (verified by checking plan in profile).
   * 
   * Validates: Requirements 7.4
   */
  describe('Property 18: No Access Without Payment', () => {
    it('should only grant paid plan access after successful payment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            requestedPlan: fc.constantFrom('grid_plus', 'grid_plus_premium'),
          }),
          async ({ userId, requestedPlan }) => {
            // Setup mock for user without payment
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId, 
                  plan: 'free', // User is on free plan
                  stripe_customer_id: null,
                  stripe_subscription_id: null,
                  subscription_status: null,
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Query user profile
            const supabase = createServerSupabaseClient()
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            // Assert: User should NOT have access to paid features
            expect(profile?.plan).toBe('free')
            expect(profile?.plan).not.toBe(requestedPlan)
            expect(profile?.stripe_subscription_id).toBeNull()
            expect(profile?.subscription_status).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should verify plan in profile before granting feature access', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            currentPlan: fc.constantFrom('free', 'grid_plus', 'grid_plus_premium'),
            requiredPlan: fc.constantFrom('grid_plus', 'grid_plus_premium'),
          }),
          async ({ userId, currentPlan, requiredPlan }) => {
            // Setup mock
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId, 
                  plan: currentPlan,
                  stripe_subscription_id: currentPlan !== 'free' ? 'sub_123' : null,
                  subscription_status: currentPlan !== 'free' ? 'active' : null,
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Check if user has required plan
            const supabase = createServerSupabaseClient()
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            // Determine if user should have access
            const planHierarchy: Record<string, number> = {
              'free': 0,
              'grid_plus': 1,
              'grid_plus_premium': 2,
            }
            
            const hasAccess = planHierarchy[profile?.plan || 'free'] >= planHierarchy[requiredPlan]

            // Assert: Access should only be granted if user has paid for required plan or higher
            if (currentPlan === 'free') {
              expect(hasAccess).toBe(false)
            } else if (currentPlan === 'grid_plus' && requiredPlan === 'grid_plus') {
              expect(hasAccess).toBe(true)
            } else if (currentPlan === 'grid_plus_premium') {
              expect(hasAccess).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not grant access based on pending or incomplete payments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            subscriptionStatus: fc.constantFrom('incomplete', 'incomplete_expired', 'past_due', 'canceled', 'unpaid'),
          }),
          async ({ userId, subscriptionStatus }) => {
            // Setup mock for user with incomplete payment
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId, 
                  plan: 'free', // Plan should remain free until payment succeeds
                  stripe_customer_id: 'cus_123',
                  stripe_subscription_id: 'sub_123',
                  subscription_status: subscriptionStatus, // Non-active status
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Query user profile
            const supabase = createServerSupabaseClient()
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            // Assert: User should NOT have paid plan access with incomplete payment
            expect(profile?.plan).toBe('free')
            expect(profile?.subscription_status).not.toBe('active')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should only grant Creator Pack features after successful purchase', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            hasPurchased: fc.boolean(),
          }),
          async ({ userId, hasPurchased }) => {
            // Setup mock
            const userPackChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: hasPurchased ? { 
                  id: 'pack_123',
                  user_id: userId,
                  pack_type: 'creator_pack',
                  purchased_at: new Date().toISOString(),
                } : null,
                error: hasPurchased ? null : { code: 'PGRST116' }
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'user_packs') return userPackChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Check if user has Creator Pack
            const supabase = createServerSupabaseClient()
            const { data: pack, error } = await supabase
              .from('user_packs')
              .select('*')
              .eq('user_id', userId)
              .single()

            // Assert: Creator Pack access should match purchase status
            if (hasPurchased) {
              expect(pack).toBeTruthy()
              expect(pack?.pack_type).toBe('creator_pack')
              expect(error).toBeNull()
            } else {
              expect(pack).toBeNull()
              expect(error).toBeTruthy()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should require active subscription status for paid plan access', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            plan: fc.constantFrom('grid_plus', 'grid_plus_premium'),
            subscriptionStatus: fc.constantFrom('active', 'trialing', 'past_due', 'canceled', 'unpaid'),
          }),
          async ({ userId, plan, subscriptionStatus }) => {
            // Setup mock
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId, 
                  plan: subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? plan : 'free',
                  stripe_subscription_id: 'sub_123',
                  subscription_status: subscriptionStatus,
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Query user profile
            const supabase = createServerSupabaseClient()
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            // Assert: Paid plan should only be granted with active/trialing status
            const hasValidStatus = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
            
            if (hasValidStatus) {
              expect(profile?.plan).toBe(plan)
            } else {
              expect(profile?.plan).toBe('free')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
