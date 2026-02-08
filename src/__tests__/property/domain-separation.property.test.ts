/**
 * Property-Based Tests for Currency Domain Separation
 * 
 * Feature: currency-support
 * 
 * Property 2: Billing Currency Domain Isolation
 * Validates: Requirements 9.1, 9.8
 * 
 * Property 3: Menu Currency Domain Isolation
 * Validates: Requirements 9.2, 9.8
 * 
 * Property 10: Mixed Currency Support
 * Validates: Requirements 9.3, 9.4, 9.5
 * 
 * CRITICAL: These tests verify that billing and menu currencies never cross-pollinate.
 * Domain separation is essential for system correctness.
 */

import * as fc from 'fast-check'
import {
  getBillingCurrency,
  setBillingCurrency,
  type BillingCurrency,
} from '@/lib/billing-currency-service'
import {
  getMenuCurrency,
  setMenuCurrency,
  type ISO4217CurrencyCode,
} from '@/lib/menu-currency-service'
import { SUPPORTED_BILLING_CURRENCIES } from '@/lib/currency-config'

// Import test helpers
const billingService = require('@/lib/billing-currency-service')
const menuService = require('@/lib/menu-currency-service')
const billingTestHelpers = billingService.__test__
const menuTestHelpers = menuService.__test__

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

