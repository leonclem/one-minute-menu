/**
 * Property-Based Tests for Subscription Audit Logging
 * Feature: stripe-payment-integration, Property 13: Subscription Fulfillment Creates Audit Log
 * Validates: Requirements 5.5
 */

import * as fc from 'fast-check'
import { purchaseLogger } from '@/lib/purchase-logger'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock the Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

jest.mock('@/lib/notification-service', () => ({
  notificationService: {
    sendSubscriptionConfirmation: jest.fn().mockResolvedValue(undefined),
    sendCreatorPackConfirmation: jest.fn().mockResolvedValue(undefined),
    sendPaymentFailedNotification: jest.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledNotification: jest.fn().mockResolvedValue(undefined),
  }
}))

describe('Property 13: Subscription Fulfillment Creates Audit Log', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
  })

  it('should create purchase_audit record with status=success, correct product_id, amount_cents, and stripe transaction_id for any subscription', async () => {
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
          // Create fresh mock for each test iteration with proper chaining
          const mockInsert = jest.fn()
          const mockInsertSelect = jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'audit-id' }, error: null })
          })
          mockInsert.mockReturnValue({ select: mockInsertSelect })
          
          const mockEq = jest.fn().mockResolvedValue({ error: null })
          const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
          const mockEq2 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq2 })
          const mockUpsert = jest.fn().mockResolvedValue({ error: null })
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
          
          // Verify: Insert was called on purchase_audit table
          expect(mockFrom).toHaveBeenCalledWith('purchase_audit')
          
          // Verify: Insert was called with correct audit log data
          expect(mockInsert).toHaveBeenCalledWith({
            user_id: userId,
            transaction_id: transactionId,
            product_id: plan,
            amount_cents: amountCents,
            currency: 'usd',
            status: 'success',
            metadata: expect.objectContaining({
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
              action: 'subscription_activated'
            })
          })
          
          // Verify: Select was called to return the inserted ID
          expect(mockInsertSelect).toHaveBeenCalledWith('id')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not create audit log if transaction already processed (idempotency)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('grid_plus' as const, 'grid_plus_premium' as const),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        fc.integer({ min: 100, max: 100000 }),
        
        async (userId, plan, stripeCustomerId, stripeSubscriptionId, transactionId, amountCents) => {
          // Create fresh mock for each test iteration with proper chaining
          const mockInsert = jest.fn()
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'existing-audit-id' }, error: null })
          const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'purchase_audit') {
              return { select: mockSelect, insert: mockInsert }
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
          
          // Verify: Insert was NOT called (because transaction already processed)
          expect(mockInsert).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
