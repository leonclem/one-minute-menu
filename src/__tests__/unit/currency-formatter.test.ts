/**
 * Unit Tests for Currency Formatter
 * Feature: currency-support
 * 
 * Tests specific examples, edge cases, and error conditions for currency formatting.
 * Validates: Requirements 6.7, 6.8, 10.4, 12.5, 12.6
 */

import { 
  formatCurrency, 
  getCurrencySymbol, 
  isValidCurrencyCode, 
  parseCurrency 
} from '@/lib/currency-formatter';

describe('Currency Formatter Unit Tests', () => {
  // Spy on console methods
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

  describe('formatCurrency', () => {
    describe('Supported billing currencies (SGD, USD, GBP, AUD, EUR)', () => {
      it('should format SGD correctly', () => {
        // Note: Intl.NumberFormat with en-US locale uses 'SGD' prefix with non-breaking space
        expect(formatCurrency(12.50, 'SGD')).toBe('SGD\u00a012.50');
        expect(formatCurrency(1000, 'SGD')).toBe('SGD\u00a01,000.00');
        expect(formatCurrency(0.99, 'SGD')).toBe('SGD\u00a00.99');
      });

      it('should format USD correctly', () => {
        expect(formatCurrency(12.50, 'USD')).toBe('$12.50');
        expect(formatCurrency(1000, 'USD')).toBe('$1,000.00');
        expect(formatCurrency(0.99, 'USD')).toBe('$0.99');
      });

      it('should format GBP correctly', () => {
        expect(formatCurrency(12.50, 'GBP')).toBe('£12.50');
        expect(formatCurrency(1000, 'GBP')).toBe('£1,000.00');
        expect(formatCurrency(0.99, 'GBP')).toBe('£0.99');
      });

      it('should format AUD correctly', () => {
        expect(formatCurrency(12.50, 'AUD')).toBe('A$12.50');
        expect(formatCurrency(1000, 'AUD')).toBe('A$1,000.00');
        expect(formatCurrency(0.99, 'AUD')).toBe('A$0.99');
      });

      it('should format EUR correctly', () => {
        expect(formatCurrency(12.50, 'EUR')).toBe('€12.50');
        expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00');
        expect(formatCurrency(0.99, 'EUR')).toBe('€0.99');
      });
    });

    describe('Popular menu currencies', () => {
      it('should format MYR correctly', () => {
        // Note: Intl.NumberFormat with en-US locale uses 'MYR' prefix with non-breaking space
        expect(formatCurrency(12.50, 'MYR')).toBe('MYR\u00a012.50');
        expect(formatCurrency(1000, 'MYR')).toBe('MYR\u00a01,000.00');
      });

      it('should format THB correctly', () => {
        // Note: Intl.NumberFormat with en-US locale uses 'THB' prefix with non-breaking space
        expect(formatCurrency(12.50, 'THB')).toBe('THB\u00a012.50');
        expect(formatCurrency(1000, 'THB')).toBe('THB\u00a01,000.00');
      });

      it('should format IDR correctly', () => {
        // Note: Intl.NumberFormat with en-US locale uses 'IDR' prefix with non-breaking space
        expect(formatCurrency(12500, 'IDR')).toBe('IDR\u00a012,500.00');
        expect(formatCurrency(1000000, 'IDR')).toBe('IDR\u00a01,000,000.00');
      });
    });

    describe('Zero-decimal currencies (JPY, KRW)', () => {
      it('should format JPY without decimals', () => {
        const result = formatCurrency(1500, 'JPY');
        expect(result).toBe('¥1,500');
        expect(result).not.toContain('.');
      });

      it('should format KRW without decimals', () => {
        const result = formatCurrency(15000, 'KRW');
        expect(result).toBe('₩15,000');
        expect(result).not.toContain('.');
      });

      it('should handle large amounts in JPY', () => {
        const result = formatCurrency(1000000, 'JPY');
        expect(result).toBe('¥1,000,000');
        expect(result).not.toContain('.');
      });

      it('should handle zero in zero-decimal currencies', () => {
        expect(formatCurrency(0, 'JPY')).toBe('¥0');
        expect(formatCurrency(0, 'KRW')).toBe('₩0');
      });
    });

    describe('Symbol position (prefix vs suffix)', () => {
      it('should use prefix for USD', () => {
        const result = formatCurrency(10, 'USD');
        expect(result).toMatch(/^\$/);
      });

      it('should use prefix for EUR', () => {
        const result = formatCurrency(10, 'EUR');
        expect(result).toMatch(/^€/);
      });

      it('should use prefix for GBP', () => {
        const result = formatCurrency(10, 'GBP');
        expect(result).toMatch(/^£/);
      });
    });

    describe('Null/undefined amount handling', () => {
      it('should handle null amount and return formatted zero', () => {
        const result = formatCurrency(null, 'USD');
        expect(result).toBe('$0.00');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Null/undefined amount passed to currency formatter',
          { currencyCode: 'USD' }
        );
      });

      it('should handle undefined amount and return formatted zero', () => {
        const result = formatCurrency(undefined, 'USD');
        expect(result).toBe('$0.00');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Null/undefined amount passed to currency formatter',
          { currencyCode: 'USD' }
        );
      });

      it('should handle null amount with different currencies', () => {
        // Note: Intl.NumberFormat with en-US locale uses 'SGD' prefix with non-breaking space
        expect(formatCurrency(null, 'SGD')).toBe('SGD\u00a00.00');
        expect(formatCurrency(null, 'GBP')).toBe('£0.00');
        expect(formatCurrency(null, 'JPY')).toBe('¥0');
      });
    });

    describe('Invalid currency code handling', () => {
      it('should default to USD for invalid currency code', () => {
        const result = formatCurrency(10, 'INVALID');
        expect(result).toBe('$10.00');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Invalid currency code passed to formatter',
          { currencyCode: 'INVALID', amount: 10 }
        );
      });

      it('should default to USD for empty string', () => {
        const result = formatCurrency(10, '');
        expect(result).toBe('$10.00');
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should default to USD for too short code', () => {
        const result = formatCurrency(10, 'AB');
        expect(result).toBe('$10.00');
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should default to USD for too long code', () => {
        const result = formatCurrency(10, 'ABCD');
        expect(result).toBe('$10.00');
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should default to USD for numeric string', () => {
        const result = formatCurrency(10, '123');
        expect(result).toBe('$10.00');
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('Format options', () => {
      it('should respect showSymbol option', () => {
        const withSymbol = formatCurrency(10, 'USD', { showSymbol: true });
        const withoutSymbol = formatCurrency(10, 'USD', { showSymbol: false });
        
        expect(withSymbol).toBe('$10.00');
        // When showSymbol is false, Intl.NumberFormat uses decimal style without decimals for whole numbers
        expect(withoutSymbol).toBe('10');
      });

      it('should respect showCode option', () => {
        const result = formatCurrency(10, 'USD', { showCode: true });
        expect(result).toContain('USD');
      });

      it('should use en-US locale by default', () => {
        const result = formatCurrency(1000.50, 'USD');
        expect(result).toBe('$1,000.50');
      });

      it('should respect custom locale option', () => {
        const result = formatCurrency(1000.50, 'USD', { locale: 'en-US' });
        expect(result).toBe('$1,000.50');
      });
    });

    describe('Edge cases', () => {
      it('should handle zero amount', () => {
        expect(formatCurrency(0, 'USD')).toBe('$0.00');
        expect(formatCurrency(0, 'JPY')).toBe('¥0');
      });

      it('should handle negative amounts', () => {
        expect(formatCurrency(-10.50, 'USD')).toBe('-$10.50');
        expect(formatCurrency(-1000, 'JPY')).toBe('-¥1,000');
      });

      it('should handle very large amounts', () => {
        const result = formatCurrency(999999.99, 'USD');
        expect(result).toBe('$999,999.99');
      });

      it('should handle very small amounts', () => {
        expect(formatCurrency(0.01, 'USD')).toBe('$0.01');
      });

      it('should round sub-cent amounts', () => {
        const result = formatCurrency(10.005, 'USD');
        // Intl.NumberFormat rounds to 2 decimals
        expect(result).toMatch(/^\$10\.0[01]$/);
      });

      it('should handle amounts with many decimal places', () => {
        const result = formatCurrency(12.3456789, 'USD');
        // Should round to 2 decimal places
        expect(result).toMatch(/^\$12\.3[45]$/);
      });
    });

    describe('Case insensitivity', () => {
      it('should handle lowercase currency codes', () => {
        expect(formatCurrency(10, 'usd')).toBe('$10.00');
        // Note: Intl.NumberFormat with en-US locale uses 'SGD' prefix with non-breaking space
        expect(formatCurrency(10, 'sgd')).toBe('SGD\u00a010.00');
      });

      it('should handle mixed case currency codes', () => {
        expect(formatCurrency(10, 'UsD')).toBe('$10.00');
        // Note: Intl.NumberFormat with en-US locale uses 'SGD' prefix with non-breaking space
        expect(formatCurrency(10, 'Sgd')).toBe('SGD\u00a010.00');
      });
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return correct symbol for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('should return correct symbol for SGD', () => {
      expect(getCurrencySymbol('SGD')).toBe('S$');
    });

    it('should return correct symbol for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    it('should return correct symbol for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return correct symbol for JPY', () => {
      expect(getCurrencySymbol('JPY')).toBe('¥');
    });

    it('should return correct symbol for AUD', () => {
      expect(getCurrencySymbol('AUD')).toBe('A$');
    });

    it('should handle lowercase currency codes', () => {
      expect(getCurrencySymbol('usd')).toBe('$');
      expect(getCurrencySymbol('eur')).toBe('€');
    });

    it('should default to $ for invalid currency code', () => {
      const result = getCurrencySymbol('INVALID');
      expect(result).toBe('$');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid currency code passed to getCurrencySymbol',
        { code: 'INVALID' }
      );
    });

    it('should default to $ for empty string', () => {
      const result = getCurrencySymbol('');
      expect(result).toBe('$');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('isValidCurrencyCode', () => {
    it('should return true for valid 3-letter uppercase codes', () => {
      expect(isValidCurrencyCode('USD')).toBe(true);
      expect(isValidCurrencyCode('SGD')).toBe(true);
      expect(isValidCurrencyCode('GBP')).toBe(true);
      expect(isValidCurrencyCode('EUR')).toBe(true);
      expect(isValidCurrencyCode('JPY')).toBe(true);
    });

    it('should return false for lowercase codes', () => {
      expect(isValidCurrencyCode('usd')).toBe(false);
      expect(isValidCurrencyCode('sgd')).toBe(false);
    });

    it('should return false for mixed case codes', () => {
      expect(isValidCurrencyCode('Usd')).toBe(false);
      expect(isValidCurrencyCode('UsD')).toBe(false);
    });

    it('should return false for too short codes', () => {
      expect(isValidCurrencyCode('US')).toBe(false);
      expect(isValidCurrencyCode('A')).toBe(false);
    });

    it('should return false for too long codes', () => {
      expect(isValidCurrencyCode('USDA')).toBe(false);
      expect(isValidCurrencyCode('USDOLLAR')).toBe(false);
    });

    it('should return false for numeric strings', () => {
      expect(isValidCurrencyCode('123')).toBe(false);
      expect(isValidCurrencyCode('12A')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidCurrencyCode('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidCurrencyCode(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidCurrencyCode(undefined as any)).toBe(false);
    });

    it('should return false for special characters', () => {
      expect(isValidCurrencyCode('US$')).toBe(false);
      expect(isValidCurrencyCode('U-D')).toBe(false);
      expect(isValidCurrencyCode('U D')).toBe(false);
    });
  });

  describe('parseCurrency', () => {
    describe('Round-trip for valid inputs', () => {
      it('should parse USD formatted strings', () => {
        expect(parseCurrency('$12.50', 'USD')).toBe(12.50);
        expect(parseCurrency('$1,000.00', 'USD')).toBe(1000.00);
        expect(parseCurrency('$0.99', 'USD')).toBe(0.99);
      });

      it('should parse SGD formatted strings', () => {
        expect(parseCurrency('S$12.50', 'SGD')).toBe(12.50);
        expect(parseCurrency('S$1,000.00', 'SGD')).toBe(1000.00);
      });

      it('should parse EUR formatted strings', () => {
        expect(parseCurrency('€12.50', 'EUR')).toBe(12.50);
        expect(parseCurrency('€1,000.00', 'EUR')).toBe(1000.00);
      });

      it('should parse JPY formatted strings (no decimals)', () => {
        expect(parseCurrency('¥1,500', 'JPY')).toBe(1500);
        expect(parseCurrency('¥1000', 'JPY')).toBe(1000);
      });

      it('should handle round-trip formatting and parsing', () => {
        const amount = 123.45;
        const formatted = formatCurrency(amount, 'USD');
        const parsed = parseCurrency(formatted, 'USD');
        expect(parsed).toBe(amount);
      });

      it('should handle round-trip for zero-decimal currencies', () => {
        const amount = 1500;
        const formatted = formatCurrency(amount, 'JPY');
        const parsed = parseCurrency(formatted, 'JPY');
        expect(parsed).toBe(amount);
      });
    });

    describe('Edge cases', () => {
      it('should parse negative amounts', () => {
        expect(parseCurrency('-$10.50', 'USD')).toBe(-10.50);
      });

      it('should parse zero', () => {
        expect(parseCurrency('$0.00', 'USD')).toBe(0);
        expect(parseCurrency('¥0', 'JPY')).toBe(0);
      });

      it('should parse amounts without symbols', () => {
        expect(parseCurrency('12.50', 'USD')).toBe(12.50);
        expect(parseCurrency('1,000.00', 'USD')).toBe(1000.00);
      });

      it('should handle amounts with spaces', () => {
        expect(parseCurrency('$ 12.50', 'USD')).toBe(12.50);
      });
    });

    describe('Error handling', () => {
      it('should return null for invalid formatted string', () => {
        const result = parseCurrency('invalid', 'USD');
        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should return null for empty string', () => {
        const result = parseCurrency('', 'USD');
        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should return null for null input', () => {
        const result = parseCurrency(null as any, 'USD');
        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should return null for undefined input', () => {
        const result = parseCurrency(undefined as any, 'USD');
        expect(result).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should return null for invalid currency code', () => {
        const result = parseCurrency('$12.50', 'INVALID');
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Invalid currency code passed to parseCurrency',
          { currencyCode: 'INVALID', formatted: '$12.50' }
        );
      });

      it('should return null for non-numeric strings', () => {
        expect(parseCurrency('abc', 'USD')).toBeNull();
        expect(parseCurrency('$$$', 'USD')).toBeNull();
      });
    });
  });
});
