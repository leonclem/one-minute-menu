/**
 * Currency Formatter Utility
 * 
 * Provides consistent currency formatting across all views and exports.
 * Primary use: Menu display currency formatting (Domain B)
 * Secondary use: Can be used for billing UI price display
 * 
 * Uses Intl.NumberFormat for locale-aware formatting with 'en-US' as default locale for MVP.
 */

import { getCurrencyMetadata } from './currency-config';

export interface FormatOptions {
  locale?: string;
  showSymbol?: boolean;
  showCode?: boolean;
}

/**
 * Format a price with currency using Intl.NumberFormat
 * 
 * @param amount - The numeric amount to format (null/undefined will be treated as 0 with warning)
 * @param currencyCode - ISO 4217 currency code (e.g., 'USD', 'SGD')
 * @param options - Formatting options (locale, showSymbol, showCode)
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(12.50, 'USD') // "$12.50"
 * formatCurrency(1500, 'JPY') // "¥1,500"
 * formatCurrency(10.99, 'EUR', { locale: 'en-US' }) // "€10.99"
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode: string,
  options: FormatOptions = {}
): string {
  // Handle null/undefined amounts
  if (amount === null || amount === undefined) {
    console.warn('Null/undefined amount passed to currency formatter', { currencyCode });
    amount = 0;
  }

  // Validate and normalize currency code
  const normalizedCode = currencyCode?.toUpperCase();
  if (!isValidCurrencyCode(normalizedCode)) {
    console.error('Invalid currency code passed to formatter', { 
      currencyCode, 
      amount 
    });
    // Default to USD for invalid codes
    return formatCurrency(amount, 'USD', options);
  }

  const {
    locale = 'en-US',
    showSymbol = true,
    showCode = false,
  } = options;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: showSymbol ? 'currency' : 'decimal',
      currency: normalizedCode,
      currencyDisplay: showCode ? 'code' : 'symbol',
    });

    return formatter.format(amount);
  } catch (error) {
    console.error('Error formatting currency', { 
      amount, 
      currencyCode: normalizedCode, 
      error 
    });
    // Fallback to USD if formatting fails
    return formatCurrency(amount, 'USD', options);
  }
}

/**
 * Get currency symbol for a given currency code
 * 
 * @param code - ISO 4217 currency code
 * @returns Currency symbol (e.g., '$', '€', '¥')
 */
export function getCurrencySymbol(code: string): string {
  const normalizedCode = code?.toUpperCase();
  
  if (!isValidCurrencyCode(normalizedCode)) {
    console.error('Invalid currency code passed to getCurrencySymbol', { code });
    return '$'; // Default to USD symbol
  }

  const metadata = getCurrencyMetadata(normalizedCode);
  return metadata.symbol;
}

/**
 * Validate if a string is a valid ISO 4217 currency code
 * 
 * @param code - Currency code to validate
 * @returns true if valid (3 uppercase letters), false otherwise
 */
export function isValidCurrencyCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // ISO 4217 codes are exactly 3 uppercase letters
  const iso4217Pattern = /^[A-Z]{3}$/;
  return iso4217Pattern.test(code);
}

/**
 * Parse a formatted currency string back to a number
 * 
 * @param formatted - Formatted currency string (e.g., "$12.50", "€10,99")
 * @param currencyCode - ISO 4217 currency code for context
 * @returns Parsed number or null if parsing fails
 * 
 * @example
 * parseCurrency("$12.50", "USD") // 12.50
 * parseCurrency("¥1,500", "JPY") // 1500
 */
export function parseCurrency(
  formatted: string,
  currencyCode: string
): number | null {
  if (!formatted || typeof formatted !== 'string') {
    console.warn('Invalid formatted string passed to parseCurrency', { formatted, currencyCode });
    return null;
  }

  const normalizedCode = currencyCode?.toUpperCase();
  if (!isValidCurrencyCode(normalizedCode)) {
    console.error('Invalid currency code passed to parseCurrency', { currencyCode, formatted });
    return null;
  }

  try {
    // Remove currency symbols and non-numeric characters except decimal point and minus
    // This is a simplified parser - for production, consider using a library like currency.js
    const cleaned = formatted
      .replace(/[^\d.,-]/g, '') // Keep digits, dots, commas, and minus
      .replace(/,/g, ''); // Remove thousand separators (assuming comma)

    const parsed = parseFloat(cleaned);

    if (isNaN(parsed)) {
      console.warn('Failed to parse currency string', { formatted, currencyCode });
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing currency string', { formatted, currencyCode, error });
    return null;
  }
}
