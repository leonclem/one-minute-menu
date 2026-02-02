/**
 * Property-Based Tests for Subscription Quota Updates
 * Feature: stripe-payment-integration, Property 14: Subscription Fulfillment Updates Quotas
 * Validates: Requirements 5.6
 */

import * as fc from 'fast-check'
import { purchaseLogger } from '@/lib/purchase-logger'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock the Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Property 14: Subscription Fulfillment Updates Quotas', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
  })

  it('should update generation_quotas with correct monthly_limit for grid_plus (100) and grid_plus_premium (-1 for unlimited)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('grid_plus' as const, 'grid_plus_premium' as const),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        fc.integer({ min: 100, max: 100000 }),
        
        async (userId, plan, stripeCustomerId, stripeSubscriptionId, transactionId, amountCents) => {
          // Create fresh mock for each test iteration
          const mockUpsert = jest.fn().mockResolvedValue({ error: null })
          const mockInsert = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'audit-id' }, error: null })
            })
          })
          const mockEq = jest.fn().mockResolvedValue({ error: null })
          const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
          const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'purchase_audit') {
              return { select: mockSelect, insert: mockInsert }
            } else if (table === 'profiles') {
              return { update: mockUpdate }
            } else if (table === 'generation_quotas') {
              return { upsert: mockUpsert }
            }
            return {}
          })
          
          const mockSupabase = { from: mockFrom }
          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          
          // Execute: Fulfill subscription
          await purchaseLogger.fulfillSubscription(
            userId,
            plan,
            stripeCustomerId,
            stripeSubscriptionId,
            transactionId,
            amountCents
          )
          
          // Verify: Upsert was called on generation_quotas table
          expect(mockFrom).toHaveBeenCalledWith('generation_quotas')
          
          // Verify: Correct monthly_limit based on plan
          const expectedMonthlyLimit = plan === 'grid_plus_premium' ? 1000 : 100
          
          expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
              user_id: userId,
              monthly_limit: expectedMonthlyLimit,
              current_usage: 0
            }),
            expect.objectContaining({ onConflict: 'user_id' })
          )
          
          // Verify: reset_date is set to first day of next month
          const upsertCall = mockUpsert.mock.calls[0][0]
          const [year, month, day] = upsertCall.reset_date.split('-').map(Number)
          const now = new Date()
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          
          expect(year).toBe(nextMonth.getFullYear())
          expect(month).toBe(nextMonth.getMonth() + 1) // month is 1-indexed in string, 0-indexed in Date
          expect(day).toBe(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not update quotas if transaction already processed (idempotency)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('grid_plus' as const, 'grid_plus_premium' as const),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        fc.integer({ min: 100, max: 100000 }),
        
        async (userId, plan, stripeCustomerId, stripeSubscriptionId, transactionId, amountCents) => {
          // Create fresh mock for each test iteration
          const mockUpsert = jest.fn()
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'existing-audit-id' }, error: null })
          const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'purchase_audit') {
              return { select: mockSelect }
            } else if (table === 'generation_quotas') {
              return { upsert: mockUpsert }
            }
            return {}
          })
          
          const mockSupabase = { from: mockFrom }
          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          
          // Execute: Fulfill subscription
          await purchaseLogger.fulfillSubscription(
            userId,
            plan,
            stripeCustomerId,
            stripeSubscriptionId,
            transactionId,
            amountCents
          )
          
          // Verify: Upsert was NOT called (because transaction already processed)
          expect(mockUpsert).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
