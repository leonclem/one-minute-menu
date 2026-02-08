/**
 * End-to-End Tests for Currency Change Flows
 * 
 * Tests Task 25.2: Currency change flows with appropriate restrictions
 * 
 * Requirements: 4.1, 4.2, 7.5
 * 
 * This test suite validates:
 * - Changing billing currency without subscription (allowed)
 * - Attempting to change billing currency with subscription (blocked)
 * - Changing menu currency without existing menus (allowed)
 * - Changing menu currency with existing menus (requires confirmation)
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

// Mock Stripe configuration for tests
jest.mock('@/lib/stripe-config', () => ({
  getPriceIdForCurrency: jest.fn((productType: string, currency: string) => {
    return `price_test_${productType}_${currency}`
  }),
  getAllPriceIds: jest.fn((productType: string) => ({
    SGD: `price_test_${productType}_SGD`,
    USD: `price_test_${productType}_USD`,
    GBP: `price_test_${productType}_GBP`,
    AUD: `price_test_${productType}_AUD`,
    EUR: `price_test_${productType}_EUR`,
  })),
  validateStripeConfig: jest.fn(),
}))

// Import test helpers
const billingService = require('@/lib/billing-currency-service')
const menuService = require('@/lib/menu-currency-service')
const billingTestHelpers = billingService.__test__
const menuTestHelpers = menuService.__test__

describe('E2E: Currency Change Flows', () => {
  beforeEach(() => {
    // Clear all mock data before each test
    billingTestHelpers.clearMockData()
    menuTestHelpers.clearMockData()
  })

  describe('Billing Currency Changes', () => {
    describe('Without Active Subscription', () => {
      const userId = 'billing-change-no-sub-user'

      it('should allow changing billing currency freely', async () => {
        // Step 1: Set initial billing currency
        await setBillingCurrency('USD', userId)
        let billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('USD')

        // Step 2: Verify change is allowed
        let canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(true)
        expect(canChange.reason).toBeUndefined()

        // Step 3: Change to GBP
        await setBillingCurrency('GBP', userId)
        billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('GBP')

        // Step 4: Change to EUR
        await setBillingCurrency('EUR', userId)
        billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('EUR')

        // Step 5: Change to SGD
        await setBillingCurrency('SGD', userId)
        billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('SGD')

        // Step 6: Change to AUD
        await setBillingCurrency('AUD', userId)
        billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('AUD')

        // Step 7: Verify final state
        canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(true)
      })

      it('should allow multiple rapid changes without subscription', async () => {
        // Rapid currency changes
        await setBillingCurrency('USD', userId)
        await setBillingCurrency('GBP', userId)
        await setBillingCurrency('EUR', userId)
        await setBillingCurrency('SGD', userId)

        // Verify final state
        const billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('SGD')

        // Verify still allowed to change
        const canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(true)
      })

      it('should persist billing currency changes across operations', async () => {
        // Set initial currency
        await setBillingCurrency('USD', userId)

        // Perform other operations (simulate menu currency change)
        await setMenuCurrency(userId, 'THB', false)

        // Change billing currency
        await setBillingCurrency('EUR', userId)

        // Verify billing currency persisted
        const billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('EUR')

        // Verify menu currency unaffected
        const menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('THB')
      })
    })

    describe('With Active Subscription', () => {
      const userId = 'billing-change-with-sub-user'

      beforeEach(() => {
        // Setup: User has active subscription
        billingTestHelpers.setMockActiveSubscription(userId, true)
        billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
      })

      it('should block billing currency change with active subscription', async () => {
        // Step 1: Set initial billing currency (matches subscription)
        await setBillingCurrency('USD', userId)

        // Step 2: Verify subscription is active
        const billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('USD')

        // Step 3: Check if change is allowed
        const canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(false)
        expect(canChange.reason).toBeDefined()
        expect(canChange.reason).toContain('cancel')
        expect(canChange.reason).toContain('subscription')

        // Step 4: User can set account preference, but subscription currency takes precedence
        // Note: In real implementation, UI would prevent this based on canChangeBillingCurrency
        await setBillingCurrency('GBP', userId)
        
        // Step 5: Verify subscription currency still takes precedence
        const finalBillingCurrency = await getBillingCurrency(userId)
        expect(finalBillingCurrency).toBe('USD') // Subscription currency, not account preference
      })

      it('should display clear error message when change is blocked', async () => {
        // Check change permission
        const canChange = await canChangeBillingCurrency(userId)

        expect(canChange.allowed).toBe(false)
        expect(canChange.reason).toBeDefined()

        // Verify error message is user-friendly
        const errorMessage = canChange.reason!
        expect(errorMessage.toLowerCase()).toContain('cancel')
        expect(errorMessage.toLowerCase()).toContain('subscription')

        // Should explain the process
        expect(
          errorMessage.toLowerCase().includes('current billing period') ||
          errorMessage.toLowerCase().includes('end of') ||
          errorMessage.toLowerCase().includes('active')
        ).toBe(true)
      })

      it('should maintain subscription currency even if account preference differs', async () => {
        // Step 1: User's account preference is EUR (set before subscription)
        billingTestHelpers.setMockAccountCurrency(userId, 'EUR')

        // Step 2: But subscription is in USD
        billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')

        // Step 3: getBillingCurrency should return subscription currency
        const billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('USD')

        // Step 4: Verify change is blocked
        const canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(false)
      })

      it('should allow change after subscription is canceled', async () => {
        // Step 1: Initially blocked
        let canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(false)

        // Step 2: Cancel subscription
        billingTestHelpers.setMockActiveSubscription(userId, false)
        billingTestHelpers.setMockSubscriptionCurrency(userId, null)

        // Step 3: Now change should be allowed
        canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(true)

        // Step 4: Change billing currency
        await setBillingCurrency('GBP', userId)
        const billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('GBP')
      })

      it('should use new currency when resubscribing after cancellation', async () => {
        // Step 1: Cancel subscription
        billingTestHelpers.setMockActiveSubscription(userId, false)
        billingTestHelpers.setMockSubscriptionCurrency(userId, null)

        // Step 2: Change billing currency
        await setBillingCurrency('EUR', userId)

        // Step 3: Resubscribe with new currency
        billingTestHelpers.setMockActiveSubscription(userId, true)
        billingTestHelpers.setMockSubscriptionCurrency(userId, 'EUR')

        // Step 4: Verify new subscription uses EUR
        const billingCurrency = await getBillingCurrency(userId)
        expect(billingCurrency).toBe('EUR')

        // Step 5: Verify change is now blocked again
        const canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(false)
      })
    })

    describe('Edge Cases', () => {
      it('should handle subscription status changes correctly', async () => {
        const userId = 'billing-edge-case-user'

        // Start without subscription
        await setBillingCurrency('USD', userId)
        let canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(true)

        // Add subscription
        billingTestHelpers.setMockActiveSubscription(userId, true)
        billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
        canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(false)

        // Remove subscription
        billingTestHelpers.setMockActiveSubscription(userId, false)
        billingTestHelpers.setMockSubscriptionCurrency(userId, null)
        canChange = await canChangeBillingCurrency(userId)
        expect(canChange.allowed).toBe(true)
      })

      it('should handle all supported billing currencies', async () => {
        const userId = 'billing-all-currencies-user'
        const supportedCurrencies: BillingCurrency[] = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']

        for (const currency of supportedCurrencies) {
          await setBillingCurrency(currency, userId)
          const billingCurrency = await getBillingCurrency(userId)
          expect(billingCurrency).toBe(currency)
        }
      })
    })
  })

  describe('Menu Currency Changes', () => {
    describe('Without Existing Menus', () => {
      const userId = 'menu-change-no-menus-user'

      beforeEach(() => {
        // Setup: User has no existing menus
        menuTestHelpers.setMockHasExistingMenus(userId, false)
      })

      it('should allow changing menu currency freely without confirmation', async () => {
        // Step 1: Set initial menu currency
        let result = await setMenuCurrency(userId, 'USD', false)
        expect(result.success).toBe(true)
        expect(result.requiresConfirmation).toBe(false)

        let menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('USD')

        // Step 2: Change to SGD
        result = await setMenuCurrency(userId, 'SGD', false)
        expect(result.success).toBe(true)
        expect(result.requiresConfirmation).toBe(false)

        menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('SGD')

        // Step 3: Change to EUR
        result = await setMenuCurrency(userId, 'EUR', false)
        expect(result.success).toBe(true)

        menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('EUR')

        // Step 4: Change to THB
        result = await setMenuCurrency(userId, 'THB', false)
        expect(result.success).toBe(true)

        menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('THB')
      })

      it('should allow rapid menu currency changes without menus', async () => {
        // Rapid changes
        await setMenuCurrency(userId, 'USD', false)
        await setMenuCurrency(userId, 'SGD', false)
        await setMenuCurrency(userId, 'EUR', false)
        await setMenuCurrency(userId, 'JPY', false)

        // Verify final state
        const menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('JPY')
      })

      it('should accept any valid ISO 4217 currency code', async () => {
        const currencies: ISO4217CurrencyCode[] = [
          'USD', 'SGD', 'EUR', 'GBP', 'JPY', 'THB', 'MYR', 'IDR', 'KRW', 'CNY'
        ]

        for (const currency of currencies) {
          const result = await setMenuCurrency(userId, currency, false)
          expect(result.success).toBe(true)
          expect(result.requiresConfirmation).toBe(false)

          const menuCurrency = await getMenuCurrency(userId)
          expect(menuCurrency).toBe(currency)
        }
      })

      it('should not require confirmation flag when no menus exist', async () => {
        // confirmed=false should work
        let result = await setMenuCurrency(userId, 'USD', false)
        expect(result.success).toBe(true)

        // confirmed=true should also work (but not required)
        result = await setMenuCurrency(userId, 'EUR', true)
        expect(result.success).toBe(true)
      })
    })

    describe('With Existing Menus', () => {
      const userId = 'menu-change-with-menus-user'

      beforeEach(() => {
        // Setup: User has existing menus with prices
        menuTestHelpers.setMockHasExistingMenus(userId, true)
      })

      it('should require confirmation when changing menu currency with existing menus', async () => {
        // Step 1: Set initial menu currency
        await setMenuCurrency(userId, 'USD', false)

        // Step 2: Attempt to change without confirmation (should fail)
        const result1 = await setMenuCurrency(userId, 'EUR', false)
        expect(result1.success).toBe(false)
        expect(result1.requiresConfirmation).toBe(true)
        expect(result1.message).toBeDefined()
        expect(result1.message).toContain('not automatically convert')

        // Step 3: Verify currency unchanged
        let menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('USD')

        // Step 4: Change with confirmation (should succeed)
        const result2 = await setMenuCurrency(userId, 'EUR', true)
        expect(result2.success).toBe(true)
        expect(result2.requiresConfirmation).toBe(false)

        // Step 5: Verify currency changed
        menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('EUR')
      })

      it('should display clear warning message about non-conversion', async () => {
        // Attempt change without confirmation
        const result = await setMenuCurrency(userId, 'SGD', false)

        expect(result.success).toBe(false)
        expect(result.requiresConfirmation).toBe(true)
        expect(result.message).toBeDefined()

        // Verify warning message is clear
        const message = result.message!
        expect(message.toLowerCase()).toContain('currency')
        expect(message.toLowerCase()).toContain('not')
        expect(message.toLowerCase()).toContain('convert')
        expect(message.toLowerCase()).toContain('price')
      })

      it('should block multiple change attempts without confirmation', async () => {
        // Set initial currency
        await setMenuCurrency(userId, 'USD', false)

        // Attempt multiple changes without confirmation
        let result = await setMenuCurrency(userId, 'EUR', false)
        expect(result.success).toBe(false)

        result = await setMenuCurrency(userId, 'GBP', false)
        expect(result.success).toBe(false)

        result = await setMenuCurrency(userId, 'SGD', false)
        expect(result.success).toBe(false)

        // Verify currency unchanged
        const menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('USD')
      })

      it('should allow change with confirmation for any target currency', async () => {
        // Set initial currency
        await setMenuCurrency(userId, 'USD', false)

        const targetCurrencies: ISO4217CurrencyCode[] = ['EUR', 'GBP', 'SGD', 'THB', 'JPY']

        for (const targetCurrency of targetCurrencies) {
          const result = await setMenuCurrency(userId, targetCurrency, true)
          expect(result.success).toBe(true)

          const menuCurrency = await getMenuCurrency(userId)
          expect(menuCurrency).toBe(targetCurrency)
        }
      })

      it('should maintain existing menu prices after currency change', async () => {
        // Note: This test verifies the service behavior
        // Actual price persistence is tested in Property 8

        // Set initial currency
        await setMenuCurrency(userId, 'USD', false)

        // Simulate menu with prices
        const menuItems = [
          { id: '1', name: 'Item 1', price: 10.50 },
          { id: '2', name: 'Item 2', price: 15.00 },
          { id: '3', name: 'Item 3', price: 8.75 },
        ]

        // Change currency with confirmation
        const result = await setMenuCurrency(userId, 'EUR', true)
        expect(result.success).toBe(true)

        // Verify currency changed
        const menuCurrency = await getMenuCurrency(userId)
        expect(menuCurrency).toBe('EUR')

        // Note: Prices should remain unchanged (10.50, 15.00, 8.75)
        // This is verified by Property 8 test
      })
    })

    describe('Edge Cases', () => {
      it('should handle menu creation status changes correctly', async () => {
        const userId = 'menu-edge-case-user'

        // Start without menus
        menuTestHelpers.setMockHasExistingMenus(userId, false)
        let result = await setMenuCurrency(userId, 'USD', false)
        expect(result.success).toBe(true)
        expect(result.requiresConfirmation).toBe(false)

        // Create menus
        menuTestHelpers.setMockHasExistingMenus(userId, true)
        result = await setMenuCurrency(userId, 'EUR', false)
        expect(result.success).toBe(false)
        expect(result.requiresConfirmation).toBe(true)

        // With confirmation
        result = await setMenuCurrency(userId, 'EUR', true)
        expect(result.success).toBe(true)
      })

      it('should validate currency codes', async () => {
        const userId = 'menu-validation-user'
        menuTestHelpers.setMockHasExistingMenus(userId, false)

        // Valid 3-letter uppercase codes should work
        let result = await setMenuCurrency(userId, 'USD', false)
        expect(result.success).toBe(true)

        // Invalid codes should be rejected with error result (not thrown)
        result = await setMenuCurrency(userId, 'US', false) // Too short
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')

        result = await setMenuCurrency(userId, 'USDD', false) // Too long
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')

        result = await setMenuCurrency(userId, 'usd', false) // Lowercase
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')

        result = await setMenuCurrency(userId, '123', false) // Numbers
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')
      })
    })
  })

  describe('Cross-Domain Independence', () => {
    it('should maintain independence when changing both currencies', async () => {
      const userId = 'cross-domain-user'

      // Setup
      menuTestHelpers.setMockHasExistingMenus(userId, false)

      // Set initial currencies
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'USD', false)

      // Change billing currency
      await setBillingCurrency('GBP', userId)

      // Verify menu currency unchanged
      let menuCurrency = await getMenuCurrency(userId)
      expect(menuCurrency).toBe('USD')

      // Change menu currency
      await setMenuCurrency(userId, 'EUR', false)

      // Verify billing currency unchanged
      const billingCurrency = await getBillingCurrency(userId)
      expect(billingCurrency).toBe('GBP')

      // Verify final state
      menuCurrency = await getMenuCurrency(userId)
      expect(menuCurrency).toBe('EUR')
      expect(billingCurrency).not.toBe(menuCurrency)
    })

    it('should handle simultaneous restrictions independently', async () => {
      const userId = 'simultaneous-restrictions-user'

      // Setup: Active subscription + existing menus
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
      menuTestHelpers.setMockHasExistingMenus(userId, true)

      // Set initial currencies
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'USD', false)

      // Billing change should be blocked
      const canChangeBilling = await canChangeBillingCurrency(userId)
      expect(canChangeBilling.allowed).toBe(false)

      // Menu change should require confirmation but be possible
      const menuResult1 = await setMenuCurrency(userId, 'EUR', false)
      expect(menuResult1.success).toBe(false)
      expect(menuResult1.requiresConfirmation).toBe(true)

      const menuResult2 = await setMenuCurrency(userId, 'EUR', true)
      expect(menuResult2.success).toBe(true)

      // Verify billing unchanged, menu changed
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('USD')
      expect(menuCurrency).toBe('EUR')
    })

    it('should allow menu changes even when billing is locked', async () => {
      const userId = 'menu-change-billing-locked-user'

      // Setup: Active subscription (billing locked)
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
      menuTestHelpers.setMockHasExistingMenus(userId, false)

      // Set currencies
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'USD', false)

      // Billing change blocked
      const canChangeBilling = await canChangeBillingCurrency(userId)
      expect(canChangeBilling.allowed).toBe(false)

      // Menu change allowed (no existing menus)
      const menuResult = await setMenuCurrency(userId, 'THB', false)
      expect(menuResult.success).toBe(true)

      // Verify
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('USD')
      expect(menuCurrency).toBe('THB')
    })

    it('should allow billing changes even when menu requires confirmation', async () => {
      const userId = 'billing-change-menu-confirmation-user'

      // Setup: No subscription, but has menus
      menuTestHelpers.setMockHasExistingMenus(userId, true)

      // Set currencies
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'USD', false)

      // Billing change allowed (no subscription)
      const canChangeBilling = await canChangeBillingCurrency(userId)
      expect(canChangeBilling.allowed).toBe(true)

      await setBillingCurrency('EUR', userId)

      // Menu change requires confirmation
      const menuResult = await setMenuCurrency(userId, 'THB', false)
      expect(menuResult.success).toBe(false)
      expect(menuResult.requiresConfirmation).toBe(true)

      // Verify
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('EUR')
      expect(menuCurrency).toBe('USD')
    })
  })

  describe('Complete Change Flow Scenarios', () => {
    it('should handle complete lifecycle: setup → subscribe → change attempts → cancel → change', async () => {
      const userId = 'lifecycle-user'

      // Phase 1: Initial setup
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'USD', false)

      // Phase 2: Subscribe
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')

      // Phase 3: Create menus
      menuTestHelpers.setMockHasExistingMenus(userId, true)

      // Phase 4: Attempt changes (both restricted)
      const canChangeBilling1 = await canChangeBillingCurrency(userId)
      expect(canChangeBilling1.allowed).toBe(false)

      const menuResult1 = await setMenuCurrency(userId, 'EUR', false)
      expect(menuResult1.success).toBe(false)

      // Phase 5: Change menu with confirmation (allowed)
      const menuResult2 = await setMenuCurrency(userId, 'EUR', true)
      expect(menuResult2.success).toBe(true)

      // Phase 6: Cancel subscription
      billingTestHelpers.setMockActiveSubscription(userId, false)
      billingTestHelpers.setMockSubscriptionCurrency(userId, null)

      // Phase 7: Change billing (now allowed)
      const canChangeBilling2 = await canChangeBillingCurrency(userId)
      expect(canChangeBilling2.allowed).toBe(true)

      await setBillingCurrency('GBP', userId)

      // Phase 8: Verify final state
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('GBP')
      expect(menuCurrency).toBe('EUR')
    })

    it('should handle new user onboarding flow', async () => {
      const userId = 'new-user'

      // New user: no subscription, no menus
      menuTestHelpers.setMockHasExistingMenus(userId, false)

      // Step 1: Select currencies during onboarding
      await setBillingCurrency('SGD', userId)
      await setMenuCurrency(userId, 'SGD', false)

      // Step 2: Change mind before subscribing
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'THB', false)

      // Step 3: Subscribe
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')

      // Step 4: Create first menu
      menuTestHelpers.setMockHasExistingMenus(userId, true)

      // Step 5: Verify restrictions now apply
      const canChangeBilling = await canChangeBillingCurrency(userId)
      expect(canChangeBilling.allowed).toBe(false)

      const menuResult = await setMenuCurrency(userId, 'MYR', false)
      expect(menuResult.success).toBe(false)
      expect(menuResult.requiresConfirmation).toBe(true)
    })
  })
})
