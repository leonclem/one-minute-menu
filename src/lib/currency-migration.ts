/**
 * Currency Preference Migration Service
 * 
 * Handles migration of currency preferences from localStorage to account settings
 * when a user logs in for the first time.
 * 
 * CRITICAL: Migration MUST run exactly once per login session to prevent oscillation
 * and accidental overrides.
 * 
 * Migration Rules:
 * 1. Never override active subscription currency
 * 2. Never override existing account preferences
 * 3. Adopt from localStorage only if account has no explicit value
 * 4. Clear localStorage after successful migration
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { BillingCurrency } from './currency-config';
import type { ISO4217CurrencyCode } from './currency-config';
import { SUPPORTED_BILLING_CURRENCIES } from './currency-config';

/**
 * localStorage key for anonymous user billing currency
 */
const BILLING_CURRENCY_STORAGE_KEY = 'gridmenu_billing_currency';

/**
 * localStorage key for anonymous user menu currency
 */
const MENU_CURRENCY_STORAGE_KEY = 'gridmenu_menu_currency';

/**
 * sessionStorage key to track if migration has run this session
 */
const MIGRATION_SESSION_KEY = 'gridmenu_currency_migration_completed';

/**
 * Result of migration operation
 */
export interface MigrationResult {
  billingCurrencyMigrated: boolean;
  menuCurrencyMigrated: boolean;
  billingCurrency: BillingCurrency;
  menuCurrency: ISO4217CurrencyCode;
}

/**
 * Migrate billing currency from localStorage to account on login
 * 
 * CRITICAL: This function MUST run exactly once per login session.
 * 
 * Migration logic:
 * 1. Check if user has active subscription - if yes, NEVER override subscription currency
 * 2. Check if account already has explicit billing currency - if yes, keep it
 * 3. If account has no value, adopt from localStorage
 * 4. Clear localStorage after successful migration
 * 
 * @param userId - User ID to migrate preferences for
 * @returns Promise resolving to billing currency (migrated or existing)
 * 
 * Requirements: 14.1, 14.2, 14.3
 */
export async function migrateBillingCurrencyOnLogin(
  userId: string
): Promise<BillingCurrency> {
  // Check if migration already ran this session
  if (hasMigrationRunThisSession()) {
    console.log('[Currency Migration] Billing currency migration already ran this session');
    return await getCurrentBillingCurrency(userId);
  }

  // 1. Check for active subscription currency (highest priority - never override)
  const subscriptionCurrency = await getSubscriptionBillingCurrency(userId);
  if (subscriptionCurrency) {
    console.log('[Currency Migration] User has active subscription, keeping subscription currency:', subscriptionCurrency);
    markMigrationComplete();
    return subscriptionCurrency;
  }

  // 2. Check if account already has explicit billing currency
  const accountCurrency = await getAccountBillingCurrency(userId);
  if (accountCurrency) {
    console.log('[Currency Migration] Account already has billing currency, keeping it:', accountCurrency);
    markMigrationComplete();
    return accountCurrency;
  }

  // 3. Adopt from localStorage if available
  const localStorageCurrency = getLocalStorageBillingCurrency();
  if (localStorageCurrency) {
    console.log('[Currency Migration] Migrating billing currency from localStorage:', localStorageCurrency);
    await setAccountBillingCurrency(userId, localStorageCurrency);
    clearLocalStorageBillingCurrency();
    markMigrationComplete();
    return localStorageCurrency;
  }

  // 4. No migration needed, return default
  console.log('[Currency Migration] No billing currency to migrate, using default USD');
  markMigrationComplete();
  return 'USD';
}

/**
 * Migrate menu currency from localStorage to account on login
 * 
 * CRITICAL: This function MUST run exactly once per login session.
 * 
 * Migration logic:
 * 1. Check if account already has explicit menu currency - if yes, keep it
 * 2. If account has no value, adopt from localStorage
 * 3. Clear localStorage after successful migration
 * 
 * @param userId - User ID to migrate preferences for
 * @returns Promise resolving to menu currency (migrated or existing)
 * 
 * Requirements: 14.4, 14.5
 */
