/**
 * Currency Configuration Module
 * 
 * Centralizes currency configuration and provides type-safe access to currency data.
 * Supports two independent domains:
 * - Domain A: Platform Billing Currency (how restaurateurs pay GridMenu)
 * - Domain B: Menu Display Currency (what customers see on menus)
 */

// Currency domain types
export type CurrencyDomain = 'BILLING' | 'MENU_DISPLAY';

// Supported billing currencies (curated list for Stripe integration)
export type BillingCurrency = 'SGD' | 'USD' | 'GBP' | 'AUD' | 'EUR';

// ISO 4217 currency code (all currencies for menu display)
export type ISO4217CurrencyCode = string;

// Currency metadata
export interface CurrencyMetadata {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
  symbolPosition: 'prefix' | 'suffix';
}

// Billing currency configuration
export interface BillingCurrencyConfig {
  currency: BillingCurrency;
  stripePriceIds: {
    gridPlus: string;
    gridPlusPremium: string;
    creatorPack: string;
  };
}

/**
 * Supported billing currencies for Stripe integration
 * These are the only currencies accepted for platform subscriptions
 */
export const SUPPORTED_BILLING_CURRENCIES: readonly BillingCurrency[] = [
  'SGD',
  'USD',
  'GBP',
  'AUD',
  'EUR',
] as const;

/**
 * Popular menu currencies displayed prominently in UI
 * Based on common usage patterns in target markets
 */
export const POPULAR_MENU_CURRENCIES: readonly ISO4217CurrencyCode[] = [
  'SGD', // Singapore Dollar
  'USD', // US Dollar
  'GBP', // British Pound
  'EUR', // Euro
  'AUD', // Australian Dollar
  'MYR', // Malaysian Ringgit
  'THB', // Thai Baht
  'IDR', // Indonesian Rupiah
] as const;

/**
 * Comprehensive currency metadata for ISO 4217 currencies
 * Includes symbol, name, decimal places, and symbol position
 */
const CURRENCY_METADATA_MAP: Record<string, CurrencyMetadata> = {
  // Supported billing currencies
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimalPlaces: 2, symbolPosition: 'prefix' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimalPlaces: 2, symbolPosition: 'prefix' },
  
  // Popular menu currencies
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', decimalPlaces: 2, symbolPosition: 'prefix' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', decimalPlaces: 2, symbolPosition: 'prefix' },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', decimalPlaces: 2, symbolPosition: 'prefix' },
  
  // Zero-decimal currencies
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimalPlaces: 0, symbolPosition: 'prefix' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimalPlaces: 0, symbolPosition: 'prefix' },
  
  // Additional common currencies
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimalPlaces: 2, symbolPosition: 'prefix' },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimalPlaces: 2, symbolPosition: 'prefix' },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso', decimalPlaces: 2, symbolPosition: 'prefix' },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', decimalPlaces: 0, symbolPosition: 'suffix' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimalPlaces: 2, symbolPosition: 'prefix' },
  SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', decimalPlaces: 2, symbolPosition: 'suffix' },
  NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', decimalPlaces: 2, symbolPosition: 'suffix' },
  DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone', decimalPlaces: 2, symbolPosition: 'suffix' },
  PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', decimalPlaces: 2, symbolPosition: 'suffix' },
  CZK: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', decimalPlaces: 2, symbolPosition: 'suffix' },
  HUF: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', decimalPlaces: 2, symbolPosition: 'suffix' },
  RON: { code: 'RON', symbol: 'lei', name: 'Romanian Leu', decimalPlaces: 2, symbolPosition: 'suffix' },
  BGN: { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', decimalPlaces: 2, symbolPosition: 'suffix' },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira', decimalPlaces: 2, symbolPosition: 'prefix' },
  ILS: { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', decimalPlaces: 2, symbolPosition: 'prefix' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', decimalPlaces: 2, symbolPosition: 'prefix' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimalPlaces: 2, symbolPosition: 'prefix' },
  MXN: { code: 'MXN', symbol: '$', name: 'Mexican Peso', decimalPlaces: 2, symbolPosition: 'prefix' },
  ARS: { code: 'ARS', symbol: '$', name: 'Argentine Peso', decimalPlaces: 2, symbolPosition: 'prefix' },
  CLP: { code: 'CLP', symbol: '$', name: 'Chilean Peso', decimalPlaces: 0, symbolPosition: 'prefix' },
  COP: { code: 'COP', symbol: '$', name: 'Colombian Peso', decimalPlaces: 2, symbolPosition: 'prefix' },
  PEN: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', decimalPlaces: 2, symbolPosition: 'prefix' },
  RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble', decimalPlaces: 2, symbolPosition: 'suffix' },
  SAR: { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal', decimalPlaces: 2, symbolPosition: 'prefix' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', decimalPlaces: 2, symbolPosition: 'prefix' },
  KWD: { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', decimalPlaces: 3, symbolPosition: 'prefix' },
  QAR: { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', decimalPlaces: 2, symbolPosition: 'prefix' },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', decimalPlaces: 2, symbolPosition: 'prefix' },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', decimalPlaces: 2, symbolPosition: 'prefix' },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', decimalPlaces: 2, symbolPosition: 'prefix' },
  LKR: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', decimalPlaces: 2, symbolPosition: 'prefix' },
  MMK: { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat', decimalPlaces: 2, symbolPosition: 'prefix' },
  KHR: { code: 'KHR', symbol: '៛', name: 'Cambodian Riel', decimalPlaces: 2, symbolPosition: 'prefix' },
  LAK: { code: 'LAK', symbol: '₭', name: 'Lao Kip', decimalPlaces: 2, symbolPosition: 'prefix' },
  BND: { code: 'BND', symbol: 'B$', name: 'Brunei Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
  TWD: { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', decimalPlaces: 2, symbolPosition: 'prefix' },
};

/**
 * Get supported billing currencies
 * @returns Array of supported billing currency codes
 */
export function getSupportedBillingCurrencies(): BillingCurrency[] {
  return [...SUPPORTED_BILLING_CURRENCIES];
}

/**
 * Get popular menu currencies for UI display
 * @returns Array of popular menu currency codes
 */
export function getPopularMenuCurrencies(): ISO4217CurrencyCode[] {
  return [...POPULAR_MENU_CURRENCIES];
}

/**
 * Get metadata for a specific currency
 * @param code - ISO 4217 currency code (e.g., 'USD', 'SGD')
 * @returns Currency metadata including symbol, name, decimal places, and symbol position
 */
export function getCurrencyMetadata(code: string): CurrencyMetadata {
  const metadata = CURRENCY_METADATA_MAP[code.toUpperCase()];
  
  if (!metadata) {
    // Default to USD if currency not found
    console.warn(`Currency metadata not found for code: ${code}, defaulting to USD`);
    return CURRENCY_METADATA_MAP['USD'];
  }
  
  return metadata;
}

/**
 * Get all available currencies with metadata
 * @returns Array of all currency metadata objects
 */
export function getAllCurrencies(): CurrencyMetadata[] {
  return Object.values(CURRENCY_METADATA_MAP);
}
