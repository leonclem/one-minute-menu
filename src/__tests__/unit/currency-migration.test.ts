/**
 * Unit Tests for Currency Migration Service
 * 
 * Feature: currency-support
 * Task: 12.2
 * 
 * Tests cover:
 * - Migration adopts localStorage when account has no value
 * - Migration keeps account value when already set
 * - Migration never overrides subscription currency
 * - localStorage is cleared after migration
 * - Migration handles missing localStorage gracefully
 * - Migration runs exactly once per session
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import {
  migrateBillingCurrencyOnLogin,
  migrateMenuCurrencyOnLogin,
  type MigrationResult,
} from '@/lib/currency-migration'
import type { BillingCurrency, ISO4217CurrencyCode } from '@/lib/currency-config'

// Import test helpers
const migrationModule = require('@/lib/currency-migration')
const testHelpers = migrationModule.__test__

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

// Mock sessionStorage
const sessionStorageMock = (() => {
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

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
})

describe('Currency Migration Service', () => {
  beforeEach(() => {
    // Clear all mock data before each test
    localStorageMock.clear()
    sessionStorageMock.clear()
    testHelpers.clearMockData()
  })

  describe('migrateBillingCurrencyOnLogin', () => {
    it('should adopt billing currency from localStorage when account has no value', async () => {
      // Arrange
      const userId = 'user-123'
      const localStorageCurrency: BillingCurrency = 'GBP'

      // Set localStorage value
      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: localStorageCurrency })
      )

      // Act
      const result = await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe(localStorageCurrency)

      // Verify account was updated
      const accountCurrency = (global as any).__mockAccountCurrencies.get(userId)
      expect(accountCurrency).toBe(localStorageCurrency)

      // Verify localStorage was cleared
      expect(localStorageMock.getItem('gridmenu_billing_currency')).toBeNull()
    })

    it('should keep account billing currency when already set', async () => {
      // Arrange
      const userId = 'user-456'
      const accountCurrency: BillingCurrency = 'USD'
      const localStorageCurrency: BillingCurrency = 'GBP'

      // Set account value
      testHelpers.setMockAccountBillingCurrency(userId, accountCurrency)

      // Set localStorage value (should be ignored)
      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: localStorageCurrency })
      )

      // Act
      const result = await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe(accountCurrency)

      // Verify account value unchanged
      const finalAccountCurrency = (global as any).__mockAccountCurrencies.get(userId)
      expect(finalAccountCurrency).toBe(accountCurrency)

      // Verify localStorage was NOT cleared (migration didn't happen)
      expect(localStorageMock.getItem('gridmenu_billing_currency')).not.toBeNull()
    })

    it('should never override subscription billing currency', async () => {
      // Arrange
      const userId = 'user-789'
      const subscriptionCurrency: BillingCurrency = 'EUR'
      const localStorageCurrency: BillingCurrency = 'USD'

      // Set subscription currency
      testHelpers.setMockSubscriptionCurrency(userId, subscriptionCurrency)

      // Set localStorage value (should be ignored)
      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: localStorageCurrency })
      )

      // Act
      const result = await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe(subscriptionCurrency)

      // Verify account was NOT updated
      const accountCurrency = (global as any).__mockAccountCurrencies.get(userId)
      expect(accountCurrency).toBeUndefined()

      // Verify localStorage was NOT cleared (migration didn't happen)
      expect(localStorageMock.getItem('gridmenu_billing_currency')).not.toBeNull()
    })

    it('should handle missing localStorage gracefully', async () => {
      // Arrange
      const userId = 'user-no-storage'

      // No localStorage value set

      // Act
      const result = await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe('USD') // Default

      // Verify account was NOT updated
      const accountCurrency = (global as any).__mockAccountCurrencies.get(userId)
      expect(accountCurrency).toBeUndefined()
    })

    it('should clear localStorage after successful migration', async () => {
      // Arrange
      const userId = 'user-clear-test'
      const localStorageCurrency: BillingCurrency = 'AUD'

      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: localStorageCurrency })
      )

      // Act
      await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(localStorageMock.getItem('gridmenu_billing_currency')).toBeNull()
    })

    it('should run exactly once per session', async () => {
      // Arrange
      const userId = 'user-session-test'
      const localStorageCurrency: BillingCurrency = 'SGD'

      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: localStorageCurrency })
      )

      // Act - First call
      const result1 = await migrateBillingCurrencyOnLogin(userId)

      // Assert - First call migrated
      expect(result1).toBe(localStorageCurrency)
      expect(localStorageMock.getItem('gridmenu_billing_currency')).toBeNull()

      // Arrange - Set localStorage again
      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: 'USD' })
      )

      // Act - Second call in same session
      const result2 = await migrateBillingCurrencyOnLogin(userId)

      // Assert - Second call should NOT migrate again
      expect(result2).toBe(localStorageCurrency) // Still the first migrated value
      expect(localStorageMock.getItem('gridmenu_billing_currency')).not.toBeNull() // Not cleared
    })

    it('should validate localStorage currency is supported', async () => {
      // Arrange
      const userId = 'user-invalid-currency'

      // Set invalid currency in localStorage
      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: 'XXX' })
      )

      // Act
      const result = await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe('USD') // Default because invalid currency

      // Verify account was NOT updated with invalid currency
      const accountCurrency = (global as any).__mockAccountCurrencies.get(userId)
      expect(accountCurrency).toBeUndefined()
    })
  })

  describe('migrateMenuCurrencyOnLogin', () => {
    it('should adopt menu currency from localStorage when account has no value', async () => {
      // Arrange
      const userId = 'user-menu-123'
      const localStorageCurrency: ISO4217CurrencyCode = 'THB'

      // Set localStorage value
      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency: localStorageCurrency })
      )

      // Act
      const result = await migrateMenuCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe(localStorageCurrency)

      // Verify account was updated
      const accountCurrency = (global as any).__mockMenuCurrencies.get(userId)
      expect(accountCurrency).toBe(localStorageCurrency)

      // Verify localStorage was cleared
      expect(localStorageMock.getItem('gridmenu_menu_currency')).toBeNull()
    })

    it('should keep account menu currency when already set', async () => {
      // Arrange
      const userId = 'user-menu-456'
      const accountCurrency: ISO4217CurrencyCode = 'MYR'
      const localStorageCurrency: ISO4217CurrencyCode = 'IDR'

      // Set account value
      testHelpers.setMockAccountMenuCurrency(userId, accountCurrency)

      // Set localStorage value (should be ignored)
      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency: localStorageCurrency })
      )

      // Act
      const result = await migrateMenuCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe(accountCurrency)

      // Verify account value unchanged
      const finalAccountCurrency = (global as any).__mockMenuCurrencies.get(userId)
      expect(finalAccountCurrency).toBe(accountCurrency)

      // Verify localStorage was NOT cleared (migration didn't happen)
      expect(localStorageMock.getItem('gridmenu_menu_currency')).not.toBeNull()
    })

    it('should handle missing localStorage gracefully', async () => {
      // Arrange
      const userId = 'user-menu-no-storage'

      // No localStorage value set

      // Act
      const result = await migrateMenuCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe('USD') // Default

      // Verify account was NOT updated
      const accountCurrency = (global as any).__mockMenuCurrencies.get(userId)
      expect(accountCurrency).toBeUndefined()
    })

    it('should clear localStorage after successful migration', async () => {
      // Arrange
      const userId = 'user-menu-clear-test'
      const localStorageCurrency: ISO4217CurrencyCode = 'EUR'

      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency: localStorageCurrency })
      )

      // Act
      await migrateMenuCurrencyOnLogin(userId)

      // Assert
      expect(localStorageMock.getItem('gridmenu_menu_currency')).toBeNull()
    })

    it('should run exactly once per session', async () => {
      // Arrange
      const userId = 'user-menu-session-test'
      const localStorageCurrency: ISO4217CurrencyCode = 'JPY'

      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency: localStorageCurrency })
      )

      // Act - First call
      const result1 = await migrateMenuCurrencyOnLogin(userId)

      // Assert - First call migrated
      expect(result1).toBe(localStorageCurrency)
      expect(localStorageMock.getItem('gridmenu_menu_currency')).toBeNull()

      // Arrange - Set localStorage again
      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency: 'KRW' })
      )

      // Act - Second call in same session
      const result2 = await migrateMenuCurrencyOnLogin(userId)

      // Assert - Second call should NOT migrate again
      expect(result2).toBe(localStorageCurrency) // Still the first migrated value
      expect(localStorageMock.getItem('gridmenu_menu_currency')).not.toBeNull() // Not cleared
    })

    it('should validate localStorage currency format (3 uppercase letters)', async () => {
      // Arrange
      const userId = 'user-menu-invalid-format'

      // Set invalid format in localStorage
      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency: 'invalid' })
      )

      // Act
      const result = await migrateMenuCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe('USD') // Default because invalid format

      // Verify account was NOT updated with invalid currency
      const accountCurrency = (global as any).__mockMenuCurrencies.get(userId)
      expect(accountCurrency).toBeUndefined()
    })

    it('should accept any valid ISO 4217 format currency', async () => {
      // Arrange
      const userId = 'user-menu-iso-test'
      const localStorageCurrency: ISO4217CurrencyCode = 'CHF' // Swiss Franc

      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency: localStorageCurrency })
      )

      // Act
      const result = await migrateMenuCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe(localStorageCurrency)

      // Verify account was updated
      const accountCurrency = (global as any).__mockMenuCurrencies.get(userId)
      expect(accountCurrency).toBe(localStorageCurrency)
    })
  })

  describe('Session management', () => {
    it('should use sessionStorage to track migration state', async () => {
      // Arrange
      const userId = 'user-session-storage-test'
      const localStorageCurrency: BillingCurrency = 'USD'

      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: localStorageCurrency })
      )

      // Act - First migration
      await migrateBillingCurrencyOnLogin(userId)

      // Assert - Session flag should be set
      expect(sessionStorageMock.getItem('gridmenu_currency_migration_completed')).toBe('true')

      // Act - Reset session and clear account data to allow second migration
      testHelpers.resetMigrationSession()
      testHelpers.clearMockData()
      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency: 'GBP' })
      )

      const result2 = await migrateBillingCurrencyOnLogin(userId)

      // Assert - Should migrate again after session reset
      expect(result2).toBe('GBP')
    })
  })

  describe('Error handling', () => {
    it('should handle malformed localStorage data gracefully', async () => {
      // Arrange
      const userId = 'user-malformed-data'

      // Set malformed JSON
      localStorageMock.setItem('gridmenu_billing_currency', 'not-valid-json')

      // Act
      const result = await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe('USD') // Default

      // Verify account was NOT updated
      const accountCurrency = (global as any).__mockAccountCurrencies.get(userId)
      expect(accountCurrency).toBeUndefined()
    })

    it('should handle localStorage access errors gracefully', async () => {
      // Arrange
      const userId = 'user-storage-error'

      // Mock localStorage to throw error
      const originalGetItem = localStorageMock.getItem
      localStorageMock.getItem = () => {
        throw new Error('Storage access denied')
      }

      // Act
      const result = await migrateBillingCurrencyOnLogin(userId)

      // Assert
      expect(result).toBe('USD') // Default

      // Cleanup
      localStorageMock.getItem = originalGetItem
    })
  })

  describe('Domain separation', () => {
    it('should migrate billing and menu currencies independently', async () => {
      // Arrange
      const userId = 'user-independent-migration'
      const billingCurrency: BillingCurrency = 'SGD'
      const menuCurrency: ISO4217CurrencyCode = 'THB'

      localStorageMock.setItem(
        'gridmenu_billing_currency',
        JSON.stringify({ billingCurrency })
      )
      localStorageMock.setItem(
        'gridmenu_menu_currency',
        JSON.stringify({ menuCurrency })
      )

      // Act
      const billingResult = await migrateBillingCurrencyOnLogin(userId)
      testHelpers.resetMigrationSession() // Reset to allow menu migration
      const menuResult = await migrateMenuCurrencyOnLogin(userId)

      // Assert
      expect(billingResult).toBe(billingCurrency)
      expect(menuResult).toBe(menuCurrency)

      // Verify both were set independently
      const accountBilling = (global as any).__mockAccountCurrencies.get(userId)
      const accountMenu = (global as any).__mockMenuCurrencies.get(userId)
      expect(accountBilling).toBe(billingCurrency)
      expect(accountMenu).toBe(menuCurrency)
    })
  })
})