export async function migrateMenuCurrencyOnLogin(
  userId: string
): Promise<ISO4217CurrencyCode> {
  // Check if migration already ran this session
  if (hasMigrationRunThisSession()) {
    console.log('[Currency Migration] Menu currency migration already ran this session');
    return await getCurrentMenuCurrency(userId);
  }

  // 1. Check if account already has explicit menu currency
  const accountCurrency = await getAccountMenuCurrency(userId);
  if (accountCurrency) {
    console.log('[Currency Migration] Account already has menu currency, keeping it:', accountCurrency);
    markMigrationComplete();
    return accountCurrency;
  }

  // 2. Adopt from localStorage if available
  const localStorageCurrency = getLocalStorageMenuCurrency();
  if (localStorageCurrency) {
    console.log('[Currency Migration] Migrating menu currency from localStorage:', localStorageCurrency);
    await setAccountMenuCurrency(userId, localStorageCurrency);
    clearLocalStorageMenuCurrency();
    markMigrationComplete();
    return localStorageCurrency;
  }

  // 3. No migration needed, return default
  console.log('[Currency Migration] No menu currency to migrate, using default USD');
  markMigrationComplete();
  return 'USD';
}

/**
 * Check if migration has already run this session
 * 
 * Uses sessionStorage to track migration state within a single browser session.
 * This prevents multiple migrations during the same login session.
 * 
 * @returns true if migration has run, false otherwise
 */
function hasMigrationRunThisSession(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return sessionStorage.getItem(MIGRATION_SESSION_KEY) === 'true';
  } catch (error) {
    console.warn('[Currency Migration] Failed to check session storage:', error);
    return false;
  }
}

/**
 * Mark migration as complete for this session
 * 
 * Sets a flag in sessionStorage to prevent duplicate migrations.
 */
function markMigrationComplete(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(MIGRATION_SESSION_KEY, 'true');
  } catch (error) {
    console.warn('[Currency Migration] Failed to mark migration complete:', error);
  }
}

/**
 * Get billing currency from localStorage
 * 
 * @returns Billing currency or null if not set
 */
function getLocalStorageBillingCurrency(): BillingCurrency | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(BILLING_CURRENCY_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    const currency = parsed.billingCurrency;

    // Validate stored currency is still supported
    if (SUPPORTED_BILLING_CURRENCIES.includes(currency as BillingCurrency)) {
      return currency as BillingCurrency;
    }

    return null;
  } catch (error) {
    console.warn('[Currency Migration] Failed to read billing currency from localStorage:', error);
    return null;
  }
}

/**
 * Get menu currency from localStorage
 * 
 * @returns Menu currency or null if not set
 */
function getLocalStorageMenuCurrency(): ISO4217CurrencyCode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(MENU_CURRENCY_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    const currency = parsed.menuCurrency;

    // Validate format: 3 uppercase letters
    if (typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)) {
      return currency as ISO4217CurrencyCode;
    }

    return null;
  } catch (error) {
    console.warn('[Currency Migration] Failed to read menu currency from localStorage:', error);
    return null;
  }
}

/**
 * Clear billing currency from localStorage
 */
function clearLocalStorageBillingCurrency(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(BILLING_CURRENCY_STORAGE_KEY);
    console.log('[Currency Migration] Cleared billing currency from localStorage');
  } catch (error) {
    console.warn('[Currency Migration] Failed to clear billing currency from localStorage:', error);
  }
}

/**
 * Clear menu currency from localStorage
 */
function clearLocalStorageMenuCurrency(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(MENU_CURRENCY_STORAGE_KEY);
    console.log('[Currency Migration] Cleared menu currency from localStorage');
  } catch (error) {
    console.warn('[Currency Migration] Failed to clear menu currency from localStorage:', error);
  }
}

/**
 * Get current billing currency from account
 * 
 * @param userId - User ID
 * @returns Promise resolving to billing currency
 */
async function getCurrentBillingCurrency(userId: string): Promise<BillingCurrency> {
  // Check subscription first
  const subscriptionCurrency = await getSubscriptionBillingCurrency(userId);
  if (subscriptionCurrency) {
    return subscriptionCurrency;
  }

  // Then check account
  const accountCurrency = await getAccountBillingCurrency(userId);
  if (accountCurrency) {
    return accountCurrency;
  }

  // Default to USD
  return 'USD';
}

