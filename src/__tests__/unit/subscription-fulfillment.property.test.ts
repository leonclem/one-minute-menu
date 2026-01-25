/**
 * Property-Based Tests for Subscription Fulfillment
 * Feature: stripe-payment-integration, Property 12: Subscription Fulfillment Updates Profile
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */

import * as fc from 'fast-check'
import { purchaseLogger } from '@/lib/purchase-logger'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock the Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Property 12: Subscription Fulfillment Updates Profile', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
  })

  it('should update profile with correct plan, stripe_customer_id, and stripe_subscription_id for any valid subscription', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random user IDs (UUIDs)
        fc.uuid(),
        // Generate random plan (grid_plus or grid_plus_premium)
        fc.constantFrom('grid_plus' as const, 'grid_plus_premium' as const),
        // Generate random Stripe customer IDs
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`),
        // Generate random Stripe subscription IDs
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `sub_${s}`),
        // Generate random transaction IDs
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        // Generate random amounts (in cents, between $1 and $1000)
        fc.integer({ min: 100, max: 100000 }),
        
        async (userId, plan, stripeCustomerId, stripeSubscriptionId, transactionId, amountCents) => {
          // Create fresh mock for each test iteration
          const mockUpdate = jest.fn().mockResolvedValue({ error: null })
          const mockInsert = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'audit-id' }, error: null })
            })
          })
          const mockEq = jest.fn().mockResolvedValue({ error: null })
          const mockUpdateChain = jest.fn().mockReturnValue({ eq: mockEq })
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
          const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
          const mockUpsert = jest.fn().mockResolvedValue({ error: null })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'profiles') {
              return { update: mockUpdateChain }
            } else if (table === 'purchase_audit') {
              return { select: mockSelect, insert: mockInsert }
            } else if (table === 'generation_quotas') {
              return { upsert: mockUpsert }
            }
            return {}
          })
          
          const mockSupabase = { from: mockFrom }
          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          
          // Execute: Fulfill subscription
          await purchaseLogger.fulfillSubscription(
            userId,
            plan,
            stripeCustomerId,
            stripeSubscriptionId,
            transactionId,
            amountCents
          )
          
          // Verify: Update was called on profiles table
          expect(mockFrom).toHaveBeenCalledWith('profiles')
          
          // Verify: Correct profile data was updated
          expect(mockUpdateChain).toHaveBeenCalledWith(
            expect.objectContaining({
              plan: plan,
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              subscription_status: 'active'
            })
          )
          
          // Verify: Update was scoped to correct user
          expect(mockEq).toHaveBeenCalledWith('id', userId)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not update profile if transaction already processed (idempotency)', async () => {
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
          const mockUpdate = jest.fn()
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'existing-audit-id' }, error: null })
          const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'purchase_audit') {
              return { select: mockSelect }
            } else if (table === 'profiles') {
              return { update: mockUpdate }
            }
            return {}
          })
          
          const mockSupabase = { from: mockFrom }
          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          
          // Execute: Fulfill subscription
          await purchaseLogger.fulfillSubscription(
            userId,
            plan,
            stripeCustomerId,
            stripeSubscriptionId,
            transactionId,
            amountCents
          )
          
          // Verify: Update was NOT called (because transaction already processed)
          expect(mockUpdate).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
