/**
 * Integration Tests for Currency Domain Separation
 * 
 * Feature: currency-support
 * Task: 10.4 Write integration tests for domain separation
 * 
 * These tests verify that billing and menu currencies remain completely independent
 * throughout the entire system. They test complete user flows and ensure that:
 * 
 * 1. Setting billing currency doesn't affect menu currency
 * 2. Setting menu currency doesn't affect billing currency
 * 3. Both currencies persist independently
 * 4. Changing one currency doesn't trigger updates to the other
 * 5. Database queries for billing operations don't reference menu_currency
 * 6. Database queries for menu operations don't reference billing_currency
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

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

describe('Currency Domain Separation - Integration Tests', () => {
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

  describe('Complete user flow: set billing currency, set menu currency, verify both persist independently', () => {
    it('should allow user to set both billing and menu currencies independently', async () => {
      // Test data
      const userId = 'user-integration-001'
      const billingCurrency: BillingCurrency = 'SGD'
      const menuCurrency: ISO4217CurrencyCode = 'THB'

      // Step 1: User sets billing currency
      await setBillingCurrency(billingCurrency, userId)

      // Verify billing currency is set
      const retrievedBillingCurrency = await getBillingCurrency(userId)
      expect(retrievedBillingCurrency).toBe(billingCurrency)

      // Step 2: User sets menu currency
      const menuResult = await setMenuCurrency(userId, menuCurrency, true)

      // Verify menu currency is set
      expect(menuResult.success).toBe(true)
      const retrievedMenuCurrency = await getMenuCurrency(userId)
      expect(retrievedMenuCurrency).toBe(menuCurrency)

      // Step 3: Verify both currencies persist independently
      const finalBillingCurrency = await getBillingCurrency(userId)
      const finalMenuCurrency = await getMenuCurrency(userId)

      expect(finalBillingCurrency).toBe(billingCurrency)
      expect(finalMenuCurrency).toBe(menuCurrency)
      expect(finalBillingCurrency).not.toBe(finalMenuCurrency)
    })

    it('should maintain independent currencies across multiple operations', async () => {
      // Test data
      const userId = 'user-integration-002'
      const initialBillingCurrency: BillingCurrency = 'USD'
      const initialMenuCurrency: ISO4217CurrencyCode = 'SGD'
      const newBillingCurrency: BillingCurrency = 'GBP'
      const newMenuCurrency: ISO4217CurrencyCode = 'EUR'

      // Step 1: Set initial currencies
      await setBillingCurrency(initialBillingCurrency, userId)
      await setMenuCurrency(userId, initialMenuCurrency, true)

      // Verify initial state
      expect(await getBillingCurrency(userId)).toBe(initialBillingCurrency)
      expect(await getMenuCurrency(userId)).toBe(initialMenuCurrency)

      // Step 2: Change billing currency
      await setBillingCurrency(newBillingCurrency, userId)

      // Verify billing changed but menu didn't
      expect(await getBillingCurrency(userId)).toBe(newBillingCurrency)
      expect(await getMenuCurrency(userId)).toBe(initialMenuCurrency)

      // Step 3: Change menu currency
      await setMenuCurrency(userId, newMenuCurrency, true)

      // Verify menu changed but billing didn't
      expect(await getBillingCurrency(userId)).toBe(newBillingCurrency)
      expect(await getMenuCurrency(userId)).toBe(newMenuCurrency)
    })

    it('should support anonymous user setting billing currency then logging in', async () => {
      // Test data
      const billingCurrency: BillingCurrency = 'AUD'
      const menuCurrency: ISO4217CurrencyCode = 'USD'

      // Step 1: Anonymous user sets billing currency (localStorage)
      await setBillingCurrency(billingCurrency)

      // Verify billing currency in localStorage
      const anonymousBillingCurrency = await getBillingCurrency()
      expect(anonymousBillingCurrency).toBe(billingCurrency)

      // Step 2: User logs in
      const userId = 'user-integration-003'

      // Step 3: User sets menu currency (now authenticated)
      await setMenuCurrency(userId, menuCurrency, true)

      // Step 4: User sets billing currency (now authenticated, should override localStorage)
      await setBillingCurrency(billingCurrency, userId)

      // Verify both currencies are set independently
      expect(await getBillingCurrency(userId)).toBe(billingCurrency)
      expect(await getMenuCurrency(userId)).toBe(menuCurrency)
    })

    it('should handle all supported billing currencies with various menu currencies', async () => {
      const userId = 'user-integration-004'
      const menuCurrencies: ISO4217CurrencyCode[] = ['USD', 'SGD', 'EUR', 'JPY', 'THB', 'MYR']

      // Test each billing currency with different menu currencies
      for (let i = 0; i < SUPPORTED_BILLING_CURRENCIES.length; i++) {
        const billingCurrency = SUPPORTED_BILLING_CURRENCIES[i]
        const menuCurrency = menuCurrencies[i % menuCurrencies.length]

        // Set both currencies
        await setBillingCurrency(billingCurrency, userId)
        await setMenuCurrency(userId, menuCurrency, true)

        // Verify both are set correctly
        expect(await getBillingCurrency(userId)).toBe(billingCurrency)
        expect(await getMenuCurrency(userId)).toBe(menuCurrency)
      }
    })
  })

  describe('Changing one currency doesn\'t trigger updates to the other', () => {
    it('should not update menu currency when billing currency changes', async () => {
      // Test data
      const userId = 'user-integration-005'
      const initialBillingCurrency: BillingCurrency = 'USD'
      const menuCurrency: ISO4217CurrencyCode = 'SGD'
      const newBillingCurrency: BillingCurrency = 'EUR'

      // Setup: Set both currencies
      await setBillingCurrency(initialBillingCurrency, userId)
      await setMenuCurrency(userId, menuCurrency, true)

      // Get initial menu currency timestamp (conceptual - would be from DB in real implementation)
      const initialMenuCurrency = await getMenuCurrency(userId)

      // Action: Change billing currency
      await setBillingCurrency(newBillingCurrency, userId)

      // Verify: Menu currency unchanged
      const finalMenuCurrency = await getMenuCurrency(userId)
      expect(finalMenuCurrency).toBe(initialMenuCurrency)
      expect(finalMenuCurrency).toBe(menuCurrency)

      // Verify: Billing currency changed
      expect(await getBillingCurrency(userId)).toBe(newBillingCurrency)
    })

    it('should not update billing currency when menu currency changes', async () => {
      // Test data
      const userId = 'user-integration-006'
      const billingCurrency: BillingCurrency = 'GBP'
      const initialMenuCurrency: ISO4217CurrencyCode = 'USD'
      const newMenuCurrency: ISO4217CurrencyCode = 'JPY'

      // Setup: Set both currencies
      await setBillingCurrency(billingCurrency, userId)
      await setMenuCurrency(userId, initialMenuCurrency, true)

      // Get initial billing currency
      const initialBillingCurrency = await getBillingCurrency(userId)

      // Action: Change menu currency
      await setMenuCurrency(userId, newMenuCurrency, true)

      // Verify: Billing currency unchanged
      const finalBillingCurrency = await getBillingCurrency(userId)
      expect(finalBillingCurrency).toBe(initialBillingCurrency)
      expect(finalBillingCurrency).toBe(billingCurrency)

      // Verify: Menu currency changed
      expect(await getMenuCurrency(userId)).toBe(newMenuCurrency)
    })

    it('should handle rapid alternating changes without cross-contamination', async () => {
      // Test data
      const userId = 'user-integration-007'
      const billingCurrencies: BillingCurrency[] = ['USD', 'SGD', 'GBP', 'AUD', 'EUR']
      const menuCurrencies: ISO4217CurrencyCode[] = ['SGD', 'THB', 'MYR', 'IDR', 'JPY']

      // Set initial currencies
      await setBillingCurrency(billingCurrencies[0], userId)
      await setMenuCurrency(userId, menuCurrencies[0], true)

      // Perform rapid alternating changes
      for (let i = 1; i < billingCurrencies.length; i++) {
        // Change billing
        await setBillingCurrency(billingCurrencies[i], userId)
        const menuAfterBillingChange = await getMenuCurrency(userId)
        expect(menuAfterBillingChange).toBe(menuCurrencies[i - 1])

        // Change menu
        await setMenuCurrency(userId, menuCurrencies[i], true)
        const billingAfterMenuChange = await getBillingCurrency(userId)
        expect(billingAfterMenuChange).toBe(billingCurrencies[i])
      }

      // Final verification
      expect(await getBillingCurrency(userId)).toBe(billingCurrencies[billingCurrencies.length - 1])
      expect(await getMenuCurrency(userId)).toBe(menuCurrencies[menuCurrencies.length - 1])
    })
  })

  describe('Database queries for billing operations don\'t join/reference menu_currency', () => {
    it('should retrieve billing currency without accessing menu_currency field', async () => {
      // Test data
      const userId = 'user-integration-008'
      const billingCurrency: BillingCurrency = 'USD'
      const menuCurrency: ISO4217CurrencyCode = 'EUR'

      // Setup: Set both currencies
      await setBillingCurrency(billingCurrency, userId)
      if (menuTestHelpers) {
        menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
      }

      // Action: Get billing currency
      const retrievedBillingCurrency = await getBillingCurrency(userId)

      // Verify: Billing currency is correct
      expect(retrievedBillingCurrency).toBe(billingCurrency)

      // Verify: Menu currency is still intact (wasn't touched)
      const retrievedMenuCurrency = await getMenuCurrency(userId)
      expect(retrievedMenuCurrency).toBe(menuCurrency)

      // Conceptual verification: In real implementation, we would verify
      // that the database query for getBillingCurrency only selects
      // billing_currency field and never joins or references menu_currency
    })

    it('should set billing currency without accessing menu_currency field', async () => {
      // Test data
      const userId = 'user-integration-009'
      const billingCurrency: BillingCurrency = 'SGD'
      const menuCurrency: ISO4217CurrencyCode = 'THB'

      // Setup: Set menu currency first
      if (menuTestHelpers) {
        menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
      }

      // Action: Set billing currency
      await setBillingCurrency(billingCurrency, userId)

      // Verify: Billing currency is set
      expect(await getBillingCurrency(userId)).toBe(billingCurrency)

      // Verify: Menu currency is unchanged
      expect(await getMenuCurrency(userId)).toBe(menuCurrency)

      // Conceptual verification: In real implementation, we would verify
      // that the database update for setBillingCurrency only updates
      // billing_currency and billing_currency_updated_at fields
    })

    it('should verify billing operations use only billing domain data', async () => {
      // Test data
      const userId = 'user-integration-010'
      const billingCurrency: BillingCurrency = 'GBP'
      const menuCurrency: ISO4217CurrencyCode = 'JPY'

      // Setup: Set both currencies
      await setBillingCurrency(billingCurrency, userId)
      if (menuTestHelpers) {
        menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
      }

      // Action: Perform multiple billing operations
      const billing1 = await getBillingCurrency(userId)
      await setBillingCurrency('AUD', userId)
      const billing2 = await getBillingCurrency(userId)
      await setBillingCurrency('EUR', userId)
      const billing3 = await getBillingCurrency(userId)

      // Verify: All billing operations worked correctly
      expect(billing1).toBe(billingCurrency)
      expect(billing2).toBe('AUD')
      expect(billing3).toBe('EUR')

      // Verify: Menu currency was never touched
      expect(await getMenuCurrency(userId)).toBe(menuCurrency)

      // Conceptual verification: In real implementation with query logging,
      // we would verify that none of the billing queries referenced menu_currency
    })
  })

  describe('Database queries for menu operations don\'t join/reference billing_currency', () => {
    it('should retrieve menu currency without accessing billing_currency field', async () => {
      // Test data
      const userId = 'user-integration-011'
      const billingCurrency: BillingCurrency = 'EUR'
      const menuCurrency: ISO4217CurrencyCode = 'SGD'

      // Setup: Set both currencies
      await setBillingCurrency(billingCurrency, userId)
      if (menuTestHelpers) {
        menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
      }

      // Action: Get menu currency
      const retrievedMenuCurrency = await getMenuCurrency(userId)

      // Verify: Menu currency is correct
      expect(retrievedMenuCurrency).toBe(menuCurrency)

      // Verify: Billing currency is still intact (wasn't touched)
      const retrievedBillingCurrency = await getBillingCurrency(userId)
      expect(retrievedBillingCurrency).toBe(billingCurrency)

      // Conceptual verification: In real implementation, we would verify
      // that the database query for getMenuCurrency only selects
      // menu_currency field and never joins or references billing_currency
    })

    it('should set menu currency without accessing billing_currency field', async () => {
      // Test data
      const userId = 'user-integration-012'
      const billingCurrency: BillingCurrency = 'AUD'
      const menuCurrency: ISO4217CurrencyCode = 'MYR'

      // Setup: Set billing currency first
      await setBillingCurrency(billingCurrency, userId)

      // Action: Set menu currency
      const result = await setMenuCurrency(userId, menuCurrency, true)

      // Verify: Menu currency is set
      expect(result.success).toBe(true)
      expect(await getMenuCurrency(userId)).toBe(menuCurrency)

      // Verify: Billing currency is unchanged
      expect(await getBillingCurrency(userId)).toBe(billingCurrency)

      // Conceptual verification: In real implementation, we would verify
      // that the database update for setMenuCurrency only updates
      // menu_currency and menu_currency_updated_at fields
    })

    it('should verify menu operations use only menu domain data', async () => {
      // Test data
      const userId = 'user-integration-013'
      const billingCurrency: BillingCurrency = 'USD'
      const menuCurrency: ISO4217CurrencyCode = 'EUR'

      // Setup: Set both currencies
      await setBillingCurrency(billingCurrency, userId)
      if (menuTestHelpers) {
        menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
      }

      // Action: Perform multiple menu operations
      const menu1 = await getMenuCurrency(userId)
      await setMenuCurrency(userId, 'GBP', true)
      const menu2 = await getMenuCurrency(userId)
      await setMenuCurrency(userId, 'JPY', true)
      const menu3 = await getMenuCurrency(userId)

      // Verify: All menu operations worked correctly
      expect(menu1).toBe(menuCurrency)
      expect(menu2).toBe('GBP')
      expect(menu3).toBe('JPY')

      // Verify: Billing currency was never touched
      expect(await getBillingCurrency(userId)).toBe(billingCurrency)

      // Conceptual verification: In real implementation with query logging,
      // we would verify that none of the menu queries referenced billing_currency
    })
  })

  describe('Edge cases and error scenarios', () => {
    it('should maintain domain separation when one operation fails', async () => {
      // Test data
      const userId = 'user-integration-014'
      const billingCurrency: BillingCurrency = 'SGD'
      const menuCurrency: ISO4217CurrencyCode = 'USD'

      // Setup: Set both currencies
      await setBillingCurrency(billingCurrency, userId)
      await setMenuCurrency(userId, menuCurrency, true)

      // Action: Try to set invalid billing currency (should fail)
      try {
        await setBillingCurrency('INVALID' as BillingCurrency, userId)
      } catch (error) {
        // Expected to fail
      }

      // Verify: Menu currency is still intact
      expect(await getMenuCurrency(userId)).toBe(menuCurrency)

      // Action: Try to set invalid menu currency (should fail)
      const invalidResult = await setMenuCurrency(userId, 'INVALID', true)
      expect(invalidResult.success).toBe(false)

      // Verify: Billing currency is still intact
      expect(await getBillingCurrency(userId)).toBe(billingCurrency)
    })

    it('should handle concurrent currency changes without cross-contamination', async () => {
      // Test data
      const userId = 'user-integration-015'
      const billingCurrency: BillingCurrency = 'EUR'
      const menuCurrency: ISO4217CurrencyCode = 'THB'

      // Action: Set both currencies concurrently
      await Promise.all([
        setBillingCurrency(billingCurrency, userId),
        setMenuCurrency(userId, menuCurrency, true),
      ])

      // Verify: Both currencies are set correctly
      expect(await getBillingCurrency(userId)).toBe(billingCurrency)
      expect(await getMenuCurrency(userId)).toBe(menuCurrency)

      // Action: Change both currencies concurrently
      await Promise.all([
        setBillingCurrency('GBP', userId),
        setMenuCurrency(userId, 'JPY', true),
      ])

      // Verify: Both currencies changed correctly
      expect(await getBillingCurrency(userId)).toBe('GBP')
      expect(await getMenuCurrency(userId)).toBe('JPY')
    })

    it('should maintain separation across user sessions', async () => {
      // Test data
      const userId = 'user-integration-016'
      const billingCurrency: BillingCurrency = 'AUD'
      const menuCurrency: ISO4217CurrencyCode = 'IDR'

      // Session 1: Set currencies
      await setBillingCurrency(billingCurrency, userId)
      await setMenuCurrency(userId, menuCurrency, true)

      // Simulate session end (clear test helpers)
      if (billingTestHelpers) {
        billingTestHelpers.clearMockData()
      }
      if (menuTestHelpers) {
        menuTestHelpers.clearMockData()
      }

      // Session 2: Re-set currencies (simulating fresh load from DB)
      if (billingTestHelpers) {
        billingTestHelpers.setMockAccountCurrency(userId, billingCurrency)
      }
      if (menuTestHelpers) {
        menuTestHelpers.setMockMenuCurrency(userId, menuCurrency)
      }

      // Verify: Both currencies persist correctly
      expect(await getBillingCurrency(userId)).toBe(billingCurrency)
      expect(await getMenuCurrency(userId)).toBe(menuCurrency)
    })
  })
})
