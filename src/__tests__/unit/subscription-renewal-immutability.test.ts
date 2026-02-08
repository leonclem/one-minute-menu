/**
 * Unit Tests for Subscription Renewal Currency Immutability
 * 
 * Feature: currency-support
 * Task: 15.1
 * 
 * Tests verify that subscription currency remains immutable during renewals
 * and that the webhook processor correctly validates currency consistency.
 * 
 * Requirements: 3.4, 3.5
 */

import { processSubscriptionUpdated } from '@/lib/stripe-webhook-processor'
import type Stripe from 'stripe'

// Mock Supabase client with proper chaining
let mockSingleResponse: any = { data: null, error: null }
let mockUpdateResponse: any = { error: null }

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn(function(this: any) {
    // For the select chain, return this to continue chaining to single()
    if (this.select.mock.calls.length > 0) {
      return this
    }
    // For the update chain, return the update response
    return Promise.resolve(mockUpdateResponse)
  }),
  single: jest.fn(() => Promise.resolve(mockSingleResponse)),
  update: jest.fn().mockReturnThis(),
}

// Helper to set mock responses
const setMockSingleResponse = (data: any, error: any = null) => {
  mockSingleResponse = { data, error }
  mockSupabase.single.mockResolvedValue(mockSingleResponse)
}

const setMockUpdateResponse = (error: any = null) => {
  mockUpdateResponse = { error }
}

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => mockSupabase,
}))

describe('Subscription Renewal Currency Immutability', () => {
  const requestId = 'test-request-123'
  const customerId = 'cus_test123'
  const subscriptionId = 'sub_test123'
  const userId = 'user-test-123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('processSubscriptionUpdated - Currency Validation', () => {
    it('should accept renewal when subscription currency matches original currency', async () => {
      const originalCurrency = 'USD'
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        currency: 'usd', // Stripe returns lowercase
        metadata: {
          billingCurrency: originalCurrency,
        },
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as Stripe.Subscription

      // Mock database responses
      setMockSingleResponse({ id: userId })
      setMockUpdateResponse()

      // Process subscription update
      await expect(
        processSubscriptionUpdated(subscription, requestId)
      ).resolves.not.toThrow()

      // Verify: Update was called with correct data
      expect(mockSupabase.update).toHaveBeenCalledWith({
        subscription_status: 'active',
        subscription_period_end: expect.any(String),
      })
    })

    it('should reject renewal when subscription currency has changed', async () => {
      const originalCurrency = 'USD'
      const changedCurrency = 'EUR'
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        currency: changedCurrency.toLowerCase(),
        metadata: {
          billingCurrency: originalCurrency,
        },
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as Stripe.Subscription

      // Mock database responses
      setMockSingleResponse({ id: userId })

      // Process subscription update - should throw
      await expect(
        processSubscriptionUpdated(subscription, requestId)
      ).rejects.toThrow(/currency immutability violation/i)

      // Verify: Update was NOT called
      expect(mockSupabase.update).not.toHaveBeenCalled()
    })

    it('should handle subscription without metadata gracefully', async () => {
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        currency: 'usd',
        metadata: {}, // No billingCurrency in metadata
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as Stripe.Subscription

      // Mock database responses
      setMockSingleResponse({ id: userId })
      setMockUpdateResponse()

      // Process subscription update - should succeed (no original currency to compare)
      await expect(
        processSubscriptionUpdated(subscription, requestId)
      ).resolves.not.toThrow()

      // Verify: Update was called
      expect(mockSupabase.update).toHaveBeenCalled()
    })

    it('should validate currency for all supported billing currencies', async () => {
      const supportedCurrencies = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']

      for (const currency of supportedCurrencies) {
        jest.clearAllMocks()

        const subscription = {
          id: subscriptionId,
          customer: customerId,
          currency: currency.toLowerCase(),
          metadata: {
            billingCurrency: currency,
          },
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        } as Stripe.Subscription

        // Mock database responses
        setMockSingleResponse({ id: userId })
        setMockUpdateResponse()

        // Process subscription update
        await expect(
          processSubscriptionUpdated(subscription, requestId)
        ).resolves.not.toThrow()

        // Verify: Update was called for each currency
        expect(mockSupabase.update).toHaveBeenCalled()
      }
    })

    it('should log error with clear message when currency mismatch is detected', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const originalCurrency = 'GBP'
      const changedCurrency = 'USD'

      const subscription = {
        id: subscriptionId,
        customer: customerId,
        currency: changedCurrency.toLowerCase(),
        metadata: {
          billingCurrency: originalCurrency,
        },
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as Stripe.Subscription

      // Mock database responses
      setMockSingleResponse({ id: userId })

      // Process subscription update
      try {
        await processSubscriptionUpdated(subscription, requestId)
      } catch (error) {
        // Expected to throw
      }

      // Verify: Error was logged with clear message
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL')
      )
      
      const errorMessage = consoleErrorSpy.mock.calls[0][0]
      expect(errorMessage).toContain('currency mismatch')
      expect(errorMessage).toContain(originalCurrency)
      expect(errorMessage).toContain(changedCurrency.toUpperCase())

      consoleErrorSpy.mockRestore()
    })

    it('should not update billing_currency field during renewal', async () => {
      const subscription = {
        id: subscriptionId,
        customer: customerId,
        currency: 'sgd',
        metadata: {
          billingCurrency: 'SGD',
        },
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as Stripe.Subscription

      // Mock database responses
      setMockSingleResponse({ id: userId })
      setMockUpdateResponse()

      // Process subscription update
      await processSubscriptionUpdated(subscription, requestId)

      // Verify: Update was called WITHOUT billing_currency field
      expect(mockSupabase.update).toHaveBeenCalledWith({
        subscription_status: 'active',
        subscription_period_end: expect.any(String),
      })

      // Verify: billing_currency was NOT in the update
      const updateCall = mockSupabase.update.mock.calls[0][0]
      expect(updateCall).not.toHaveProperty('billing_currency')
    })

    it('should log success message with currency information', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
      const currency = 'AUD'

      const subscription = {
        id: subscriptionId,
        customer: customerId,
        currency: currency.toLowerCase(),
        metadata: {
          billingCurrency: currency,
        },
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
      } as Stripe.Subscription

      // Mock database responses
      setMockSingleResponse({ id: userId })
      setMockUpdateResponse()

      // Process subscription update
      await processSubscriptionUpdated(subscription, requestId)

      // Verify: Success log includes currency and immutability note
      const successLog = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('updated') && call[0].includes('user')
      )
      expect(successLog).toBeDefined()
      expect(successLog![0]).toContain(currency.toUpperCase())
      expect(successLog![0]).toContain('immutable')

      consoleLogSpy.mockRestore()
    })
  })
})