describe('Currency Domain Separation - Property Tests', () => {
  beforeEach(() => {
    localStorageMock.clear()
    if (billingTestHelpers) {
      billingTestHelpers.clearMockData()
    }
    if (menuTestHelpers) {
      menuTestHelpers.clearMockData()
    }
    jest.clearAllMocks()
  })

  describe('Property 2: Billing Currency Domain Isolation', () => {
    /**
     * Property: For any billing currency change, menu currency remains unchanged.
     * Billing operations never read menu_currency field.
     * 
     * This validates that Domain A (billing) is completely isolated from Domain B (menu).
     */
    it('should not affect menu currency when billing currency changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // initial billing currency
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // new billing currency
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR'), // menu currency
          async (userId, initialBillingCurrency, newBillingCurrency, menuCurrency) => {
            // Set up: User has both billing and menu currencies
            await setBillingCurrency(initialBillingCurrency, userId)
            if (menuTestHelpers) {
              menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
            }
            
            // Get initial menu currency
            const initialMenuCurrency = await getMenuCurrency(userId)
            
            // Action: Change billing currency
            await setBillingCurrency(newBillingCurrency, userId)
            
            // Verify: Menu currency remains unchanged
            const finalMenuCurrency = await getMenuCurrency(userId)
            expect(finalMenuCurrency).toBe(initialMenuCurrency)
            expect(finalMenuCurrency).toBe(menuCurrency)
            
            // Verify: Billing currency changed as expected
            const finalBillingCurrency = await getBillingCurrency(userId)
            expect(finalBillingCurrency).toBe(newBillingCurrency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain menu currency independence across multiple billing changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.array(fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), { minLength: 2, maxLength: 5 }), // sequence of billing currencies
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR'), // menu currency
          async (userId, billingCurrencySequence, menuCurrency) => {
            // Set up: User has menu currency
            if (menuTestHelpers) {
              menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
            }
            
            // Get initial menu currency
            const initialMenuCurrency = await getMenuCurrency(userId)
            
            // Action: Change billing currency multiple times
            for (const billingCurrency of billingCurrencySequence) {
              await setBillingCurrency(billingCurrency, userId)
              
              // Verify: Menu currency remains unchanged after each billing change
              const currentMenuCurrency = await getMenuCurrency(userId)
              expect(currentMenuCurrency).toBe(initialMenuCurrency)
            }
            
            // Final verification
            const finalMenuCurrency = await getMenuCurrency(userId)
            expect(finalMenuCurrency).toBe(menuCurrency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should isolate billing operations from menu currency field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // billing currency
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR', 'IDR', 'KRW'), // menu currency
          async (userId, billingCurrency, menuCurrency) => {
            // Set up: User has different billing and menu currencies
            await setBillingCurrency(billingCurrency, userId)
            if (menuTestHelpers) {
              menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
            }
            
            // Action: Get billing currency (should not read menu_currency field)
            const retrievedBillingCurrency = await getBillingCurrency(userId)
            
            // Verify: Billing currency is correct and independent of menu currency
            expect(retrievedBillingCurrency).toBe(billingCurrency)
            
            // Verify: Menu currency is still intact
            const retrievedMenuCurrency = await getMenuCurrency(userId)
            expect(retrievedMenuCurrency).toBe(menuCurrency)
            
            // Verify: The two currencies can be different
            if (billingCurrency !== menuCurrency) {
              expect(retrievedBillingCurrency).not.toBe(retrievedMenuCurrency)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 3: Menu Currency Domain Isolation', () => {
    /**
     * Property: For any menu currency change, billing currency remains unchanged.
     * Menu operations never read billing_currency field.
     * 
     * This validates that Domain B (menu) is completely isolated from Domain A (billing).
     */
    it('should not affect billing currency when menu currency changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // billing currency
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR'), // initial menu currency
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR', 'IDR', 'KRW'), // new menu currency
          async (userId, billingCurrency, initialMenuCurrency, newMenuCurrency) => {
            // Set up: User has both billing and menu currencies
            await setBillingCurrency(billingCurrency, userId)
            if (menuTestHelpers) {
              menuTestHelpers.setMockMenuCurrency(userId, initialMenuCurrency)
            }
            
            // Get initial billing currency
            const initialBillingCurrency = await getBillingCurrency(userId)
            
            // Action: Change menu currency (with confirmation)
            const result = await setMenuCurrency(userId, newMenuCurrency, true)
            
            // Verify: Menu currency change succeeded
            expect(result.success).toBe(true)
            
            // Verify: Billing currency remains unchanged
            const finalBillingCurrency = await getBillingCurrency(userId)
            expect(finalBillingCurrency).toBe(initialBillingCurrency)
            expect(finalBillingCurrency).toBe(billingCurrency)
            
            // Verify: Menu currency changed as expected
            const finalMenuCurrency = await getMenuCurrency(userId)
            expect(finalMenuCurrency).toBe(newMenuCurrency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain billing currency independence across multiple menu changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // billing currency
          fc.array(
            fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR', 'IDR', 'KRW'),
            { minLength: 2, maxLength: 5 }
          ), // sequence of menu currencies
          async (userId, billingCurrency, menuCurrencySequence) => {
            // Set up: User has billing currency
            await setBillingCurrency(billingCurrency, userId)
            
            // Get initial billing currency
            const initialBillingCurrency = await getBillingCurrency(userId)
            
            // Action: Change menu currency multiple times
            for (const menuCurrency of menuCurrencySequence) {
              await setMenuCurrency(userId, menuCurrency, true)
              
              // Verify: Billing currency remains unchanged after each menu change
              const currentBillingCurrency = await getBillingCurrency(userId)
              expect(currentBillingCurrency).toBe(initialBillingCurrency)
            }
            
            // Final verification
            const finalBillingCurrency = await getBillingCurrency(userId)
            expect(finalBillingCurrency).toBe(billingCurrency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should isolate menu operations from billing currency field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // billing currency
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR', 'IDR', 'KRW'), // menu currency
          async (userId, billingCurrency, menuCurrency) => {
            // Set up: User has different billing and menu currencies
            await setBillingCurrency(billingCurrency, userId)
            if (menuTestHelpers) {
              menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
            }
            
            // Action: Get menu currency (should not read billing_currency field)
            const retrievedMenuCurrency = await getMenuCurrency(userId)
            
            // Verify: Menu currency is correct and independent of billing currency
            expect(retrievedMenuCurrency).toBe(menuCurrency)
            
            // Verify: Billing currency is still intact
            const retrievedBillingCurrency = await getBillingCurrency(userId)
            expect(retrievedBillingCurrency).toBe(billingCurrency)
            
            // Verify: The two currencies can be different
            if (billingCurrency !== menuCurrency) {
              expect(retrievedMenuCurrency).not.toBe(retrievedBillingCurrency)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 10: Mixed Currency Support', () => {
    /**
     * Property: For any valid combination of billing and menu currencies
     * (including different currencies), system functions correctly.
     * 
     * This validates that the system supports mixed currency scenarios:
     * - USD billing with SGD menu
     * - SGD billing with THB menu
     * - GBP billing with EUR menu
     * - Any other valid combination
     */
    it('should support any combination of billing and menu currencies', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // billing currency
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'AUD', 'JPY', 'THB', 'MYR', 'IDR', 'KRW'), // menu currency
          async (userId, billingCurrency, menuCurrency) => {
            // Action: Set both billing and menu currencies
            await setBillingCurrency(billingCurrency, userId)
            const menuResult = await setMenuCurrency(userId, menuCurrency, true)
            
            // Verify: Both operations succeeded
            expect(menuResult.success).toBe(true)
            
            // Verify: Both currencies are retrievable
            const retrievedBillingCurrency = await getBillingCurrency(userId)
            const retrievedMenuCurrency = await getMenuCurrency(userId)
            
            expect(retrievedBillingCurrency).toBe(billingCurrency)
            expect(retrievedMenuCurrency).toBe(menuCurrency)
            
            // Verify: System handles mixed currencies correctly
            // (currencies can be the same or different)
            expect(SUPPORTED_BILLING_CURRENCIES).toContain(retrievedBillingCurrency)
            expect(retrievedMenuCurrency).toMatch(/^[A-Z]{3}$/)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should support specific mixed currency scenarios from requirements', async () => {
      const mixedScenarios: Array<[BillingCurrency, ISO4217CurrencyCode]> = [
        ['USD', 'SGD'], // USD billing with SGD menu (Req 9.3)
        ['SGD', 'THB'], // SGD billing with THB menu (Req 9.4)
        ['GBP', 'EUR'], // GBP billing with EUR menu (Req 9.5)
        ['AUD', 'USD'], // AUD billing with USD menu
        ['EUR', 'GBP'], // EUR billing with GBP menu
        ['USD', 'JPY'], // USD billing with JPY menu (zero-decimal)
        ['GBP', 'MYR'], // GBP billing with MYR menu
        ['SGD', 'IDR'], // SGD billing with IDR menu
      ]

      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...mixedScenarios), // mixed currency scenario
          async (userId, [billingCurrency, menuCurrency]) => {
            // Action: Set mixed currency scenario
            await setBillingCurrency(billingCurrency, userId)
            const menuResult = await setMenuCurrency(userId, menuCurrency, true)
            
            // Verify: Both operations succeeded
            expect(menuResult.success).toBe(true)
            
            // Verify: Both currencies persist correctly
            const retrievedBillingCurrency = await getBillingCurrency(userId)
            const retrievedMenuCurrency = await getMenuCurrency(userId)
            
            expect(retrievedBillingCurrency).toBe(billingCurrency)
            expect(retrievedMenuCurrency).toBe(menuCurrency)
            
            // Verify: Currencies remain independent
            expect(retrievedBillingCurrency).not.toBe(retrievedMenuCurrency)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain mixed currencies across multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // billing currency
          fc.constantFrom('USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR'), // menu currency
          fc.integer({ min: 2, max: 10 }), // number of read operations
          async (userId, billingCurrency, menuCurrency, numReads) => {
            // Set up: User has mixed currencies
            await setBillingCurrency(billingCurrency, userId)
            await setMenuCurrency(userId, menuCurrency, true)
            
            // Action: Read both currencies multiple times
            for (let i = 0; i < numReads; i++) {
              const retrievedBillingCurrency = await getBillingCurrency(userId)
              const retrievedMenuCurrency = await getMenuCurrency(userId)
              
              // Verify: Both currencies remain consistent
              expect(retrievedBillingCurrency).toBe(billingCurrency)
              expect(retrievedMenuCurrency).toBe(menuCurrency)
              
              // Verify: Currencies remain independent
              if (billingCurrency !== menuCurrency) {
                expect(retrievedBillingCurrency).not.toBe(retrievedMenuCurrency)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should support same currency for both billing and menu', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.constantFrom(...SUPPORTED_BILLING_CURRENCIES), // currency (used for both)
          async (userId, currency) => {
            // Action: Set same currency for both billing and menu
            await setBillingCurrency(currency, userId)
            const menuResult = await setMenuCurrency(userId, currency, true)
            
            // Verify: Both operations succeeded
            expect(menuResult.success).toBe(true)
            
            // Verify: Both currencies are set to the same value
            const retrievedBillingCurrency = await getBillingCurrency(userId)
            const retrievedMenuCurrency = await getMenuCurrency(userId)
            
            expect(retrievedBillingCurrency).toBe(currency)
            expect(retrievedMenuCurrency).toBe(currency)
            expect(retrievedBillingCurrency).toBe(retrievedMenuCurrency)
            
            // Verify: Even when same, they remain independent fields
            // (changing one should not affect the other)
            const newBillingCurrency = SUPPORTED_BILLING_CURRENCIES.find(c => c !== currency) || 'USD'
            await setBillingCurrency(newBillingCurrency, userId)
            
            const finalMenuCurrency = await getMenuCurrency(userId)
            expect(finalMenuCurrency).toBe(currency) // Menu currency unchanged
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
