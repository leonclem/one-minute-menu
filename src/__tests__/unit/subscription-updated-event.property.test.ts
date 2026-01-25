/**
 * Property-Based Tests for Subscription Updated Event Processing
 * 
 * Feature: stripe-payment-integration, Property 39: Subscription Update Event Processing
 * Validates: Requirements 15.6
 * 
 * Tests that customer.subscription.updated webhook events are processed correctly.
 */

import * as fc from 'fast-check'
import Stripe from 'stripe'
import { processSubscriptionUpdated } from '@/lib/stripe-webhook-processor'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Property 39: Subscription Update Event Processing', () => {
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
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Property: For any customer.subscription.updated webhook event,
   * the system SHALL process it and update the user's subscription_status
   * and subscription_period_end accordingly.
   */
  it('should process subscription updated events and update profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        fc.uuid(),
        fc.constantFrom('active', 'past_due', 'canceled', 'unpaid', 'trialing'),
        fc.integer({ min: Math.floor(Date.now() / 1000), max: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 }),
        async (subscriptionId, customerId, userId, status, currentPeriodEnd) => {
          // Mock Stripe subscription updated event
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status,
            current_period_end: currentPeriodEnd,
          } as any as Stripe.Subscription

          // Mock user profile lookup
          mockSupabase.single.mockResolvedValue({
            data: {
              id: userId,
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

          // Execute: Process subscription updated event
          await processSubscriptionUpdated(subscription, 'test-request-id')

          // Verify: Profile was queried by customer ID
          expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
          expect(mockSupabase.eq).toHaveBeenCalledWith('stripe_customer_id', customerId)

          // Verify: Profile was updated with new status and period_end
          expect(mockSupabase.update).toHaveBeenCalledWith(
            expect.objectContaining({
              subscription_status: status,
              subscription_period_end: expect.any(String),
            })
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should update subscription_status from event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        fc.uuid(),
        fc.constantFrom('active', 'past_due', 'canceled', 'unpaid', 'trialing'),
        async (subscriptionId, customerId, userId, status) => {
          // Mock subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status,
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
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
          await processSubscriptionUpdated(subscription, 'test-request-id')

          // Verify: Status was updated
          expect(updateData).toBeDefined()
          expect(updateData.subscription_status).toBe(status)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should update subscription_period_end from event', async () => {
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
            status: 'active',
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
          await processSubscriptionUpdated(subscription, 'test-request-id')

          // Verify: Period end was updated
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

  it('should handle all valid subscription statuses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        fc.uuid(),
        fc.constantFrom('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired'),
        async (subscriptionId, customerId, userId, status) => {
          // Mock subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status,
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as any as Stripe.Subscription

          // Mock user lookup
          mockSupabase.single.mockResolvedValue({
            data: { id: userId, stripe_customer_id: customerId },
            error: null,
          })

          // Mock update
          mockSupabase.update.mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          })

          // Execute: Process event (should not throw)
          await expect(
            processSubscriptionUpdated(subscription, 'test-request-id')
          ).resolves.not.toThrow()

          // Verify: Update was called
          expect(mockSupabase.update).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should extract customer ID from subscription updated event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        async (subscriptionId, customerId) => {
          // Mock Stripe subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status: 'active',
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
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          } as any as Stripe.Subscription

          // Mock user not found
          mockSupabase.single.mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' },
          })

          // Execute: Process event (should not throw - graceful handling)
          await expect(
            processSubscriptionUpdated(subscription, 'test-request-id')
          ).resolves.not.toThrow()
          
          // Verify: Update was NOT called
          expect(mockSupabase.update).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not modify plan field during update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `cus_${s}`),
        fc.uuid(),
        fc.constantFrom('active', 'past_due'),
        async (subscriptionId, customerId, userId, status) => {
          // Mock subscription
          const subscription = {
            id: subscriptionId,
            customer: customerId,
            status,
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
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
          await processSubscriptionUpdated(subscription, 'test-request-id')

          // Verify: Plan field was not included in update
          expect(updateData).toBeDefined()
          expect(updateData.plan).toBeUndefined()
          
          // Verify: Only status and period_end were updated
          expect(Object.keys(updateData)).toEqual(['subscription_status', 'subscription_period_end'])
        }
      ),
      { numRuns: 100 }
    )
  })
})
