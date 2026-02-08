/**
 * Property-Based Tests for Currency Formatter Determinism
 * Feature: currency-support
 * 
 * Tests Property 6: Currency Formatter Determinism
 * Validates: Requirements 10.4
 */

import fc from 'fast-check';
import { formatCurrency } from '@/lib/currency-formatter';

describe('Feature: currency-support, Property 6: Currency Formatter Determinism', () => {
  /**
   * Property 6: Currency Formatter Determinism
   * For any given amount, currency code, and locale, the Currency_Formatter should 
   * produce identical output when called multiple times with the same inputs within 
   * the same runtime environment.
   * 
   * This test verifies that:
   * 1. Repeated calls with same inputs produce identical output
   * 2. Determinism holds across different amounts (positive, negative, zero, decimals)
   * 3. Determinism holds across different currency codes
   * 4. Determinism holds with fixed locale 'en-US' to ensure CI consistency
   */
  it('should produce identical output for repeated calls with same inputs', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary amounts (including negative, zero, and decimal values)
        fc.double({ min: -1000000, max: 1000000, noNaN: true }),
        // Generate currency codes from supported currencies
        fc.constantFrom(
          'SGD', 'USD', 'GBP', 'AUD', 'EUR', // Billing currencies
          'MYR', 'THB', 'IDR', // Popular menu currencies
          'JPY', 'KRW', // Zero-decimal currencies
          'CAD', 'CNY', 'HKD', 'INR', 'NZD', 'PHP' // Additional currencies
        ),
        (amount, currencyCode) => {
          // Use fixed locale 'en-US' for determinism across CI environments
          const locale = 'en-US';
          
          // Call formatter multiple times with same inputs
          const result1 = formatCurrency(amount, currencyCode, { locale });
          const result2 = formatCurrency(amount, currencyCode, { locale });
          const result3 = formatCurrency(amount, currencyCode, { locale });
          
          // All results should be identical
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
          expect(result1).toBe(result3);
          
          // Result should be a non-empty string
          expect(typeof result1).toBe('string');
          expect(result1.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be deterministic with showSymbol option', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.constantFrom('SGD', 'USD', 'GBP', 'EUR', 'JPY'),
        fc.boolean(),
        (amount, currencyCode, showSymbol) => {
          const locale = 'en-US';
          
          const result1 = formatCurrency(amount, currencyCode, { locale, showSymbol });
          const result2 = formatCurrency(amount, currencyCode, { locale, showSymbol });
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be deterministic with showCode option', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.constantFrom('SGD', 'USD', 'GBP', 'EUR', 'JPY'),
        fc.boolean(),
        (amount, currencyCode, showCode) => {
          const locale = 'en-US';
          
          const result1 = formatCurrency(amount, currencyCode, { locale, showCode });
          const result2 = formatCurrency(amount, currencyCode, { locale, showCode });
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be deterministic for zero-decimal currencies', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000000, max: 1000000 }),
        fc.constantFrom('JPY', 'KRW', 'CLP', 'VND'),
        (amount, currencyCode) => {
          const locale = 'en-US';
          
          const result1 = formatCurrency(amount, currencyCode, { locale });
          const result2 = formatCurrency(amount, currencyCode, { locale });
          const result3 = formatCurrency(amount, currencyCode, { locale });
          
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
          
          // Zero-decimal currencies should not have decimal points
          expect(result1).not.toMatch(/\.\d+/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be deterministic for edge case amounts', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          0, // Zero
          0.01, // Smallest positive
          -0.01, // Smallest negative
          999999.99, // Large positive
          -999999.99, // Large negative
          0.001, // Sub-cent (should round)
          12.345, // Multiple decimals (should round)
        ),
        fc.constantFrom('SGD', 'USD', 'GBP', 'EUR'),
        (amount, currencyCode) => {
          const locale = 'en-US';
          
          const result1 = formatCurrency(amount, currencyCode, { locale });
          const result2 = formatCurrency(amount, currencyCode, { locale });
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be deterministic across all formatting options combinations', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.constantFrom('SGD', 'USD', 'GBP', 'EUR', 'JPY'),
        fc.boolean(),
        fc.boolean(),
        (amount, currencyCode, showSymbol, showCode) => {
          const locale = 'en-US';
          const options = { locale, showSymbol, showCode };
          
          const result1 = formatCurrency(amount, currencyCode, options);
          const result2 = formatCurrency(amount, currencyCode, options);
          const result3 = formatCurrency(amount, currencyCode, options);
          
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
