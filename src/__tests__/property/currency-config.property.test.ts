/**
 * Property-Based Tests for Currency Configuration
 * Feature: currency-support
 * 
 * Tests Property 12: Zero-Decimal Currency Handling
 * Validates: Requirements 6.8
 */

import fc from 'fast-check';
import { getCurrencyMetadata } from '@/lib/currency-config';

describe('Feature: currency-support, Property 12: Zero-Decimal Currency Handling', () => {
  /**
   * Property 12: Zero-Decimal Currency Handling
   * For any currency with zero decimal places (e.g., JPY, KRW), the Currency_Formatter 
   * should format amounts without decimal points.
   * 
   * This test verifies that:
   * 1. Zero-decimal currencies (JPY, KRW, etc.) return 0 for decimalPlaces
   * 2. Standard currencies return 2 for decimalPlaces
   */
  it('should return 0 decimal places for zero-decimal currencies', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('JPY', 'KRW', 'CLP', 'VND'),
        (currencyCode) => {
          const metadata = getCurrencyMetadata(currencyCode);
          
          // Zero-decimal currencies should have 0 decimal places
          expect(metadata.decimalPlaces).toBe(0);
          expect(metadata.code).toBe(currencyCode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 2 decimal places for standard currencies', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SGD', 'USD', 'GBP', 'AUD', 'EUR', 'MYR', 'THB', 'IDR', 'CAD', 'CNY', 'HKD', 'INR', 'NZD', 'PHP'),
        (currencyCode) => {
          const metadata = getCurrencyMetadata(currencyCode);
          
          // Standard currencies should have 2 decimal places
          expect(metadata.decimalPlaces).toBe(2);
          expect(metadata.code).toBe(currencyCode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return valid metadata for any supported currency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Billing currencies
          'SGD', 'USD', 'GBP', 'AUD', 'EUR',
          // Popular menu currencies
          'MYR', 'THB', 'IDR',
          // Zero-decimal currencies
          'JPY', 'KRW', 'CLP', 'VND',
          // Additional currencies
          'CAD', 'CNY', 'HKD', 'INR', 'NZD', 'PHP', 'CHF', 'SEK', 'NOK', 'DKK'
        ),
        (currencyCode) => {
          const metadata = getCurrencyMetadata(currencyCode);
          
          // Metadata should have all required fields
          expect(metadata).toHaveProperty('code');
          expect(metadata).toHaveProperty('symbol');
          expect(metadata).toHaveProperty('name');
          expect(metadata).toHaveProperty('decimalPlaces');
          expect(metadata).toHaveProperty('symbolPosition');
          
          // Code should match input
          expect(metadata.code).toBe(currencyCode);
          
          // Symbol should be non-empty
          expect(metadata.symbol.length).toBeGreaterThan(0);
          
          // Name should be non-empty
          expect(metadata.name.length).toBeGreaterThan(0);
          
          // Decimal places should be non-negative
          expect(metadata.decimalPlaces).toBeGreaterThanOrEqual(0);
          
          // Symbol position should be either prefix or suffix
          expect(['prefix', 'suffix']).toContain(metadata.symbolPosition);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle case-insensitive currency codes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('usd', 'USD', 'Usd', 'UsD'),
        (currencyCode) => {
          const metadata = getCurrencyMetadata(currencyCode);
          
          // Should always return USD metadata regardless of case
          expect(metadata.code).toBe('USD');
          expect(metadata.symbol).toBe('$');
          expect(metadata.decimalPlaces).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should default to USD for unknown currency codes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('XXX', 'ZZZ', 'INVALID', '123', ''),
        (invalidCode) => {
          const metadata = getCurrencyMetadata(invalidCode);
          
          // Should default to USD for unknown codes
          expect(metadata.code).toBe('USD');
          expect(metadata.symbol).toBe('$');
          expect(metadata.decimalPlaces).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
