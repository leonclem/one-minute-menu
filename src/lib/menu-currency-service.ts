/**
 * Menu Currency Service (Domain B)
 * 
 * Manages menu currency selection and persistence.
 * This service handles the currency displayed on customer-facing menus.
 * 
 * CRITICAL: This service is completely independent from Billing Currency Service (Domain A).
 * Menu and billing currencies must never cross-pollinate.
 * 
 * Requirements: 5.6, 5.7, 7.1, 7.2, 7.5, 15.1, 15.2, 15.3
 */

import type { ISO4217CurrencyCode } from './currency-config';
import { getCurrencyMetadata } from './currency-config';

/**
 * Menu currency preference with metadata
 */
export interface MenuCurrencyPreference {
  currency: ISO4217CurrencyCode;
  lastUpdated: Date;
  hasExistingMenus: boolean;
}

/**
 * Result of setting menu currency
 * Includes requiresConfirmation flag to block accidental changes
 */
export interface SetMenuCurrencyResult {
  success: boolean;
  requiresConfirmation: boolean;
  message?: string;
}

/**
 * Get current menu currency for a user
 * 
 * Reads from account settings (profiles.menu_currency)
 * 
 * @param userId - User ID
 * @returns Promise resolving to menu currency code
 * 
 * Requirements: 5.6
 */
export async function getMenuCurrency(userId: string): Promise<ISO4217CurrencyCode> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockMenuCurrencies) {
    return (global as any).__mockMenuCurrencies.get(userId) || 'USD';
  }
  
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server');
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('menu_currency')
      .eq('id', userId)
      .single();
    
    if (error || !data || !data.menu_currency) {
      return 'USD';
    }
    
    return data.menu_currency as ISO4217CurrencyCode;
  } catch (error) {
    console.error('Failed to get menu currency:', error);
    return 'USD';
  }
}

/**
 * Set menu currency with validation and confirmation requirement
 * 
 * NOTE: Returns structured response (requiresConfirmation) so UI can block accidental changes
 * 
 * Validates:
 * - Currency code is valid ISO 4217 (3 uppercase letters)
 * - Requires confirmation if user has existing menus with prices
 * 
 * @param userId - User ID
 * @param currency - ISO 4217 currency code to set
 * @param confirmed - Whether user has confirmed the change (required if existing menus)
 * @returns Promise resolving to result with success flag and optional message
 * 
 * Requirements: 5.7, 7.2, 7.5, 15.1, 15.2, 15.3
 */
export async function setMenuCurrency(
  userId: string,
  currency: ISO4217CurrencyCode,
  confirmed: boolean
): Promise<SetMenuCurrencyResult> {
  // Validate currency code format (3 uppercase letters)
  if (!isValidCurrencyCode(currency)) {
    return {
      success: false,
      requiresConfirmation: false,
      message: `Invalid currency code: ${currency}. Currency codes must be exactly 3 uppercase letters.`,
    };
  }

  // Check if user has existing menus with prices
  const hasMenus = await hasExistingMenus(userId);

  // Require confirmation if user has existing menus
  if (hasMenus && !confirmed) {
    return {
      success: false,
      requiresConfirmation: true,
      message: 'Changing currency will not automatically convert existing prices. Please confirm to proceed.',
    };
  }

  // Persist to database
  await persistMenuCurrency(userId, currency);

  // Log the change for audit purposes
  console.log(`[Menu Currency] User ${userId} changed menu currency to ${currency}`, {
    hasExistingMenus: hasMenus,
    confirmed,
  });

  return {
    success: true,
    requiresConfirmation: false,
  };
}

/**
 * Check if user has existing menus with prices
 * 
 * Queries menus table to determine if user has any menus with menu items
 * that have prices set.
 * 
 * @param userId - User ID to check
 * @returns Promise resolving to true if user has menus with prices
 * 
 * Requirements: 7.5
 */
