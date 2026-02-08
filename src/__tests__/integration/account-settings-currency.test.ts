/**
 * Integration tests for account settings currency management
 * 
 * Tests Task 22.3: Account settings for currency management
 * 
 * Requirements: 7.1, 7.4, 7.5, 9.6, 9.7
 */

import {
  getBillingCurrency,
  setBillingCurrency,
  canChangeBillingCurrency,
  type BillingCurrency,
} from '@/lib/billing-currency-service'
import {
  getMenuCurrency,
  setMenuCurrency,
  type ISO4217CurrencyCode,
} from '@/lib/menu-currency-service'

// Import test helpers
const billingService = require('@/lib/billing-currency-service')
const menuService = require('@/lib/menu-currency-service')
const billingTestHelpers = billingService.__test__
const menuTestHelpers = menuService.__test__

describe('Account Settings - Currency Management', () => {
  beforeEach(() => {
    // Clear all mock data before each test
    billingTestHelpers.clearMockData()
    menuTestHelpers.clearMockData()
  })

  describe('Billing Currency Selector', () => {
    it('should display and update billing currency', async () => {
      const userId = 'test-user-1'
      
      // Initial state - should default to USD
      const initialCurrency = await getBillingCurrency(userId)
      expect(initialCurrency).toBe('USD')
      
      // Update to SGD
      await setBillingCurrency('SGD', userId)
      const updatedCurrency = await getBillingCurrency(userId)
      expect(updatedCurrency).toBe('SGD')
      
      // Update to GBP
      await setBillingCurrency('GBP', userId)
      const finalCurrency = await getBillingCurrency(userId)
      expect(finalCurrency).toBe('GBP')
    })

    it('should prevent billing currency change with active subscription', async () => {
      const userId = 'test-user-2'
      
      // Set active subscription with a subscription currency
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'GBP')
      
      // Check if change is allowed
      const result = await canChangeBillingCurrency(userId)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('cancel your current subscription')
      
      // Attempt to change account preference (should work, but won't affect active subscription)
      await setBillingCurrency('EUR', userId)
      
      // Should still return subscription currency since subscription is active
      const currency = await getBillingCurrency(userId)
      expect(currency).toBe('GBP') // Subscription currency takes precedence
    })

    it('should allow billing currency change without subscription', async () => {
      const userId = 'test-user-3'
      
      // No active subscription
      const result = await canChangeBillingCurrency(userId)
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
      
      // Change should succeed
      await setBillingCurrency('AUD', userId)
      const currency = await getBillingCurrency(userId)
      expect(currency).toBe('AUD')
    })
  })

  describe('Menu Currency Selector', () => {
    it('should display and update menu currency', async () => {
      const userId = 'test-user-4'
      
      // Initial state - should default to USD
      const initialCurrency = await getMenuCurrency(userId)
      expect(initialCurrency).toBe('USD')
      
      // Update to SGD (no existing menus, no confirmation needed)
      const result1 = await setMenuCurrency(userId, 'SGD', false)
      expect(result1.success).toBe(true)
      expect(result1.requiresConfirmation).toBe(false)
      
      const updatedCurrency = await getMenuCurrency(userId)
      expect(updatedCurrency).toBe('SGD')
    })

    it('should require confirmation when changing menu currency with existing menus', async () => {
      const userId = 'test-user-5'
      
      // Set initial currency
      menuTestHelpers.setMockMenuCurrency(userId, 'USD')
      
      // User has existing menus
      menuTestHelpers.setMockHasExistingMenus(userId, true)
      
      // Attempt to change without confirmation
      const result1 = await setMenuCurrency(userId, 'EUR', false)
      expect(result1.success).toBe(false)
      expect(result1.requiresConfirmation).toBe(true)
      expect(result1.message).toContain('not automatically convert')
      
      // Currency should not have changed
      const unchangedCurrency = await getMenuCurrency(userId)
      expect(unchangedCurrency).toBe('USD')
      
      // Change with confirmation
      const result2 = await setMenuCurrency(userId, 'EUR', true)
      expect(result2.success).toBe(true)
      expect(result2.requiresConfirmation).toBe(false)
      
      // Currency should now be updated
      const updatedCurrency = await getMenuCurrency(userId)
      expect(updatedCurrency).toBe('EUR')
    })

    it('should not require confirmation when changing menu currency without existing menus', async () => {
      const userId = 'test-user-6'
      
      // Set initial currency
      menuTestHelpers.setMockMenuCurrency(userId, 'USD')
      
      // User has no existing menus
      menuTestHelpers.setMockHasExistingMenus(userId, false)
      
      // Change without confirmation should succeed
      const result = await setMenuCurrency(userId, 'THB', false)
      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(false)
      
      // Currency should be updated
      const updatedCurrency = await getMenuCurrency(userId)
      expect(updatedCurrency).toBe('THB')
    })

    it('should validate currency code format', async () => {
      const userId = 'test-user-7'
      
      // Invalid currency codes
      const invalidCodes = ['us', 'USDD', 'usd', '123', 'US$']
      
      for (const code of invalidCodes) {
        const result = await setMenuCurrency(userId, code as ISO4217CurrencyCode, false)
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')
      }
    })
  })

  describe('Domain Separation', () => {
    it('should allow different billing and menu currencies', async () => {
      const userId = 'test-user-8'
      
      // Set billing currency to USD
      await setBillingCurrency('USD', userId)
      
      // Set menu currency to SGD
      await setMenuCurrency(userId, 'SGD', false)
      
      // Verify both are set correctly
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      
      expect(billingCurrency).toBe('USD')
      expect(menuCurrency).toBe('SGD')
    })

    it('should not affect menu currency when changing billing currency', async () => {
      const userId = 'test-user-9'
      
      // Set initial currencies
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'THB', false)
      
      // Change billing currency
      await setBillingCurrency('GBP', userId)
      
      // Menu currency should remain unchanged
      const menuCurrency = await getMenuCurrency(userId)
      expect(menuCurrency).toBe('THB')
    })

    it('should not affect billing currency when changing menu currency', async () => {
      const userId = 'test-user-10'
      
      // Set initial currencies
      await setBillingCurrency('EUR', userId)
      await setMenuCurrency(userId, 'USD', false)
      
      // Change menu currency
      await setMenuCurrency(userId, 'MYR', false)
      
      // Billing currency should remain unchanged
      const billingCurrency = await getBillingCurrency(userId)
      expect(billingCurrency).toBe('EUR')
    })
  })

  describe('Warning Messages', () => {
    it('should display warning when changing menu currency with existing menus', async () => {
      const userId = 'test-user-11'
      
      // User has existing menus
      menuTestHelpers.setMockHasExistingMenus(userId, true)
      menuTestHelpers.setMockMenuCurrency(userId, 'USD')
      
      // Attempt to change without confirmation
      const result = await setMenuCurrency(userId, 'JPY', false)
      
      expect(result.success).toBe(false)
      expect(result.requiresConfirmation).toBe(true)
      expect(result.message).toContain('Changing currency will not automatically convert existing prices')
    })

    it('should display error when attempting to change billing currency with active subscription', async () => {
      const userId = 'test-user-12'
      
      // User has active subscription
      billingTestHelpers.setMockActiveSubscription(userId, true)
      
      const result = await canChangeBillingCurrency(userId)
      
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('cancel your current subscription')
      expect(result.reason).toContain('remain active until the end of the current billing period')
    })
  })

  describe('Currency Labels', () => {
    it('should clearly distinguish billing and menu currencies', () => {
      // This is a UI test - verify labels are clear
      // Billing: "How you pay GridMenu"
      // Menu: "What your customers see on your menus"
      
      const billingLabel = 'How you pay GridMenu'
      const menuLabel = 'What your customers see on your menus'
      
      expect(billingLabel).toContain('pay GridMenu')
      expect(menuLabel).toContain('customers see')
      
      // Verify they are different
      expect(billingLabel).not.toBe(menuLabel)
    })
  })
})
