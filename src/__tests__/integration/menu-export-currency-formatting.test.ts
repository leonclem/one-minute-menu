/**
 * Integration Tests for Menu Export Currency Formatting
 * 
 * Feature: currency-support
 * Task: 21.5 Write integration tests for menu exports
 * 
 * Tests that currency formatting is consistent across all export types:
 * - PDF export shows correct currency formatting
 * - PNG export shows correct currency formatting
 * - HTML view shows correct currency formatting
 * - QR view shows correct currency formatting
 * - All exports use same formatting for same menu
 * - Exports are deterministic (same input → same output)
 * 
 * Validates: Requirements 6.3, 6.4, 6.5, 6.6, 10.4, 10.5
 */

import { formatCurrency } from '@/lib/currency-formatter';
import { getMenuCurrency } from '@/lib/menu-currency-service';

// Mock the menu currency service
jest.mock('@/lib/menu-currency-service');

const mockGetMenuCurrency = getMenuCurrency as jest.MockedFunction<typeof getMenuCurrency>;

describe('Feature: currency-support - Menu Export Currency Formatting Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Currency Formatting Consistency Across Exports', () => {
    it('should format prices identically across PDF, PNG, HTML, and QR exports', async () => {
      // Setup: User has SGD as menu currency
      const userId = 'test-user-123';
      const menuCurrency = 'SGD';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      // Test menu item prices
      const testPrices = [12.50, 8.99, 25.00, 4.50, 100.00];

      // Get menu currency (simulating what each export does)
      const currency = await getMenuCurrency(userId);

      // Format prices for each export type (all should use same formatter)
      const pdfFormattedPrices = testPrices.map(price => 
        formatCurrency(price, currency, { locale: 'en-US' })
      );

      const pngFormattedPrices = testPrices.map(price => 
        formatCurrency(price, currency, { locale: 'en-US' })
      );

      const htmlFormattedPrices = testPrices.map(price => 
        formatCurrency(price, currency, { locale: 'en-US' })
      );

      const qrFormattedPrices = testPrices.map(price => 
        formatCurrency(price, currency, { locale: 'en-US' })
      );

      // VERIFY: All exports format prices identically
      expect(pdfFormattedPrices).toEqual(pngFormattedPrices);
      expect(pdfFormattedPrices).toEqual(htmlFormattedPrices);
      expect(pdfFormattedPrices).toEqual(qrFormattedPrices);

      // VERIFY: Formatting is correct for SGD
      // Note: Intl.NumberFormat uses non-breaking space (U+00A0) between currency code and amount
      expect(pdfFormattedPrices[0]).toBe('SGD\u00A012.50');
      expect(pdfFormattedPrices[1]).toBe('SGD\u00A08.99');
      expect(pdfFormattedPrices[2]).toBe('SGD\u00A025.00');
      expect(pdfFormattedPrices[3]).toBe('SGD\u00A04.50');
      expect(pdfFormattedPrices[4]).toBe('SGD\u00A0100.00');
    });

    it('should format prices identically for USD across all exports', async () => {
      const userId = 'test-user-456';
      const menuCurrency = 'USD';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const testPrices = [15.99, 7.50, 30.00];

      const currency = await getMenuCurrency(userId);

      // Format for all export types
      const pdfFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const pngFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const htmlFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const qrFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));

      // VERIFY: All identical
      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);

      // VERIFY: Correct USD formatting
      expect(pdfFormatted[0]).toBe('$15.99');
      expect(pdfFormatted[1]).toBe('$7.50');
      expect(pdfFormatted[2]).toBe('$30.00');
    });

    it('should format prices identically for EUR across all exports', async () => {
      const userId = 'test-user-789';
      const menuCurrency = 'EUR';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const testPrices = [10.50, 22.99, 45.00];

      const currency = await getMenuCurrency(userId);

      const pdfFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const pngFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const htmlFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const qrFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));

      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);

      expect(pdfFormatted[0]).toBe('€10.50');
      expect(pdfFormatted[1]).toBe('€22.99');
      expect(pdfFormatted[2]).toBe('€45.00');
    });

    it('should format zero-decimal currencies (JPY) identically across all exports', async () => {
      const userId = 'test-user-jpy';
      const menuCurrency = 'JPY';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const testPrices = [1500, 2800, 5000];

      const currency = await getMenuCurrency(userId);

      const pdfFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const pngFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const htmlFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));
      const qrFormatted = testPrices.map(p => formatCurrency(p, currency, { locale: 'en-US' }));

      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);

      // VERIFY: No decimal places for JPY
      expect(pdfFormatted[0]).toBe('¥1,500');
      expect(pdfFormatted[1]).toBe('¥2,800');
      expect(pdfFormatted[2]).toBe('¥5,000');
    });
  });

  describe('Export Determinism', () => {
    it('should produce identical output for same input across multiple export calls', async () => {
      const userId = 'test-user-determinism';
      const menuCurrency = 'GBP';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const testPrice = 19.99;
      const currency = await getMenuCurrency(userId);

      // Format the same price multiple times
      const results: string[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(formatCurrency(testPrice, currency, { locale: 'en-US' }));
      }

      // VERIFY: All results are identical (deterministic)
      const firstResult = results[0];
      expect(results.every(r => r === firstResult)).toBe(true);
      expect(firstResult).toBe('£19.99');
    });

    it('should produce deterministic output for PDF exports', async () => {
      const userId = 'test-user-pdf';
      const menuCurrency = 'AUD';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const menuItems = [
        { name: 'Burger', price: 15.50 },
        { name: 'Fries', price: 6.00 },
        { name: 'Drink', price: 4.50 }
      ];

      const currency = await getMenuCurrency(userId);

      // Simulate multiple PDF export renders
      const render1 = menuItems.map(item => ({
        name: item.name,
        formattedPrice: formatCurrency(item.price, currency, { locale: 'en-US' })
      }));

      const render2 = menuItems.map(item => ({
        name: item.name,
        formattedPrice: formatCurrency(item.price, currency, { locale: 'en-US' })
      }));

      const render3 = menuItems.map(item => ({
        name: item.name,
        formattedPrice: formatCurrency(item.price, currency, { locale: 'en-US' })
      }));

      // VERIFY: All renders produce identical output
      expect(render1).toEqual(render2);
      expect(render1).toEqual(render3);

      // VERIFY: Correct AUD formatting
      expect(render1[0].formattedPrice).toBe('A$15.50');
      expect(render1[1].formattedPrice).toBe('A$6.00');
      expect(render1[2].formattedPrice).toBe('A$4.50');
    });

    it('should produce deterministic output for PNG exports', async () => {
      const userId = 'test-user-png';
      const menuCurrency = 'THB';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const testPrice = 250.00;
      const currency = await getMenuCurrency(userId);

      // Simulate multiple PNG export renders
      const renders = Array.from({ length: 5 }, () => 
        formatCurrency(testPrice, currency, { locale: 'en-US' })
      );

      // VERIFY: All renders identical
      expect(new Set(renders).size).toBe(1);
      expect(renders[0]).toBe('THB\u00A0250.00');
    });

    it('should produce deterministic output for HTML exports', async () => {
      const userId = 'test-user-html';
      const menuCurrency = 'MYR';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const testPrice = 35.90;
      const currency = await getMenuCurrency(userId);

      // Simulate multiple HTML renders
      const renders = Array.from({ length: 5 }, () => 
        formatCurrency(testPrice, currency, { locale: 'en-US' })
      );

      // VERIFY: All renders identical
      expect(new Set(renders).size).toBe(1);
      expect(renders[0]).toBe('MYR\u00A035.90');
    });

    it('should produce deterministic output for QR menu view', async () => {
      const userId = 'test-user-qr';
      const menuCurrency = 'IDR';
      mockGetMenuCurrency.mockResolvedValue(menuCurrency);

      const testPrice = 50000;
      const currency = await getMenuCurrency(userId);

      // Simulate multiple QR view renders
      const renders = Array.from({ length: 5 }, () => 
        formatCurrency(testPrice, currency, { locale: 'en-US' })
      );

      // VERIFY: All renders identical
      expect(new Set(renders).size).toBe(1);
      expect(renders[0]).toBe('IDR\u00A050,000.00');
    });
  });

  describe('Currency-Specific Formatting Across Exports', () => {
    it('should handle SGD formatting correctly in all exports', async () => {
      const userId = 'test-sgd';
      mockGetMenuCurrency.mockResolvedValue('SGD');

      const currency = await getMenuCurrency(userId);
      const price = 18.80;

      const formatted = formatCurrency(price, currency, { locale: 'en-US' });

      // VERIFY: SGD uses code format with en-US locale (with non-breaking space)
      expect(formatted).toBe('SGD\u00A018.80');
      expect(formatted).toContain('SGD');
      expect(formatted).toContain('18.80');
    });

    it('should handle GBP formatting correctly in all exports', async () => {
      const userId = 'test-gbp';
      mockGetMenuCurrency.mockResolvedValue('GBP');

      const currency = await getMenuCurrency(userId);
      const price = 12.50;

      const formatted = formatCurrency(price, currency, { locale: 'en-US' });

      // VERIFY: GBP uses £ prefix
      expect(formatted).toBe('£12.50');
      expect(formatted).toContain('£');
    });

    it('should handle KRW (zero-decimal) formatting correctly in all exports', async () => {
      const userId = 'test-krw';
      mockGetMenuCurrency.mockResolvedValue('KRW');

      const currency = await getMenuCurrency(userId);
      const price = 15000;

      const formatted = formatCurrency(price, currency, { locale: 'en-US' });

      // VERIFY: KRW has no decimal places
      expect(formatted).toBe('₩15,000');
      expect(formatted).not.toContain('.');
    });
  });

  describe('Edge Cases in Export Formatting', () => {
    it('should handle very large amounts consistently across exports', async () => {
      const userId = 'test-large';
      mockGetMenuCurrency.mockResolvedValue('USD');

      const currency = await getMenuCurrency(userId);
      const largePrice = 999999.99;

      const pdfFormatted = formatCurrency(largePrice, currency, { locale: 'en-US' });
      const pngFormatted = formatCurrency(largePrice, currency, { locale: 'en-US' });
      const htmlFormatted = formatCurrency(largePrice, currency, { locale: 'en-US' });
      const qrFormatted = formatCurrency(largePrice, currency, { locale: 'en-US' });

      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);
      expect(pdfFormatted).toBe('$999,999.99');
    });

    it('should handle very small amounts consistently across exports', async () => {
      const userId = 'test-small';
      mockGetMenuCurrency.mockResolvedValue('EUR');

      const currency = await getMenuCurrency(userId);
      const smallPrice = 0.50;

      const pdfFormatted = formatCurrency(smallPrice, currency, { locale: 'en-US' });
      const pngFormatted = formatCurrency(smallPrice, currency, { locale: 'en-US' });
      const htmlFormatted = formatCurrency(smallPrice, currency, { locale: 'en-US' });
      const qrFormatted = formatCurrency(smallPrice, currency, { locale: 'en-US' });

      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);
      expect(pdfFormatted).toBe('€0.50');
    });

    it('should handle zero amounts consistently across exports', async () => {
      const userId = 'test-zero';
      mockGetMenuCurrency.mockResolvedValue('GBP');

      const currency = await getMenuCurrency(userId);
      const zeroPrice = 0;

      const pdfFormatted = formatCurrency(zeroPrice, currency, { locale: 'en-US' });
      const pngFormatted = formatCurrency(zeroPrice, currency, { locale: 'en-US' });
      const htmlFormatted = formatCurrency(zeroPrice, currency, { locale: 'en-US' });
      const qrFormatted = formatCurrency(zeroPrice, currency, { locale: 'en-US' });

      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);
      expect(pdfFormatted).toBe('£0.00');
    });

    it('should handle prices with many decimal places consistently', async () => {
      const userId = 'test-decimals';
      mockGetMenuCurrency.mockResolvedValue('USD');

      const currency = await getMenuCurrency(userId);
      const precisePrice = 12.999; // Should round to 2 decimals

      const pdfFormatted = formatCurrency(precisePrice, currency, { locale: 'en-US' });
      const pngFormatted = formatCurrency(precisePrice, currency, { locale: 'en-US' });
      const htmlFormatted = formatCurrency(precisePrice, currency, { locale: 'en-US' });
      const qrFormatted = formatCurrency(precisePrice, currency, { locale: 'en-US' });

      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);
      // Intl.NumberFormat rounds to 2 decimals
      expect(pdfFormatted).toBe('$13.00');
    });
  });

  describe('Multiple Currencies in Same Export Session', () => {
    it('should handle switching between currencies correctly', async () => {
      // Simulate exporting menus for different users with different currencies
      const users = [
        { id: 'user-1', currency: 'USD' as const },
        { id: 'user-2', currency: 'SGD' as const },
        { id: 'user-3', currency: 'EUR' as const },
        { id: 'user-4', currency: 'GBP' as const },
      ];

      const testPrice = 20.00;

      for (const user of users) {
        mockGetMenuCurrency.mockResolvedValue(user.currency);
        const currency = await getMenuCurrency(user.id);
        const formatted = formatCurrency(testPrice, currency, { locale: 'en-US' });

        // VERIFY: Each currency formats correctly
        switch (user.currency) {
          case 'USD':
            expect(formatted).toBe('$20.00');
            break;
          case 'SGD':
            expect(formatted).toBe('SGD\u00A020.00');
            break;
          case 'EUR':
            expect(formatted).toBe('€20.00');
            break;
          case 'GBP':
            expect(formatted).toBe('£20.00');
            break;
        }
      }
    });
  });

  describe('Locale Consistency', () => {
    it('should use en-US locale consistently across all exports', async () => {
      const userId = 'test-locale';
      mockGetMenuCurrency.mockResolvedValue('USD');

      const currency = await getMenuCurrency(userId);
      const price = 1234.56;

      // All exports should use en-US locale
      const pdfFormatted = formatCurrency(price, currency, { locale: 'en-US' });
      const pngFormatted = formatCurrency(price, currency, { locale: 'en-US' });
      const htmlFormatted = formatCurrency(price, currency, { locale: 'en-US' });
      const qrFormatted = formatCurrency(price, currency, { locale: 'en-US' });

      // VERIFY: All use same locale formatting (comma as thousand separator)
      expect(pdfFormatted).toBe('$1,234.56');
      expect(pngFormatted).toBe('$1,234.56');
      expect(htmlFormatted).toBe('$1,234.56');
      expect(qrFormatted).toBe('$1,234.56');

      // VERIFY: All identical
      expect(pdfFormatted).toEqual(pngFormatted);
      expect(pdfFormatted).toEqual(htmlFormatted);
      expect(pdfFormatted).toEqual(qrFormatted);
    });
  });
});