export async function hasExistingMenus(userId: string): Promise<boolean> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockHasExistingMenus) {
    return (global as any).__mockHasExistingMenus.get(userId) || false;
  }
  
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server');
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('menus')
      .select('id, menu_data')
      .eq('user_id', userId);
    
    if (error || !data) {
      return false;
    }
    
    // Check if any menu has items with prices
    return data.some(menu => {
      const items = menu.menu_data?.items || [];
      return items.some((item: any) => 
        item.price !== null && 
        item.price !== undefined && 
        item.price > 0
      );
    });
  } catch (error) {
    console.error('Failed to check for existing menus:', error);
    return false;
  }
}

/**
 * Suggest menu currency based on user's location
 * 
 * Uses geo-detection to suggest an appropriate default currency.
 * Falls back to USD if detection fails.
 * 
 * @param userId - User ID
 * @returns Promise resolving to suggested currency code
 * 
 * Requirements: 5.6
 */
export async function suggestMenuCurrency(userId: string): Promise<ISO4217CurrencyCode> {
  // TODO: Implement geo-detection integration
  // This will use the geo-detection service to suggest currency
  // For now, return USD as default
  
  // Implementation will look like:
  // try {
  //   const location = await detectLocation();
  //   const suggestion = suggestCurrencies(location);
  //   return suggestion.menuCurrency;
  // } catch (error) {
  //   console.warn('Geo-detection failed for menu currency suggestion', { error });
  //   return 'USD';
  // }
  
  return 'USD';
}

/**
 * Validate if a currency code is valid ISO 4217 format
 * 
 * Checks:
 * - Exactly 3 characters
 * - All uppercase letters
 * - Exists in currency metadata
 * 
 * @param code - Currency code to validate
 * @returns true if valid, false otherwise
 * 
 * Requirements: 15.1, 15.2
 */
function isValidCurrencyCode(code: string): boolean {
  // Check format: exactly 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(code)) {
    return false;
  }

  // Check if currency exists in metadata (validates ISO 4217)
  try {
    const metadata = getCurrencyMetadata(code);
    // If getCurrencyMetadata returns USD as fallback, check if that was intentional
    if (metadata.code === 'USD' && code !== 'USD') {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Persist menu currency to database
 * 
 * Updates profiles.menu_currency and menu_currency_updated_at
 * 
 * @param userId - User ID
 * @param currency - Currency code to persist
 */
async function persistMenuCurrency(
  userId: string,
  currency: ISO4217CurrencyCode
): Promise<void> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockMenuCurrencies) {
    (global as any).__mockMenuCurrencies.set(userId, currency);
    return;
  }
  
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server');
    const supabase = createServerSupabaseClient();
    
    const { error } = await supabase
      .from('profiles')
      .update({
        menu_currency: currency,
        menu_currency_updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      throw new Error(`Failed to update menu currency: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Failed to persist menu currency:', error);
    throw new Error(`Failed to update menu currency: ${error.message}`);
  }
}

// Test hooks for property-based testing
// These allow tests to inject mock data without modifying the core logic
if (process.env.NODE_ENV === 'test') {
  // Initialize global mock stores
  if (!(global as any).__mockMenuCurrencies) {
    (global as any).__mockMenuCurrencies = new Map<string, ISO4217CurrencyCode>();
  }
  if (!(global as any).__mockHasExistingMenus) {
    (global as any).__mockHasExistingMenus = new Map<string, boolean>();
  }
  
  // Export test helpers
  (module.exports as any).__test__ = {
    setMockMenuCurrency: (userId: string, currency: ISO4217CurrencyCode) => {
      (global as any).__mockMenuCurrencies.set(userId, currency);
    },
    setMockHasExistingMenus: (userId: string, hasMenus: boolean) => {
      (global as any).__mockHasExistingMenus.set(userId, hasMenus);
    },
    clearMockData: () => {
      (global as any).__mockMenuCurrencies.clear();
      (global as any).__mockHasExistingMenus.clear();
    },
  };
}
