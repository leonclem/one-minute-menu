/**
 * Property-Based Tests for Currency Formatter Error Handling
 * Feature: currency-support
 * 
 * Tests Property 11: Currency Formatter Error Handling
 * Validates: Requirements 12.5, 12.6
 */

import fc from 'fast-check';
import { formatCurrency } from '@/lib/currency-formatter';

describe('Feature: currency-support, Property 11: Currency Formatter Error Handling', () => {
  // Spy on console methods to verify logging
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  /**
   * Property 11: Currency Formatter Error Handling
   * For any invalid currency code or null amount, the Currency_Formatter should 
   * log an appropriate message and return a safe default value without throwing exceptions.
   * 
   * This test verifies that:
   * 1. Invalid currency codes log errors and default to USD
   * 2. Null/undefined amounts log warnings and return formatted zero
   * 3. No exceptions are thrown for invalid inputs
   * 4. System continues functioning with safe defaults
   */
  it('should log error and default to USD for invalid currency codes', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.constantFrom(
          'INVALID', // Invalid string
          '123', // Numeric string
          'AB', // Too short
          'ABCD', // Too long
          '', // Empty string
          'usd123', // Mixed valid/invalid
          '!!!', // Special characters
        ),
        (amount, invalidCode) => {
          consoleErrorSpy.mockClear();
          
          // Should not throw exception
          expect(() => {
            const result = formatCurrency(amount, invalidCode);
            
            // Should return a valid formatted string (defaulting to USD)
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
            
            // Should contain USD symbol
            expect(result).toContain('$');
          }).not.toThrow();
          
          // Should have logged an error
          expect(consoleErrorSpy).toHaveBeenCalled();
          expect(consoleErrorSpy.mock.calls[0][0]).toContain('Invalid currency code');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should log warning and return formatted zero for null amounts', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SGD', 'USD', 'GBP', 'EUR', 'JPY'),
        (currencyCode) => {
          consoleWarnSpy.mockClear();
          
          // Test with null
          const resultNull = formatCurrency(null, currencyCode);
          expect(typeof resultNull).toBe('string');
          expect(resultNull.length).toBeGreaterThan(0);
          expect(consoleWarnSpy).toHaveBeenCalled();
          expect(consoleWarnSpy.mock.calls[0][0]).toContain('Null/undefined amount');
          
          consoleWarnSpy.mockClear();
          
          // Test with undefined
          const resultUndefined = formatCurrency(undefined, currencyCode);
          expect(typeof resultUndefined).toBe('string');
          expect(resultUndefined.length).toBeGreaterThan(0);
          expect(consoleWarnSpy).toHaveBeenCalled();
          expect(consoleWarnSpy.mock.calls[0][0]).toContain('Null/undefined amount');
          
          // Both should produce the same result (formatted zero)
          expect(resultNull).toBe(resultUndefined);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never throw exceptions for any combination of invalid inputs', () => {
    fc.assert(
      fc.property(
        // Generate various invalid amounts
        fc.constantFrom(null, undefined),
        // Generate various invalid currency codes
        fc.constantFrom('', 'INVALID', 'XXX', '123', 'AB', 'ABCD'),
        (amount, invalidCode) => {
          // Should not throw exception
          expect(() => {
            const result = formatCurrency(amount as any, invalidCode);
            
            // Should return a string
            expect(typeof result).toBe('string');
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle invalid currency codes with valid amounts gracefully', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (amount) => {
          consoleErrorSpy.mockClear();
          
          // Test with various invalid codes
          const invalidCodes = ['', 'INVALID', '123', 'AB'];
          
          for (const invalidCode of invalidCodes) {
            const result = formatCurrency(amount, invalidCode);
            
            // Should return a valid formatted string (USD default)
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
            expect(result).toContain('$');
            
            // Should not throw
            expect(() => formatCurrency(amount, invalidCode)).not.toThrow();
          }
          
          // Should have logged errors
          expect(consoleErrorSpy).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle null/undefined amounts with valid currency codes gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SGD', 'USD', 'GBP', 'EUR', 'AUD', 'JPY', 'KRW'),
        (currencyCode) => {
          consoleWarnSpy.mockClear();
          
          // Test null
          const resultNull = formatCurrency(null, currencyCode);
          expect(typeof resultNull).toBe('string');
          expect(resultNull.length).toBeGreaterThan(0);
          
          // Test undefined
          const resultUndefined = formatCurrency(undefined, currencyCode);
          expect(typeof resultUndefined).toBe('string');
          expect(resultUndefined.length).toBeGreaterThan(0);
          
          // Should have logged warnings
          expect(consoleWarnSpy).toHaveBeenCalled();
          
          // Should not throw
          expect(() => formatCurrency(null, currencyCode)).not.toThrow();
          expect(() => formatCurrency(undefined, currencyCode)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return consistent default values for repeated invalid inputs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('INVALID', '', '123'),
        (invalidCode) => {
          consoleErrorSpy.mockClear();
          
          // Call multiple times with same invalid input
          const result1 = formatCurrency(100, invalidCode);
          const result2 = formatCurrency(100, invalidCode);
          const result3 = formatCurrency(100, invalidCode);
          
          // Should return consistent results (all defaulting to USD)
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
          
          // All should contain USD symbol
          expect(result1).toContain('$');
          expect(result2).toContain('$');
          expect(result3).toContain('$');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should log appropriate context information in error messages', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.constantFrom('INVALID', ''),
        (amount, invalidCode) => {
          consoleErrorSpy.mockClear();
          
          formatCurrency(amount, invalidCode);
          
          // Should have logged error with context
          expect(consoleErrorSpy).toHaveBeenCalled();
          const errorCall = consoleErrorSpy.mock.calls[0];
          
          // Error message should contain relevant information
          expect(errorCall[0]).toContain('Invalid currency code');
          
          // Context object should include the invalid code and amount
          if (errorCall[1]) {
            expect(errorCall[1]).toHaveProperty('currencyCode');
            expect(errorCall[1]).toHaveProperty('amount');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should log appropriate context information in warning messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SGD', 'USD', 'GBP', 'EUR'),
        (currencyCode) => {
          consoleWarnSpy.mockClear();
          
          formatCurrency(null, currencyCode);
          
          // Should have logged warning with context
          expect(consoleWarnSpy).toHaveBeenCalled();
          const warnCall = consoleWarnSpy.mock.calls[0];
          
          // Warning message should contain relevant information
          expect(warnCall[0]).toContain('Null/undefined amount');
          
          // Context object should include the currency code
          if (warnCall[1]) {
            expect(warnCall[1]).toHaveProperty('currencyCode');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
