/**
 * Property-Based Tests for Billing Currency Service
 * 
 * Feature: currency-support
 * 
 * Property 1: Billing Currency Selection Persistence
 * Validates: Requirements 1.4, 1.5, 1.6
 * 
 * Property 15: Subscription Currency Precedence
 * Validates: Requirements 3.5
 * 
 * Property 13: Billing Currency Restriction Enforcement
 * Validates: Requirements 3.6
 */

import * as fc from 'fast-check'
import {
  getBillingCurrency,
  setBillingCurrency,
  getSubscriptionBillingCurrency,
  type BillingCurrency,
} from '@/lib/billing-currency-service'
import { SUPPORTED_BILLING_CURRENCIES } from '@/lib/currency-config'

// Import test helpers
const billingService = require('@/lib/billing-currency-service')
const testHelpers = billingService.__test__

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('Billing Currency Service - Property Tests', () => {
  beforeEach(() => {
    localStorageMock.clear()
    if (testHelpers) {
      testHelpers.clearMockData()
    }
    jest.clearAllMocks()
  })

  describe('Property 1: Billing Currency Selection Persistence', () => {
    /**
     * Property: For any user and any supported billing currency,
     * setting then getting returns the same currency.
     * 
     * This validates that currency preferences persist correctly
     * for both authenticated and anonymous users.
     */
    it('should persist billing currency for authenticated users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // currency
          async (userId, currency) => {
            // Set billing currency for authenticated user
            await setBillingCurrency(currency, userId)
            
            // Get billing currency
            const retrieved = await getBillingCurrency(userId)
            
            // Verify: Retrieved currency matches what was set
            expect(retrieved).toBe(currency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should persist billing currency for anonymous users via localStorage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // currency
          async (currency) => {
            // Set billing currency for anonymous user (no userId)
            await setBillingCurrency(currency)
            
            // Get billing currency for anonymous user
            const retrieved = await getBillingCurrency()
            
            // Verify: Retrieved currency matches what was set
            expect(retrieved).toBe(currency)
            
            // Verify: localStorage contains the currency
            const stored = localStorage.getItem('gridmenu_billing_currency')
            expect(stored).toBeTruthy()
            const parsed = JSON.parse(stored!)
            expect(parsed.billingCurrency).toBe(currency)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 15: Subscription Currency Precedence', () => {
    /**
     * Property: For any user with active subscription, subscription currency
     * takes precedence over account preference.
     * 
     * This validates that subscription currency is immutable and always
     * takes priority over user preferences.
     */
    it('should return subscription currency when it exists, ignoring account preference', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // subscriptionCurrency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // accountCurrency (different)
          async (userId, subscriptionCurrency, accountCurrency) => {
            // Set up: User has both subscription currency and account preference
            if (testHelpers) {
              testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency)
              testHelpers.setMockAccountCurrency(userId, accountCurrency)
            }
            
            // Get billing currency
            const retrieved = await getBillingCurrency(userId)
            
            // Verify: Subscription currency takes precedence
            expect(retrieved).toBe(subscriptionCurrency)
            
            // Verify: Account currency is ignored when subscription exists
            if (subscriptionCurrency !== accountCurrency) {
              expect(retrieved).not.toBe(accountCurrency)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use account preference when no subscription exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // accountCurrency
          async (userId, accountCurrency) => {
            // Set up: User has account preference but no subscription
            if (testHelpers) {
              testHelpers.setMockAccountCurrency(userId, accountCurrency)
            }
            // No subscription currency set
            
            // Get billing currency
            const retrieved = await getBillingCurrency(userId)
            
            // Verify: Account currency is used when no subscription
            expect(retrieved).toBe(accountCurrency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain subscription currency precedence across multiple gets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // subscriptionCurrency
          fc.integer({ min: 2, max: 10 }), // number of times to call getBillingCurrency
          async (userId, subscriptionCurrency, numCalls) => {
            // Set up: User has subscription currency
            if (testHelpers) {
              testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency)
            }
            
            // Get billing currency multiple times
            const results: BillingCurrency[] = []
            for (let i = 0; i < numCalls; i++) {
              const retrieved = await getBillingCurrency(userId)
              results.push(retrieved)
            }
            
            // Verify: All calls return the same subscription currency
            expect(results.every(r => r === subscriptionCurrency)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 13: Billing Currency Restriction Enforcement', () => {
    /**
     * Property: Only SGD, USD, GBP, AUD, EUR are accepted as billing currencies.
     * Other currency codes are rejected with clear error.
     * 
     * This validates that the system enforces the restricted set of
     * supported billing currencies.
     */
    it('should accept all supported billing currencies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // valid currency
          async (userId, currency) => {
            // Attempt to set a supported billing currency
            await expect(
              setBillingCurrency(currency, userId)
            ).resolves.not.toThrow()
            
            // Verify: Currency was set successfully
            const retrieved = await getBillingCurrency(userId)
            expect(SUPPORTED_BILLING_CURRENCIES).toContain(retrieved)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject unsupported billing currencies with clear error', async () => {
      // Generate invalid currency codes (not in supported list)
      const invalidCurrencies = fc.constantFrom(
        'JPY', 'CNY', 'INR', 'THB', 'MYR', 'IDR', 'KRW', 'PHP', 'VND', 'CAD'
      )

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          invalidCurrencies, // invalid currency
          async (userId, invalidCurrency) => {
            // Attempt to set an unsupported billing currency
            await expect(
              setBillingCurrency(invalidCurrency as any, userId)
            ).rejects.toThrow()
            
            // Verify: Error message mentions the invalid currency
            try {
              await setBillingCurrency(invalidCurrency as any, userId)
            } catch (error) {
              expect(error).toBeInstanceOf(Error)
              expect((error as Error).message).toContain(invalidCurrency)
              expect((error as Error).message).toContain('Invalid billing currency')
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject arbitrary strings as billing currencies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.string({ minLength: 1, maxLength: 10 }).filter(
            s => !SUPPORTED_BILLING_CURRENCIES.includes(s as BillingCurrency)
          ), // random string not in supported list
          async (userId, randomString) => {
            // Attempt to set a random string as billing currency
            await expect(
              setBillingCurrency(randomString as any, userId)
            ).rejects.toThrow()
            
            // Verify: Error message is descriptive
            try {
              await setBillingCurrency(randomString as any, userId)
            } catch (error) {
              expect(error).toBeInstanceOf(Error)
              const errorMessage = (error as Error).message
              expect(errorMessage).toContain('Invalid billing currency')
              // Should list supported currencies
              expect(
                SUPPORTED_BILLING_CURRENCIES.some(c => errorMessage.includes(c))
              ).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate currency restriction for both authenticated and anonymous users', async () => {
      const invalidCurrency = 'JPY' // Not in supported billing currencies

      await fc.assert(
        fc.asyncProperty(
          fc.option(fc.uuid(), { nil: undefined }), // userId (may be undefined for anonymous)
          async (userId) => {
            // Attempt to set unsupported currency
            await expect(
              setBillingCurrency(invalidCurrency as any, userId)
            ).rejects.toThrow()
            
            // Verify: Restriction applies regardless of authentication status
            try {
              await setBillingCurrency(invalidCurrency as any, userId)
            } catch (error) {
              expect(error).toBeInstanceOf(Error)
              expect((error as Error).message).toContain('Invalid billing currency')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