/**
 * Get current menu currency from account
 * 
 * @param userId - User ID
 * @returns Promise resolving to menu currency
 */
async function getCurrentMenuCurrency(userId: string): Promise<ISO4217CurrencyCode> {
  const accountCurrency = await getAccountMenuCurrency(userId);
  if (accountCurrency) {
    return accountCurrency;
  }

  // Default to USD
  return 'USD';
}

/**
 * Get billing currency from active subscription
 * 
 * @param userId - User ID
 * @returns Promise resolving to billing currency or null
 */
async function getSubscriptionBillingCurrency(userId: string): Promise<BillingCurrency | null> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockSubscriptionCurrencies) {
    return (global as any).__mockSubscriptionCurrencies.get(userId) || null;
  }

  // TODO: Implement Stripe subscription query
  // This will query Stripe API for active subscription and extract currency from metadata
  return null;
}

/**
 * Get billing currency from account settings
 * 
 * @param userId - User ID
 * @returns Promise resolving to billing currency or null
 */
async function getAccountBillingCurrency(userId: string): Promise<BillingCurrency | null> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockAccountCurrencies) {
    return (global as any).__mockAccountCurrencies.get(userId) || null;
  }

  // TODO: Implement database query
  return null;
}

/**
 * Get menu currency from account settings
 * 
 * @param userId - User ID
 * @returns Promise resolving to menu currency or null
 */
async function getAccountMenuCurrency(userId: string): Promise<ISO4217CurrencyCode | null> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockMenuCurrencies) {
    return (global as any).__mockMenuCurrencies.get(userId) || null;
  }

  // TODO: Implement database query
  return null;
}

/**
 * Set billing currency in account settings
 * 
 * @param userId - User ID
 * @param currency - Billing currency to set
 */
async function setAccountBillingCurrency(userId: string, currency: BillingCurrency): Promise<void> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockAccountCurrencies) {
    (global as any).__mockAccountCurrencies.set(userId, currency);
    return;
  }

  // TODO: Implement database update
  console.log(`[TODO] Set account billing currency for user ${userId} to ${currency}`);
}

/**
 * Set menu currency in account settings
 * 
 * @param userId - User ID
 * @param currency - Menu currency to set
 */
async function setAccountMenuCurrency(userId: string, currency: ISO4217CurrencyCode): Promise<void> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockMenuCurrencies) {
    (global as any).__mockMenuCurrencies.set(userId, currency);
    return;
  }

  // TODO: Implement database update
  console.log(`[TODO] Set account menu currency for user ${userId} to ${currency}`);
}

// Test hooks for unit testing
// These allow tests to inject mock data without modifying the core logic
if (process.env.NODE_ENV === 'test') {
  // Initialize global mock stores if not already present
  if (!(global as any).__mockAccountCurrencies) {
    (global as any).__mockAccountCurrencies = new Map<string, BillingCurrency>();
  }
  if (!(global as any).__mockSubscriptionCurrencies) {
    (global as any).__mockSubscriptionCurrencies = new Map<string, BillingCurrency>();
  }
  if (!(global as any).__mockMenuCurrencies) {
    (global as any).__mockMenuCurrencies = new Map<string, ISO4217CurrencyCode>();
  }

  // Export test helpers
  (module.exports as any).__test__ = {
    setMockAccountBillingCurrency: (userId: string, currency: BillingCurrency) => {
      (global as any).__mockAccountCurrencies.set(userId, currency);
    },
    setMockSubscriptionCurrency: (userId: string, currency: BillingCurrency) => {
      (global as any).__mockSubscriptionCurrencies.set(userId, currency);
    },
    setMockAccountMenuCurrency: (userId: string, currency: ISO4217CurrencyCode) => {
      (global as any).__mockMenuCurrencies.set(userId, currency);
    },
    clearMockData: () => {
      (global as any).__mockAccountCurrencies.clear();
      (global as any).__mockSubscriptionCurrencies.clear();
      (global as any).__mockMenuCurrencies.clear();
      // Clear session storage flag
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(MIGRATION_SESSION_KEY);
        } catch (error) {
          // Ignore errors in test cleanup
        }
      }
    },
    resetMigrationSession: () => {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(MIGRATION_SESSION_KEY);
        } catch (error) {
          // Ignore errors
        }
      }
    },
  };
}
