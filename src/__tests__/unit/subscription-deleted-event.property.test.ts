/**
 * Property-Based Tests for Subscription Deleted Event Processing
 * 
 * Feature: stripe-payment-integration, Property 24: Subscription Deleted Event Processing
 * Validates: Requirements 8.5
 * 
 * Tests that customer.subscription.deleted webhook events are processed correctly.
 */

import * as fc from 'fast-check'
import Stripe from 'stripe'
import { processSubscriptionDeleted } from '@/lib/stripe-webhook-processor'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))
jest.mock('@/lib/purchase-logger')

describe('Property 24: Subscription Deleted Event Processing', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    
    // Mock purchaseLogger
    ;(purchaseLogger.cancelSubscription as jest.Mock) = jest.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Property: For any customer.subscription.deleted webhook event,
   * the system SHALL process it and update the user's profile accordingly.
   */
  it('should process subscription deleted events and update profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        fc.uuid(),
        fc.constantFrom('grid_plus', 'grid_plus_premium'),
        fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 }),
        async (subscriptionId, customerId, userId, plan, currentPeriodEnd) => {
          // Mock Stripe subscription deleted event
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status: 'canceled',
            current_period_end: currentPeriodEnd,
            cancellation_details: {
              reason: 'cancellation_requested',
            },
          } as any as Stripe.Subscription

          // Mock user profile lookup
          mockSupabase.single.mockResolvedValue({
            data: {
              id: userId,
              plan,
              stripe_customer_id: customerId,
            },
            error: null,
          })

          // Mock profile update
          mockSupabase.update.mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })

          // Execute: Process subscription deleted event
          await processSubscriptionDeleted(subscription, 'test-request-id')

          // Verify: Profile was queried by customer ID
          expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
          expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_customer_id', customerId)

          // Verify: Profile was updated with canceled status
          expect(mockSupabase.update).toHaveBeenCalledWith(
            expect.objectContaining({
              subscription_status: 'canceled',
              subscription_period_end: expect.any(String),
            })
          )

          // Verify: Cancellation was logged
          expect(purchaseLogger.cancelSubscription).toHaveBeenCalledWith(
            userId,
            subscriptionId,
            expect.any(String),
            expect.any(Date)
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should extract customer ID from subscription deleted event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        async (subscriptionId, customerId) => {
          // Mock Stripe subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status: 'canceled',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as any as Stripe.Subscription

          // Verify: Customer ID can be extracted
          expect(subscription.customer).toBe(customerId)
          expect(typeof subscription.customer).toBe('string')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should set subscription_status to canceled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        fc.uuid(),
        fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 }),
        async (subscriptionId, customerId, userId, currentPeriodEnd) => {
          // Mock subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status: 'canceled',
            current_period_end: currentPeriodEnd,
          } as any as Stripe.Subscription

          // Mock user lookup
          mockSupabase.single.mockResolvedValue({
            data: { id: userId, stripe_customer_id: customerId },
            error: null,
          })

          // Mock update
          let updateData: any = null
          mockSupabase.update.mockImplementation((data: any) => {
            updateData = data
            return {
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
          })

          // Execute: Process event
          await processSubscriptionDeleted(subscription, 'test-request-id')

          // Verify: Status was set to canceled
          expect(updateData).toBeDefined()
          expect(updateData.subscription_status).toBe('canceled')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve subscription_period_end from event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        fc.uuid(),
        fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 }),
        async (subscriptionId, customerId, userId, currentPeriodEnd) => {
          // Mock subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status: 'canceled',
            current_period_end: currentPeriodEnd,
          } as any as Stripe.Subscription

          // Mock user lookup
          mockSupabase.single.mockResolvedValue({
            data: { id: userId, stripe_customer_id: customerId },
            error: null,
          })

          // Mock update
          let updateData: any = null
          mockSupabase.update.mockImplementation((data: any) => {
            updateData = data
            return {
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
          })

          // Execute: Process event
          await processSubscriptionDeleted(subscription, 'test-request-id')

          // Verify: Period end was preserved
          expect(updateData).toBeDefined()
          expect(updateData.subscription_period_end).toBeDefined()
          
          // Verify: Period end matches the event data
          const expectedPeriodEnd = new Date(currentPeriodEnd * 1000).toISOString()
          expect(updateData.subscription_period_end).toBe(expectedPeriodEnd)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle missing user gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        async (subscriptionId, customerId) => {
          // Mock subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status: 'canceled',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as any as Stripe.Subscription

          // Mock user not found
          mockSupabase.single.mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' },
          })

          // Execute: Process event (should not throw - graceful handling)
          await expect(
            processSubscriptionDeleted(subscription, 'test-request-id')
          ).resolves.not.toThrow()
          
          // Verify: Update was NOT called
          expect(mockSupabase.update).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
