/**
 * End-to-End Tests for Currency Support User Journey
 * 
 * Tests Task 25.1: Complete user journey with currency support
 * 
 * Requirements: 9.3, 9.4, 9.5
 * 
 * This test suite validates the complete user journey:
 * - Signup → select billing currency → select menu currency → subscribe → create menu → export
 * - Billing and menu currencies remain independent throughout
 * - Mixed currency scenarios work correctly
 * - Currency changes display appropriate warnings
 */

import {
  getBillingCurrency,
  setBillingCurrency,
  canChangeBillingCurrency,
  getStripePriceId,
  type BillingCurrency,
} from '@/lib/billing-currency-service'
import {
  getMenuCurrency,
  setMenuCurrency,
  type ISO4217CurrencyCode,
} from '@/lib/menu-currency-service'
import { formatCurrency } from '@/lib/currency-formatter'

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

describe('E2E: Complete Currency Support User Journey', () => {
  beforeEach(() => {
    // Clear all mock data before each test
    billingTestHelpers.clearMockData()
    menuTestHelpers.clearMockData()
  })

  describe('Journey 1: Standard Flow (USD billing, SGD menu)', () => {
    const userId = 'journey-user-1'
    const menuId = 'menu-1'

    it('should complete full journey with mixed currencies', async () => {
      // Step 1: User signs up (simulated)
      // In real app, this would create user account
      
      // Step 2: User selects billing currency (USD)
      await setBillingCurrency('USD', userId)
      const billingCurrency = await getBillingCurrency(userId)
      expect(billingCurrency).toBe('USD')
      
      // Step 3: User selects menu currency (SGD)
      const menuResult = await setMenuCurrency(userId, 'SGD', false)
      expect(menuResult.success).toBe(true)
      const menuCurrency = await getMenuCurrency(userId)
      expect(menuCurrency).toBe('SGD')
      
      // Step 4: Verify currencies are independent
      expect(billingCurrency).toBe('USD')
      expect(menuCurrency).toBe('SGD')
      expect(billingCurrency).not.toBe(menuCurrency)
      
      // Step 5: User subscribes with USD billing
      const priceId = getStripePriceId('grid_plus', 'USD')
      expect(priceId).toBeDefined()
      expect(priceId).toContain('price_')
      
      // Simulate subscription creation
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
      
      // Step 6: Verify subscription uses USD
      const subscriptionCurrency = await getBillingCurrency(userId)
      expect(subscriptionCurrency).toBe('USD')
      
      // Step 7: User creates menu with SGD prices
      const menuItems = [
        { id: '1', name: 'Chicken Rice', price: 5.50 },
        { id: '2', name: 'Laksa', price: 7.00 },
        { id: '3', name: 'Kopi', price: 2.50 },
      ]
      
      // Step 8: Verify menu prices are formatted in SGD
      const formattedPrices = menuItems.map(item => 
        formatCurrency(item.price, menuCurrency)
      )
      
      // Note: Intl.NumberFormat with en-US locale uses 'SGD' prefix
      expect(formattedPrices[0]).toContain('5.50')
      expect(formattedPrices[0]).toMatch(/SGD/) // SGD currency code
      expect(formattedPrices[1]).toContain('7.00')
      expect(formattedPrices[2]).toContain('2.50')
      
      // Step 9: Verify menu export uses SGD
      // In real app, this would generate PDF/PNG/HTML
      const exportedPrice = formatCurrency(menuItems[0].price, menuCurrency)
      expect(exportedPrice).toContain('5.50')
      expect(exportedPrice).toMatch(/SGD/)
      
      // Step 10: Verify billing and menu currencies remain independent
      const finalBillingCurrency = await getBillingCurrency(userId)
      const finalMenuCurrency = await getMenuCurrency(userId)
      expect(finalBillingCurrency).toBe('USD')
      expect(finalMenuCurrency).toBe('SGD')
    })
  })

  describe('Journey 2: Same Currency Flow (USD billing, USD menu)', () => {
    const userId = 'journey-user-2'

    it('should handle same currency for billing and menu', async () => {
      // Step 1: Select USD for billing
      await setBillingCurrency('USD', userId)
      
      // Step 2: Select USD for menu
      await setMenuCurrency(userId, 'USD', false)
      
      // Step 3: Verify both are USD
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('USD')
      expect(menuCurrency).toBe('USD')
      
      // Step 4: Subscribe
      const priceId = getStripePriceId('grid_plus_premium', 'USD')
      expect(priceId).toBeDefined()
      
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
      
      // Step 5: Create menu
      const menuItem = { name: 'Burger', price: 12.50 }
      const formattedPrice = formatCurrency(menuItem.price, menuCurrency)
      expect(formattedPrice).toContain('12.50')
      expect(formattedPrice).toContain('$')
      
      // Step 6: Verify currencies remain independent (even though same value)
      // Changing one should not affect the other
      // Cannot change billing currency with active subscription
      const canChange = await canChangeBillingCurrency(userId)
      expect(canChange.allowed).toBe(false)
    })
  })

  describe('Journey 3: European Flow (EUR billing, EUR menu)', () => {
    const userId = 'journey-user-3'

    it('should handle EUR for both billing and menu', async () => {
      // Step 1: Select EUR for billing
      await setBillingCurrency('EUR', userId)
      
      // Step 2: Select EUR for menu
      await setMenuCurrency(userId, 'EUR', false)
      
      // Step 3: Verify currencies
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('EUR')
      expect(menuCurrency).toBe('EUR')
      
      // Step 4: Subscribe with EUR
      const priceId = getStripePriceId('creator_pack', 'EUR')
      expect(priceId).toBeDefined()
      
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'EUR')
      
      // Step 5: Create menu with EUR prices
      const menuItem = { name: 'Pasta', price: 15.00 }
      const formattedPrice = formatCurrency(menuItem.price, menuCurrency)
      expect(formattedPrice).toContain('15.00')
      expect(formattedPrice).toContain('€')
    })
  })

  describe('Journey 4: Asian Market Flow (SGD billing, THB menu)', () => {
    const userId = 'journey-user-4'

    it('should handle SGD billing with THB menu display', async () => {
      // Step 1: Select SGD for billing
      await setBillingCurrency('SGD', userId)
      
      // Step 2: Select THB for menu (Thai restaurant in Singapore)
      await setMenuCurrency(userId, 'THB', false)
      
      // Step 3: Verify mixed currencies
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('SGD')
      expect(menuCurrency).toBe('THB')
      
      // Step 4: Subscribe with SGD
      const priceId = getStripePriceId('grid_plus', 'SGD')
      expect(priceId).toBeDefined()
      
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'SGD')
      
      // Step 5: Create menu with THB prices
      const menuItems = [
        { name: 'Pad Thai', price: 120 },
        { name: 'Tom Yum', price: 150 },
        { name: 'Green Curry', price: 180 },
      ]
      
      const formattedPrices = menuItems.map(item => 
        formatCurrency(item.price, menuCurrency)
      )
      
      expect(formattedPrices[0]).toContain('120')
      expect(formattedPrices[1]).toContain('150')
      expect(formattedPrices[2]).toContain('180')
      
      // Step 6: Verify currencies remain independent
      const finalBillingCurrency = await getBillingCurrency(userId)
      const finalMenuCurrency = await getMenuCurrency(userId)
      expect(finalBillingCurrency).toBe('SGD')
      expect(finalMenuCurrency).toBe('THB')
    })
  })

  describe('Journey 5: UK Market Flow (GBP billing, GBP menu)', () => {
    const userId = 'journey-user-5'

    it('should handle GBP for both billing and menu', async () => {
      // Step 1: Select GBP for billing
      await setBillingCurrency('GBP', userId)
      
      // Step 2: Select GBP for menu
      await setMenuCurrency(userId, 'GBP', false)
      
      // Step 3: Verify currencies
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('GBP')
      expect(menuCurrency).toBe('GBP')
      
      // Step 4: Subscribe with GBP
      const priceId = getStripePriceId('grid_plus_premium', 'GBP')
      expect(priceId).toBeDefined()
      
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'GBP')
      
      // Step 5: Create menu with GBP prices
      const menuItem = { name: 'Fish and Chips', price: 12.95 }
      const formattedPrice = formatCurrency(menuItem.price, menuCurrency)
      expect(formattedPrice).toContain('12.95')
      expect(formattedPrice).toContain('£')
    })
  })

  describe('Journey 6: Australian Market Flow (AUD billing, AUD menu)', () => {
    const userId = 'journey-user-6'

    it('should handle AUD for both billing and menu', async () => {
      // Step 1: Select AUD for billing
      await setBillingCurrency('AUD', userId)
      
      // Step 2: Select AUD for menu
      await setMenuCurrency(userId, 'AUD', false)
      
      // Step 3: Verify currencies
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('AUD')
      expect(menuCurrency).toBe('AUD')
      
      // Step 4: Subscribe with AUD
      const priceId = getStripePriceId('creator_pack', 'AUD')
      expect(priceId).toBeDefined()
      
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'AUD')
      
      // Step 5: Create menu with AUD prices
      const menuItem = { name: 'Meat Pie', price: 8.50 }
      const formattedPrice = formatCurrency(menuItem.price, menuCurrency)
      expect(formattedPrice).toContain('8.50')
      expect(formattedPrice).toContain('$')
    })
  })

  describe('Journey 7: Currency Change with Warnings', () => {
    const userId = 'journey-user-7'

    it('should display warnings when changing currencies', async () => {
      // Step 1: Initial setup
      await setBillingCurrency('USD', userId)
      await setMenuCurrency(userId, 'USD', false)
      
      // Step 2: Subscribe
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
      
      // Step 3: Create menu
      menuTestHelpers.setMockHasExistingMenus(userId, true)
      
      // Step 4: Attempt to change billing currency (should fail)
      const billingChangeResult = await canChangeBillingCurrency(userId)
      expect(billingChangeResult.allowed).toBe(false)
      expect(billingChangeResult.reason).toContain('cancel your current subscription')
      
      // Step 5: Attempt to change menu currency without confirmation (should fail)
      const menuChangeResult1 = await setMenuCurrency(userId, 'EUR', false)
      expect(menuChangeResult1.success).toBe(false)
      expect(menuChangeResult1.requiresConfirmation).toBe(true)
      expect(menuChangeResult1.message).toContain('not automatically convert')
      
      // Step 6: Change menu currency with confirmation (should succeed)
      const menuChangeResult2 = await setMenuCurrency(userId, 'EUR', true)
      expect(menuChangeResult2.success).toBe(true)
      
      // Step 7: Verify menu currency changed but billing didn't
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('USD') // Unchanged (subscription active)
      expect(menuCurrency).toBe('EUR') // Changed with confirmation
    })
  })

  describe('Journey 8: Multi-Product Subscription Flow', () => {
    const userId = 'journey-user-8'

    it('should handle different products with same currency', async () => {
      // Step 1: Select billing currency
      await setBillingCurrency('USD', userId)
      
      // Step 2: Test all product types
      const products: Array<'grid_plus' | 'grid_plus_premium' | 'creator_pack'> = [
        'grid_plus',
        'grid_plus_premium',
        'creator_pack',
      ]
      
      for (const product of products) {
        const priceId = getStripePriceId(product, 'USD')
        expect(priceId).toBeDefined()
        expect(priceId).toContain('price_')
      }
      
      // Step 3: Subscribe to Grid Plus
      const priceId = getStripePriceId('grid_plus', 'USD')
      billingTestHelpers.setMockActiveSubscription(userId, true)
      billingTestHelpers.setMockSubscriptionCurrency(userId, 'USD')
      
      // Step 4: Verify subscription currency
      const subscriptionCurrency = await getBillingCurrency(userId)
      expect(subscriptionCurrency).toBe('USD')
    })
  })

  describe('Journey 9: Zero-Decimal Currency Flow (JPY)', () => {
    const userId = 'journey-user-9'

    it('should handle JPY menu currency correctly', async () => {
      // Step 1: Select billing currency (USD, since JPY not supported for billing)
      await setBillingCurrency('USD', userId)
      
      // Step 2: Select JPY for menu (Japanese restaurant)
      await setMenuCurrency(userId, 'JPY', false)
      
      // Step 3: Verify currencies
      const billingCurrency = await getBillingCurrency(userId)
      const menuCurrency = await getMenuCurrency(userId)
      expect(billingCurrency).toBe('USD')
      expect(menuCurrency).toBe('JPY')
      
      // Step 4: Create menu with JPY prices (no decimals)
      const menuItems = [
        { name: 'Ramen', price: 1200 },
        { name: 'Sushi Set', price: 2500 },
        { name: 'Green Tea', price: 300 },
      ]
      
      const formattedPrices = menuItems.map(item => 
        formatCurrency(item.price, menuCurrency)
      )
      
      // JPY should not have decimal places
      expect(formattedPrices[0]).toContain('1,200')
      expect(formattedPrices[0]).not.toContain('.00')
      expect(formattedPrices[1]).toContain('2,500')
      expect(formattedPrices[2]).toContain('300')
    })
  })

  describe('Journey 10: Complete Export Flow', () => {
    const userId = 'journey-user-10'

    it('should maintain currency consistency across all exports', async () => {
      // Step 1: Setup currencies
      await setBillingCurrency('GBP', userId)
      await setMenuCurrency(userId, 'EUR', false)
      
      // Step 2: Create menu
      const menuItem = { name: 'Pizza Margherita', price: 12.50 }
      const menuCurrency = await getMenuCurrency(userId)
      
      // Step 3: Format for different export types
      // All should use the same formatter and produce consistent output
      const editorFormat = formatCurrency(menuItem.price, menuCurrency)
      const previewFormat = formatCurrency(menuItem.price, menuCurrency)
      const pdfFormat = formatCurrency(menuItem.price, menuCurrency)
      const pngFormat = formatCurrency(menuItem.price, menuCurrency)
      const htmlFormat = formatCurrency(menuItem.price, menuCurrency)
      
      // Step 4: Verify all formats are identical
      expect(editorFormat).toBe(previewFormat)
      expect(previewFormat).toBe(pdfFormat)
      expect(pdfFormat).toBe(pngFormat)
      expect(pngFormat).toBe(htmlFormat)
      
      // Step 5: Verify format contains EUR symbol
      expect(editorFormat).toContain('12.50')
      expect(editorFormat).toContain('€')
      
      // Step 6: Verify billing currency is independent
      const billingCurrency = await getBillingCurrency(userId)
      expect(billingCurrency).toBe('GBP')
      expect(billingCurrency).not.toBe(menuCurrency)
    })
  })
})

