/**
 * Unit Tests for Menu Currency Service
 * 
 * Feature: currency-support
 * Task: 9.4
 * 
 * Tests cover:
 * - getMenuCurrency returns account setting
 * - setMenuCurrency with and without existing menus
 * - Confirmation requirement logic
 * - hasExistingMenus detection
 * - Currency code validation (3 uppercase letters)
 * - Invalid currency code rejection
 * 
 * Requirements: 5.6, 7.2, 7.5, 15.1, 15.2, 15.3
 */

import {
  getMenuCurrency,
  setMenuCurrency,
  hasExistingMenus,
  suggestMenuCurrency,
  type ISO4217CurrencyCode,
} from '@/lib/menu-currency-service'

// Import test helpers
const menuService = require('@/lib/menu-currency-service')
const testHelpers = menuService.__test__

describe('Menu Currency Service - Unit Tests', () => {
  beforeEach(() => {
    if (testHelpers) {
      testHelpers.clearMockData()
    }
    jest.clearAllMocks()
  })

  describe('getMenuCurrency', () => {
    const userId = 'test-user-123'

    it('should return account menu currency setting', async () => {
      const currency: ISO4217CurrencyCode = 'SGD'

      // Set up account currency
      if (testHelpers) {
        testHelpers.setMockMenuCurrency(userId, currency)
      }

      // Get menu currency
      const result = await getMenuCurrency(userId)

      // Verify: Returns account setting
      expect(result).toBe(currency)
    })

    it('should default to USD when no account setting exists', async () => {
      // No account setting
      const result = await getMenuCurrency(userId)

      // Verify: Defaults to USD
      expect(result).toBe('USD')
    })

    it('should support various ISO 4217 currency codes', async () => {
      const currencies: ISO4217CurrencyCode[] = [
        'SGD', 'USD', 'GBP', 'EUR', 'AUD', 
        'MYR', 'THB', 'IDR', 'JPY', 'KRW'
      ]

      for (const currency of currencies) {
        if (testHelpers) {
          testHelpers.setMockMenuCurrency(userId, currency)
        }

        const result = await getMenuCurrency(userId)
        expect(result).toBe(currency)
      }
    })
  })

  describe('setMenuCurrency - Without Existing Menus', () => {
    const userId = 'test-user-no-menus'

    beforeEach(() => {
      // User has no existing menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }
    })

    it('should set menu currency without confirmation when no existing menus', async () => {
      const currency: ISO4217CurrencyCode = 'EUR'

      // Set menu currency without confirmation
      const result = await setMenuCurrency(userId, currency, false)

      // Verify: Success without requiring confirmation
      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(false)
      expect(result.message).toBeUndefined()

      // Verify: Currency is persisted
      const stored = await getMenuCurrency(userId)
      expect(stored).toBe(currency)
    })

    it('should accept valid ISO 4217 currency codes', async () => {
      const currencies: ISO4217CurrencyCode[] = [
        'SGD', 'USD', 'GBP', 'EUR', 'AUD',
        'MYR', 'THB', 'IDR', 'JPY', 'KRW',
        'CNY', 'INR', 'CAD', 'NZD', 'CHF'
      ]

      for (const currency of currencies) {
        const result = await setMenuCurrency(userId, currency, false)

        // Verify: All valid ISO codes are accepted
        expect(result.success).toBe(true)
        expect(result.requiresConfirmation).toBe(false)
      }
    })

    it('should update menu currency when changed', async () => {
      const initialCurrency: ISO4217CurrencyCode = 'USD'
      const newCurrency: ISO4217CurrencyCode = 'SGD'

      // Set initial currency
      await setMenuCurrency(userId, initialCurrency, false)
      expect(await getMenuCurrency(userId)).toBe(initialCurrency)

      // Change currency
      const result = await setMenuCurrency(userId, newCurrency, false)

      // Verify: Currency is updated
      expect(result.success).toBe(true)
      expect(await getMenuCurrency(userId)).toBe(newCurrency)
    })
  })

  describe('setMenuCurrency - With Existing Menus', () => {
    const userId = 'test-user-with-menus'

    beforeEach(() => {
      // User has existing menus with prices
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, true)
      }
    })

    it('should require confirmation when user has existing menus', async () => {
      const currency: ISO4217CurrencyCode = 'GBP'

      // Attempt to set currency without confirmation
      const result = await setMenuCurrency(userId, currency, false)

      // Verify: Requires confirmation
      expect(result.success).toBe(false)
      expect(result.requiresConfirmation).toBe(true)
      expect(result.message).toBeTruthy()
      expect(result.message).toContain('not automatically convert')
      expect(result.message).toContain('confirm')
    })

    it('should set currency when confirmation is provided', async () => {
      const currency: ISO4217CurrencyCode = 'AUD'

      // Set currency with confirmation
      const result = await setMenuCurrency(userId, currency, true)

      // Verify: Success with confirmation
      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(false)
      expect(result.message).toBeUndefined()

      // Verify: Currency is persisted
      const stored = await getMenuCurrency(userId)
      expect(stored).toBe(currency)
    })

    it('should not persist currency when confirmation is missing', async () => {
      const initialCurrency: ISO4217CurrencyCode = 'USD'
      const newCurrency: ISO4217CurrencyCode = 'EUR'

      // Set initial currency
      if (testHelpers) {
        testHelpers.setMockMenuCurrency(userId, initialCurrency)
      }

      // Attempt to change without confirmation
      const result = await setMenuCurrency(userId, newCurrency, false)

      // Verify: Change rejected
      expect(result.success).toBe(false)
      expect(result.requiresConfirmation).toBe(true)

      // Verify: Original currency unchanged
      const stored = await getMenuCurrency(userId)
      expect(stored).toBe(initialCurrency)
    })

    it('should display clear warning message about non-conversion', async () => {
      const currency: ISO4217CurrencyCode = 'THB'

      // Attempt to set currency without confirmation
      const result = await setMenuCurrency(userId, currency, false)

      // Verify: Warning message is clear
      expect(result.message).toContain('Changing currency')
      expect(result.message).toContain('will not automatically convert')
      expect(result.message).toContain('existing prices')
      expect(result.message).toContain('confirm')
    })
  })

  describe('Currency Code Validation', () => {
    const userId = 'test-user-validation'

    beforeEach(() => {
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }
    })

    it('should validate currency code is exactly 3 uppercase letters', async () => {
      const validCodes = ['USD', 'SGD', 'GBP', 'EUR', 'JPY']

      for (const code of validCodes) {
        const result = await setMenuCurrency(userId, code, false)
        expect(result.success).toBe(true)
      }
    })

    it('should reject lowercase currency codes', async () => {
      const invalidCodes = ['usd', 'sgd', 'gbp', 'eur']

      for (const code of invalidCodes) {
        const result = await setMenuCurrency(userId, code as any, false)

        // Verify: Rejected with clear error
        expect(result.success).toBe(false)
        expect(result.requiresConfirmation).toBe(false)
        expect(result.message).toBeTruthy()
        expect(result.message).toContain('Invalid currency code')
        expect(result.message).toContain('3 uppercase letters')
      }
    })

    it('should reject currency codes with wrong length', async () => {
      const invalidCodes = ['US', 'USDD', 'S', 'SGDDD']

      for (const code of invalidCodes) {
        const result = await setMenuCurrency(userId, code as any, false)

        // Verify: Rejected with clear error
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')
        expect(result.message).toContain('3 uppercase letters')
      }
    })

    it('should reject empty string as currency code', async () => {
      const result = await setMenuCurrency(userId, '' as any, false)

      // Verify: Rejected
      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid currency code')
    })

    it('should reject currency codes with special characters', async () => {
      const invalidCodes = ['US$', 'U-D', 'U.D', 'U D']

      for (const code of invalidCodes) {
        const result = await setMenuCurrency(userId, code as any, false)

        // Verify: Rejected
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')
      }
    })

    it('should reject currency codes with numbers', async () => {
      const invalidCodes = ['US1', '2SD', 'U3D']

      for (const code of invalidCodes) {
        const result = await setMenuCurrency(userId, code as any, false)

        // Verify: Rejected
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')
      }
    })

    it('should reject invalid ISO 4217 codes', async () => {
      // These are 3 uppercase letters but not valid ISO 4217 codes
      const invalidCodes = ['XXX', 'ZZZ', 'AAA', 'BBB']

      for (const code of invalidCodes) {
        const result = await setMenuCurrency(userId, code as any, false)

        // Verify: Rejected (getCurrencyMetadata will fail for invalid codes)
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')
      }
    })

    it('should provide clear error message for invalid codes', async () => {
      const invalidCode = 'invalid'

      const result = await setMenuCurrency(userId, invalidCode as any, false)

      // Verify: Error message includes the invalid code
      expect(result.message).toContain('Invalid currency code')
      expect(result.message).toContain(invalidCode)
      expect(result.message).toContain('3 uppercase letters')
    })
  })

  describe('hasExistingMenus', () => {
    it('should return true when user has menus with prices', async () => {
      const userId = 'test-user-has-menus'

      // Set up user with existing menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, true)
      }

      // Check for existing menus
      const result = await hasExistingMenus(userId)

      // Verify: Returns true
      expect(result).toBe(true)
    })

    it('should return false when user has no menus', async () => {
      const userId = 'test-user-no-menus'

      // Set up user without menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }

      // Check for existing menus
      const result = await hasExistingMenus(userId)

      // Verify: Returns false
      expect(result).toBe(false)
    })

    it('should return false by default for new users', async () => {
      const userId = 'test-user-new'

      // No mock data set (default state)
      const result = await hasExistingMenus(userId)

      // Verify: Returns false for new users
      expect(result).toBe(false)
    })
  })

  describe('Confirmation Requirement Logic', () => {
    it('should not require confirmation for users without menus', async () => {
      const userId = 'test-user-no-menus'
      const currency: ISO4217CurrencyCode = 'EUR'

      // User has no menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }

      // Set currency without confirmation
      const result = await setMenuCurrency(userId, currency, false)

      // Verify: No confirmation required
      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(false)
    })

    it('should require confirmation for users with menus', async () => {
      const userId = 'test-user-with-menus'
      const currency: ISO4217CurrencyCode = 'JPY'

      // User has menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, true)
      }

      // Attempt to set currency without confirmation
      const result = await setMenuCurrency(userId, currency, false)

      // Verify: Confirmation required
      expect(result.success).toBe(false)
      expect(result.requiresConfirmation).toBe(true)
    })

    it('should bypass confirmation when explicitly provided', async () => {
      const userId = 'test-user-confirmed'
      const currency: ISO4217CurrencyCode = 'KRW'

      // User has menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, true)
      }

      // Set currency with confirmation
      const result = await setMenuCurrency(userId, currency, true)

      // Verify: Success with confirmation
      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(false)
    })
  })

  describe('suggestMenuCurrency', () => {
    it('should return USD as default suggestion', async () => {
      const userId = 'test-user-suggest'

      // Get suggestion (geo-detection not yet implemented)
      const result = await suggestMenuCurrency(userId)

      // Verify: Returns USD as default
      expect(result).toBe('USD')
    })

    it('should return valid ISO 4217 currency code', async () => {
      const userId = 'test-user-suggest-2'

      const result = await suggestMenuCurrency(userId)

      // Verify: Returns valid 3-letter uppercase code
      expect(result).toMatch(/^[A-Z]{3}$/)
    })
  })

  describe('Edge Cases', () => {
    const userId = 'test-user-edge'

    it('should handle rapid currency changes correctly', async () => {
      const currencies: ISO4217CurrencyCode[] = ['SGD', 'USD', 'GBP', 'EUR', 'JPY']

      // User has no menus (no confirmation needed)
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }

      // Rapidly change currency multiple times
      for (const currency of currencies) {
        await setMenuCurrency(userId, currency, false)
      }

      // Verify: Last currency is persisted
      const result = await getMenuCurrency(userId)
      expect(result).toBe(currencies[currencies.length - 1])
    })

    it('should handle confirmation flag correctly for each change', async () => {
      const currency1: ISO4217CurrencyCode = 'USD'
      const currency2: ISO4217CurrencyCode = 'SGD'

      // User has menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, true)
      }

      // First change without confirmation (should fail)
      const result1 = await setMenuCurrency(userId, currency1, false)
      expect(result1.success).toBe(false)
      expect(result1.requiresConfirmation).toBe(true)

      // Second change with confirmation (should succeed)
      const result2 = await setMenuCurrency(userId, currency2, true)
      expect(result2.success).toBe(true)
      expect(result2.requiresConfirmation).toBe(false)

      // Verify: Second currency is persisted
      const stored = await getMenuCurrency(userId)
      expect(stored).toBe(currency2)
    })

    it('should handle mixed case in currency codes', async () => {
      const mixedCaseCodes = ['Usd', 'sGd', 'GbP', 'EuR']

      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }

      for (const code of mixedCaseCodes) {
        const result = await setMenuCurrency(userId, code as any, false)

        // Verify: Rejected (must be uppercase)
        expect(result.success).toBe(false)
        expect(result.message).toContain('Invalid currency code')
      }
    })

    it('should handle null or undefined currency gracefully', async () => {
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }

      // Test null
      const result1 = await setMenuCurrency(userId, null as any, false)
      expect(result1.success).toBe(false)
      expect(result1.message).toContain('Invalid currency code')

      // Test undefined
      const result2 = await setMenuCurrency(userId, undefined as any, false)
      expect(result2.success).toBe(false)
      expect(result2.message).toContain('Invalid currency code')
    })

    it('should preserve existing currency when invalid change is attempted', async () => {
      const initialCurrency: ISO4217CurrencyCode = 'USD'
      const invalidCurrency = 'invalid'

      // Set initial valid currency
      if (testHelpers) {
        testHelpers.setMockMenuCurrency(userId, initialCurrency)
        testHelpers.setMockHasExistingMenus(userId, false)
      }

      // Attempt invalid change
      await setMenuCurrency(userId, invalidCurrency as any, false)

      // Verify: Original currency preserved
      const stored = await getMenuCurrency(userId)
      expect(stored).toBe(initialCurrency)
    })
  })

  describe('Integration with hasExistingMenus', () => {
    it('should check for existing menus before requiring confirmation', async () => {
      const userId = 'test-user-integration'
      const currency: ISO4217CurrencyCode = 'MYR'

      // Initially no menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, false)
      }

      // First change (no confirmation needed)
      const result1 = await setMenuCurrency(userId, currency, false)
      expect(result1.success).toBe(true)
      expect(result1.requiresConfirmation).toBe(false)

      // User creates menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, true)
      }

      // Second change (confirmation needed)
      const result2 = await setMenuCurrency(userId, 'THB', false)
      expect(result2.success).toBe(false)
      expect(result2.requiresConfirmation).toBe(true)
    })

    it('should allow change with confirmation even when hasExistingMenus is true', async () => {
      const userId = 'test-user-integration-2'
      const currency: ISO4217CurrencyCode = 'IDR'

      // User has menus
      if (testHelpers) {
        testHelpers.setMockHasExistingMenus(userId, true)
      }

      // Change with confirmation
      const result = await setMenuCurrency(userId, currency, true)

      // Verify: Success
      expect(result.success).toBe(true)
      expect(result.requiresConfirmation).toBe(false)

      // Verify: Currency is persisted
      const stored = await getMenuCurrency(userId)
      expect(stored).toBe(currency)
    })
  })
})
