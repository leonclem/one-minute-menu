/**
 * Unit Tests for Currency Configuration
 * Feature: currency-support
 * 
 * Tests currency configuration functions and metadata
 * Validates: Requirements 3.6, 5.4, 6.8
 */

import {
  getSupportedBillingCurrencies,
  getPopularMenuCurrencies,
  getCurrencyMetadata,
  getAllCurrencies,
  type BillingCurrency,
  type ISO4217CurrencyCode,
} from '@/lib/currency-config';

describe('Currency Configuration', () => {
  describe('getSupportedBillingCurrencies', () => {
    it('should return exactly 5 currencies', () => {
      const currencies = getSupportedBillingCurrencies();
      expect(currencies).toHaveLength(5);
    });

    it('should return SGD, USD, GBP, AUD, EUR', () => {
      const currencies = getSupportedBillingCurrencies();
      expect(currencies).toEqual(['SGD', 'USD', 'GBP', 'AUD', 'EUR']);
    });

    it('should return a new array each time (not mutate original)', () => {
      const currencies1 = getSupportedBillingCurrencies();
      const currencies2 = getSupportedBillingCurrencies();
      
      expect(currencies1).toEqual(currencies2);
      expect(currencies1).not.toBe(currencies2); // Different array instances
    });
  });

  describe('getPopularMenuCurrencies', () => {
    it('should return expected list of popular currencies', () => {
      const currencies = getPopularMenuCurrencies();
      
      // Should include all popular currencies
      expect(currencies).toContain('SGD');
      expect(currencies).toContain('USD');
      expect(currencies).toContain('GBP');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('AUD');
      expect(currencies).toContain('MYR');
      expect(currencies).toContain('THB');
      expect(currencies).toContain('IDR');
    });

    it('should return at least 8 currencies', () => {
      const currencies = getPopularMenuCurrencies();
      expect(currencies.length).toBeGreaterThanOrEqual(8);
    });

    it('should return a new array each time (not mutate original)', () => {
      const currencies1 = getPopularMenuCurrencies();
      const currencies2 = getPopularMenuCurrencies();
      
      expect(currencies1).toEqual(currencies2);
      expect(currencies1).not.toBe(currencies2); // Different array instances
    });
  });

  describe('getCurrencyMetadata', () => {
    describe('Billing currencies', () => {
      it('should return correct metadata for SGD', () => {
        const metadata = getCurrencyMetadata('SGD');
        
        expect(metadata.code).toBe('SGD');
        expect(metadata.symbol).toBe('S$');
        expect(metadata.name).toBe('Singapore Dollar');
        expect(metadata.decimalPlaces).toBe(2);
        expect(metadata.symbolPosition).toBe('prefix');
      });

      it('should return correct metadata for USD', () => {
        const metadata = getCurrencyMetadata('USD');
        
        expect(metadata.code).toBe('USD');
        expect(metadata.symbol).toBe('$');
        expect(metadata.name).toBe('US Dollar');
        expect(metadata.decimalPlaces).toBe(2);
        expect(metadata.symbolPosition).toBe('prefix');
      });

      it('should return correct metadata for GBP', () => {
        const metadata = getCurrencyMetadata('GBP');
        
        expect(metadata.code).toBe('GBP');
        expect(metadata.symbol).toBe('£');
        expect(metadata.name).toBe('British Pound');
        expect(metadata.decimalPlaces).toBe(2);
        expect(metadata.symbolPosition).toBe('prefix');
      });

      it('should return correct metadata for AUD', () => {
        const metadata = getCurrencyMetadata('AUD');
        
        expect(metadata.code).toBe('AUD');
        expect(metadata.symbol).toBe('A$');
        expect(metadata.name).toBe('Australian Dollar');
        expect(metadata.decimalPlaces).toBe(2);
        expect(metadata.symbolPosition).toBe('prefix');
      });

      it('should return correct metadata for EUR', () => {
        const metadata = getCurrencyMetadata('EUR');
        
        expect(metadata.code).toBe('EUR');
        expect(metadata.symbol).toBe('€');
        expect(metadata.name).toBe('Euro');
        expect(metadata.decimalPlaces).toBe(2);
        expect(metadata.symbolPosition).toBe('prefix');
      });
    });

    describe('Zero-decimal currencies', () => {
      it('should return 0 decimal places for JPY', () => {
        const metadata = getCurrencyMetadata('JPY');
        
        expect(metadata.code).toBe('JPY');
        expect(metadata.symbol).toBe('¥');
        expect(metadata.name).toBe('Japanese Yen');
        expect(metadata.decimalPlaces).toBe(0);
        expect(metadata.symbolPosition).toBe('prefix');
      });

      it('should return 0 decimal places for KRW', () => {
        const metadata = getCurrencyMetadata('KRW');
        
        expect(metadata.code).toBe('KRW');
        expect(metadata.symbol).toBe('₩');
        expect(metadata.name).toBe('South Korean Won');
        expect(metadata.decimalPlaces).toBe(0);
        expect(metadata.symbolPosition).toBe('prefix');
      });
    });

    describe('Symbol position', () => {
      it('should return prefix position for USD', () => {
        const metadata = getCurrencyMetadata('USD');
        expect(metadata.symbolPosition).toBe('prefix');
      });

      it('should return suffix position for SEK', () => {
        const metadata = getCurrencyMetadata('SEK');
        expect(metadata.symbolPosition).toBe('suffix');
      });

      it('should return suffix position for NOK', () => {
        const metadata = getCurrencyMetadata('NOK');
        expect(metadata.symbolPosition).toBe('suffix');
      });

      it('should return suffix position for DKK', () => {
        const metadata = getCurrencyMetadata('DKK');
        expect(metadata.symbolPosition).toBe('suffix');
      });

      it('should return suffix position for VND', () => {
        const metadata = getCurrencyMetadata('VND');
        expect(metadata.symbolPosition).toBe('suffix');
      });
    });

    describe('Case handling', () => {
      it('should handle lowercase currency codes', () => {
        const metadata = getCurrencyMetadata('usd');
        expect(metadata.code).toBe('USD');
      });

      it('should handle mixed case currency codes', () => {
        const metadata = getCurrencyMetadata('GbP');
        expect(metadata.code).toBe('GBP');
      });
    });

    describe('Invalid currency codes', () => {
      it('should default to USD for unknown currency code', () => {
        const metadata = getCurrencyMetadata('XXX');
        
        expect(metadata.code).toBe('USD');
        expect(metadata.symbol).toBe('$');
        expect(metadata.decimalPlaces).toBe(2);
      });

      it('should default to USD for empty string', () => {
        const metadata = getCurrencyMetadata('');
        
        expect(metadata.code).toBe('USD');
      });

      it('should log warning for unknown currency code', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        
        getCurrencyMetadata('INVALID');
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Currency metadata not found for code: INVALID')
        );
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('getAllCurrencies', () => {
    it('should return an array of currency metadata', () => {
      const currencies = getAllCurrencies();
      
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);
    });

    it('should include all billing currencies', () => {
      const currencies = getAllCurrencies();
      const codes = currencies.map(c => c.code);
      
      expect(codes).toContain('SGD');
      expect(codes).toContain('USD');
      expect(codes).toContain('GBP');
      expect(codes).toContain('AUD');
      expect(codes).toContain('EUR');
    });

    it('should include popular menu currencies', () => {
      const currencies = getAllCurrencies();
      const codes = currencies.map(c => c.code);
      
      expect(codes).toContain('MYR');
      expect(codes).toContain('THB');
      expect(codes).toContain('IDR');
    });

    it('should include zero-decimal currencies', () => {
      const currencies = getAllCurrencies();
      const codes = currencies.map(c => c.code);
      
      expect(codes).toContain('JPY');
      expect(codes).toContain('KRW');
    });

    it('should return metadata objects with all required fields', () => {
      const currencies = getAllCurrencies();
      
      currencies.forEach(currency => {
        expect(currency).toHaveProperty('code');
        expect(currency).toHaveProperty('symbol');
        expect(currency).toHaveProperty('name');
        expect(currency).toHaveProperty('decimalPlaces');
        expect(currency).toHaveProperty('symbolPosition');
        
        expect(typeof currency.code).toBe('string');
        expect(typeof currency.symbol).toBe('string');
        expect(typeof currency.name).toBe('string');
        expect(typeof currency.decimalPlaces).toBe('number');
        expect(['prefix', 'suffix']).toContain(currency.symbolPosition);
      });
    });
  });
});