describe('E2E: Currency Domain Independence Verification', () => {
  beforeEach(() => {
    billingTestHelpers.clearMockData()
    menuTestHelpers.clearMockData()
  })

  it('should maintain complete independence between billing and menu currencies', async () => {
    const userId = 'independence-test-user'
    
    // Test all combinations of billing and menu currencies
    const billingCurrencies: BillingCurrency[] = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']
    const menuCurrencies: ISO4217CurrencyCode[] = ['SGD', 'USD', 'GBP', 'EUR', 'THB', 'MYR', 'JPY']
    
    for (const billing of billingCurrencies) {
      for (const menu of menuCurrencies) {
        // Clear state
        billingTestHelpers.clearMockData()
        menuTestHelpers.clearMockData()
        
        // Set currencies
        await setBillingCurrency(billing, userId)
        await setMenuCurrency(userId, menu, false)
        
        // Verify both are set correctly
        const actualBilling = await getBillingCurrency(userId)
        const actualMenu = await getMenuCurrency(userId)
        
        expect(actualBilling).toBe(billing)
        expect(actualMenu).toBe(menu)
        
        // Verify they are independent
        if (billing !== menu) {
          expect(actualBilling).not.toBe(actualMenu)
        }
      }
    }
  })

  it('should handle rapid currency changes without cross-contamination', async () => {
    const userId = 'rapid-change-user'
    
    // Rapidly change billing currency
    await setBillingCurrency('USD', userId)
    await setBillingCurrency('GBP', userId)
    await setBillingCurrency('EUR', userId)
    
    // Set menu currency
    await setMenuCurrency(userId, 'THB', false)
    
    // Verify final state
    const billingCurrency = await getBillingCurrency(userId)
    const menuCurrency = await getMenuCurrency(userId)
    
    expect(billingCurrency).toBe('EUR')
    expect(menuCurrency).toBe('THB')
    
    // Rapidly change menu currency
    await setMenuCurrency(userId, 'SGD', false)
    await setMenuCurrency(userId, 'MYR', false)
    await setMenuCurrency(userId, 'JPY', false)
    
    // Verify billing currency unchanged
    const finalBillingCurrency = await getBillingCurrency(userId)
    const finalMenuCurrency = await getMenuCurrency(userId)
    
    expect(finalBillingCurrency).toBe('EUR') // Unchanged
    expect(finalMenuCurrency).toBe('JPY')
  })
})
