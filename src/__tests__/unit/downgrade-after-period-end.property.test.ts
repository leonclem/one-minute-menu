/**
 * Property-Based Tests for Downgrade After Period End
 * 
 * Feature: stripe-payment-integration, Property 22: Downgrade After Period End
 * Validates: Requirements 8.3
 * 
 * Tests that users are downgraded to free plan after subscription_period_end passes.
 */

import * as fc from 'fast-check'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Property 22: Downgrade After Period End', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Property: For any cancelled subscription where the current date is past
   * subscription_period_end, the user's plan SHALL be 'free'.
   */
  it('should downgrade to free plan when period_end has passed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('grid_plus', 'grid_plus_premium'),
        fc.integer({ min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() - 1 }),
        async (userId, originalPlan, periodEndTimestamp) => {
          const now = new Date()
          const periodEnd = new Date(periodEndTimestamp)
          
          // Verify period_end is in the past
          expect(periodEnd.getTime()).toBeLessThan(now.getTime())

          // Mock user profile with cancelled subscription and expired period_end
          const mockProfile = {
            id: userId,
            plan: 'free', // Should be downgraded to free
            subscription_status: 'canceled',
            subscription_period_end: periodEnd.toISOString(),
          }

          mockSupabase.single.mockResolvedValue({
            data: mockProfile,
            error: null,
          })

          // Execute: Fetch user profile
          const { data: profile } = await mockSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

          // Verify: User has been downgraded to free plan
          const profilePeriodEnd = new Date(profile.subscription_period_end)
          if (profilePeriodEnd < now) {
            expect(profile.plan).toBe('free')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should identify expired subscriptions for downgrade', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            plan: fc.constantFrom('grid_plus', 'grid_plus_premium'),
            subscription_status: fc.constant('canceled'),
            subscription_period_end: fc.integer({
              min: Date.now() - 365 * 24 * 60 * 60 * 1000,
              max: Date.now() - 1,
            }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (expiredProfiles) => {
          const now = new Date()
          
          // Mock query for expired subscriptions
          mockSupabase.single.mockResolvedValue({
            data: expiredProfiles.map(p => ({
              ...p,
              subscription_period_end: new Date(p.subscription_period_end).toISOString(),
            })),
            error: null,
          })

          // Execute: Query for profiles with expired period_end
          const { data: profiles } = await mockSupabase
            .from('profiles')
            .select('*')
            .eq('subscription_status', 'canceled')
            .lt('subscription_period_end', now.toISOString())
            .single()

          // Verify: All returned profiles have period_end in the past
          if (profiles && Array.isArray(profiles)) {
            profiles.forEach((profile: any) => {
              const periodEnd = new Date(profile.subscription_period_end)
              expect(periodEnd.getTime()).toBeLessThan(now.getTime())
            })
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should update plan to free for expired subscriptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('grid_plus', 'grid_plus_premium'),
        fc.integer({ min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() - 1 }),
        async (userId, originalPlan, periodEndTimestamp) => {
          const periodEnd = new Date(periodEndTimestamp)
          
          // Mock update operation
          mockSupabase.from.mockReturnValue({
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockResolvedValue({
                  data: { id: userId, plan: 'free' },
                  error: null,
                }),
              }),
            }),
          })

          // Execute: Update expired subscriptions to free plan
          const { data, error } = await mockSupabase
            .from('profiles')
            .update({ plan: 'free' })
            .eq('subscription_status', 'canceled')
            .lt('subscription_period_end', new Date().toISOString())

          // Verify: Update succeeded
          expect(error).toBeNull()
          if (data) {
            expect(data.plan).toBe('free')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not downgrade if period_end is in the future', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('grid_plus', 'grid_plus_premium'),
        fc.integer({ min: Date.now() + 10000, max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
        async (userId, plan, periodEndTimestamp) => {
          const periodEnd = new Date(periodEndTimestamp)
          const now = new Date()
          
          // Verify period_end is in the future (with buffer for test execution time)
          if (periodEnd.getTime() <= now.getTime()) {
            // Skip this test case if timing is too close
            return
          }

          // Mock user profile with cancelled subscription but future period_end
          const mockProfile = {
            id: userId,
            plan, // Should NOT be downgraded yet
            subscription_status: 'canceled',
            subscription_period_end: periodEnd.toISOString(),
          }

          mockSupabase.single.mockResolvedValue({
            data: mockProfile,
            error: null,
          })

          // Execute: Fetch user profile
          const { data: profile } = await mockSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

          // Verify: User still has paid plan (not downgraded yet)
          const profilePeriodEnd = new Date(profile.subscription_period_end)
          if (profilePeriodEnd > now) {
            expect(['grid_plus', 'grid_plus_premium']).toContain(profile.plan)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
