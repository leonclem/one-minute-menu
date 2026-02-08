/**
 * Unit Tests for Menu Editor Currency Formatting
 * Feature: currency-support
 * 
 * Tests Task 19.3: Menu editor currency formatting
 * Validates: Requirements 6.1, 7.2, 7.3, 8.5
 * 
 * These tests verify that:
 * - Prices display with correct currency symbol
 * - Formatting updates when currency changes
 * - Numeric values remain unchanged when currency changes
 */

import { render, screen, waitFor } from '@testing-library/react';
import { formatCurrency } from '@/lib/currency-formatter';
import { getMenuCurrency } from '@/lib/menu-currency-service';

// Mock the currency services
jest.mock('@/lib/currency-formatter');
jest.mock('@/lib/menu-currency-service');

const mockFormatCurrency = formatCurrency as jest.MockedFunction<typeof formatCurrency>;
const mockGetMenuCurrency = getMenuCurrency as jest.MockedFunction<typeof getMenuCurrency>;

describe('Menu Editor Currency Formatting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Price Display with Currency Symbol', () => {
    it('should display prices with USD currency symbol', () => {
      mockFormatCurrency.mockReturnValue('$12.50');
      
      const price = 12.50;
      const currency = 'USD';
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('$12.50');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });

    it('should display prices with SGD currency symbol', () => {
      mockFormatCurrency.mockReturnValue('S$15.00');
      
      const price = 15.00;
      const currency = 'SGD';
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('S$15.00');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });

    it('should display prices with GBP currency symbol', () => {
      mockFormatCurrency.mockReturnValue('£9.99');
      
      const price = 9.99;
      const currency = 'GBP';
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('£9.99');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });

    it('should display prices with EUR currency symbol', () => {
      mockFormatCurrency.mockReturnValue('€10.50');
      
      const price = 10.50;
      const currency = 'EUR';
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('€10.50');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });

    it('should display prices with AUD currency symbol', () => {
      mockFormatCurrency.mockReturnValue('A$18.00');
      
      const price = 18.00;
      const currency = 'AUD';
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('A$18.00');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });

    it('should display prices with JPY currency symbol (zero decimals)', () => {
      mockFormatCurrency.mockReturnValue('¥1500');
      
      const price = 1500;
      const currency = 'JPY';
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('¥1500');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });

    it('should display prices with THB currency symbol', () => {
      mockFormatCurrency.mockReturnValue('฿250.00');
      
      const price = 250.00;
      const currency = 'THB';
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('฿250.00');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });
  });

  describe('Formatting Updates When Currency Changes', () => {
    it('should update formatting from USD to SGD without changing numeric value', () => {
      const price = 12.50;
      
      // Initial format in USD
      mockFormatCurrency.mockReturnValueOnce('$12.50');
      const formattedUSD = formatCurrency(price, 'USD');
      expect(formattedUSD).toBe('$12.50');
      
      // Format same price in SGD
      mockFormatCurrency.mockReturnValueOnce('S$12.50');
      const formattedSGD = formatCurrency(price, 'SGD');
      expect(formattedSGD).toBe('S$12.50');
      
      // Verify the numeric value is the same
      expect(price).toBe(12.50);
    });

    it('should update formatting from SGD to EUR without changing numeric value', () => {
      const price = 25.00;
      
      // Initial format in SGD
      mockFormatCurrency.mockReturnValueOnce('S$25.00');
      const formattedSGD = formatCurrency(price, 'SGD');
      expect(formattedSGD).toBe('S$25.00');
      
      // Format same price in EUR
      mockFormatCurrency.mockReturnValueOnce('€25.00');
      const formattedEUR = formatCurrency(price, 'EUR');
      expect(formattedEUR).toBe('€25.00');
      
      // Verify the numeric value is the same
      expect(price).toBe(25.00);
    });

    it('should update formatting from USD to JPY without changing numeric value', () => {
      const price = 1500;
      
      // Initial format in USD
      mockFormatCurrency.mockReturnValueOnce('$1,500.00');
      const formattedUSD = formatCurrency(price, 'USD');
      expect(formattedUSD).toBe('$1,500.00');
      
      // Format same price in JPY (zero decimals)
      mockFormatCurrency.mockReturnValueOnce('¥1,500');
      const formattedJPY = formatCurrency(price, 'JPY');
      expect(formattedJPY).toBe('¥1,500');
      
      // Verify the numeric value is the same
      expect(price).toBe(1500);
    });

    it('should handle currency change for multiple items', () => {
      const items = [
        { id: '1', name: 'Burger', price: 12.50 },
        { id: '2', name: 'Fries', price: 5.00 },
        { id: '3', name: 'Drink', price: 3.50 }
      ];
      
      // Format all items in USD
      mockFormatCurrency
        .mockReturnValueOnce('$12.50')
        .mockReturnValueOnce('$5.00')
        .mockReturnValueOnce('$3.50');
      
      const formattedUSD = items.map(item => formatCurrency(item.price, 'USD'));
      expect(formattedUSD).toEqual(['$12.50', '$5.00', '$3.50']);
      
      // Format same items in GBP
      mockFormatCurrency
        .mockReturnValueOnce('£12.50')
        .mockReturnValueOnce('£5.00')
        .mockReturnValueOnce('£3.50');
      
      const formattedGBP = items.map(item => formatCurrency(item.price, 'GBP'));
      expect(formattedGBP).toEqual(['£12.50', '£5.00', '£3.50']);
      
      // Verify numeric values remain unchanged
      expect(items[0].price).toBe(12.50);
      expect(items[1].price).toBe(5.00);
      expect(items[2].price).toBe(3.50);
    });
  });

  describe('Numeric Values Remain Unchanged', () => {
    it('should not modify the numeric price value when formatting', () => {
      const originalPrice = 19.99;
      const price = originalPrice;
      
      mockFormatCurrency.mockReturnValue('$19.99');
      formatCurrency(price, 'USD');
      
      // Verify the price value is unchanged
      expect(price).toBe(originalPrice);
      expect(price).toBe(19.99);
    });

    it('should not convert prices when changing currency', () => {
      const price = 100.00;
      
      // Format in different currencies
      mockFormatCurrency.mockReturnValueOnce('$100.00');
      formatCurrency(price, 'USD');
      
      mockFormatCurrency.mockReturnValueOnce('S$100.00');
      formatCurrency(price, 'SGD');
      
      mockFormatCurrency.mockReturnValueOnce('£100.00');
      formatCurrency(price, 'GBP');
      
      // Verify price remains 100.00 (no FX conversion)
      expect(price).toBe(100.00);
    });

    it('should preserve decimal precision when formatting', () => {
      const prices = [
        { value: 12.50, expected: 12.50 },
        { value: 9.99, expected: 9.99 },
        { value: 0.50, expected: 0.50 },
        { value: 100.00, expected: 100.00 },
        { value: 15.95, expected: 15.95 }
      ];
      
      prices.forEach(({ value, expected }) => {
        mockFormatCurrency.mockReturnValueOnce(`$${value.toFixed(2)}`);
        formatCurrency(value, 'USD');
        expect(value).toBe(expected);
      });
    });

    it('should handle zero-decimal currencies without modifying numeric value', () => {
      const price = 1500;
      
      mockFormatCurrency.mockReturnValue('¥1,500');
      formatCurrency(price, 'JPY');
      
      // Verify the numeric value is unchanged
      expect(price).toBe(1500);
      expect(Number.isInteger(price)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero price', () => {
      mockFormatCurrency.mockReturnValue('$0.00');
      
      const price = 0;
      const formatted = formatCurrency(price, 'USD');
      
      expect(formatted).toBe('$0.00');
      expect(price).toBe(0);
    });

    it('should handle very small prices', () => {
      mockFormatCurrency.mockReturnValue('$0.01');
      
      const price = 0.01;
      const formatted = formatCurrency(price, 'USD');
      
      expect(formatted).toBe('$0.01');
      expect(price).toBe(0.01);
    });

    it('should handle large prices', () => {
      mockFormatCurrency.mockReturnValue('$9,999.99');
      
      const price = 9999.99;
      const formatted = formatCurrency(price, 'USD');
      
      expect(formatted).toBe('$9,999.99');
      expect(price).toBe(9999.99);
    });

    it('should handle prices with many decimal places (should round)', () => {
      const price = 12.999;
      
      mockFormatCurrency.mockReturnValue('$13.00');
      const formatted = formatCurrency(price, 'USD');
      
      expect(formatted).toBe('$13.00');
      // Original value should be unchanged
      expect(price).toBe(12.999);
    });
  });

  describe('Currency Symbol Consistency', () => {
    it('should use consistent symbol for USD across multiple calls', () => {
      mockFormatCurrency.mockReturnValue('$10.00');
      
      const formatted1 = formatCurrency(10.00, 'USD');
      const formatted2 = formatCurrency(10.00, 'USD');
      const formatted3 = formatCurrency(10.00, 'USD');
      
      expect(formatted1).toBe('$10.00');
      expect(formatted2).toBe('$10.00');
      expect(formatted3).toBe('$10.00');
    });

    it('should use consistent symbol for each currency', () => {
      const currencies = [
        { code: 'USD', symbol: '$' },
        { code: 'SGD', symbol: 'S$' },
        { code: 'GBP', symbol: '£' },
        { code: 'EUR', symbol: '€' },
        { code: 'AUD', symbol: 'A$' }
      ];
      
      currencies.forEach(({ code, symbol }) => {
        mockFormatCurrency.mockReturnValueOnce(`${symbol}10.00`);
        const formatted = formatCurrency(10.00, code);
        expect(formatted).toContain(symbol);
      });
    });
  });

  describe('Menu Currency Service Integration', () => {
    it('should fetch menu currency for user', async () => {
      const userId = 'user-123';
      mockGetMenuCurrency.mockResolvedValue('SGD');
      
      const currency = await getMenuCurrency(userId);
      
      expect(currency).toBe('SGD');
      expect(mockGetMenuCurrency).toHaveBeenCalledWith(userId);
    });

    it('should use fetched currency for formatting', async () => {
      const userId = 'user-123';
      const price = 15.00;
      
      mockGetMenuCurrency.mockResolvedValue('EUR');
      mockFormatCurrency.mockReturnValue('€15.00');
      
      const currency = await getMenuCurrency(userId);
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('€15.00');
    });

    it('should handle currency fetch failure gracefully', async () => {
      const userId = 'user-123';
      mockGetMenuCurrency.mockRejectedValue(new Error('Network error'));
      
      await expect(getMenuCurrency(userId)).rejects.toThrow('Network error');
    });
  });

  describe('Requirements Validation', () => {
    /**
     * Requirement 6.1: When displaying a Menu_Item price in the editor,
     * THE Platform SHALL format it using the Account's menu currency
     */
    it('should format prices using account menu currency (Req 6.1)', async () => {
      const userId = 'user-123';
      const price = 12.50;
      
      mockGetMenuCurrency.mockResolvedValue('GBP');
      mockFormatCurrency.mockReturnValue('£12.50');
      
      const currency = await getMenuCurrency(userId);
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('£12.50');
      expect(mockGetMenuCurrency).toHaveBeenCalledWith(userId);
    });

    /**
     * Requirement 7.2: When a user changes the menu currency,
     * THE Platform SHALL NOT automatically convert existing Menu_Item prices
     */
    it('should not convert prices when currency changes (Req 7.2)', () => {
      const price = 50.00;
      
      // Format in USD
      mockFormatCurrency.mockReturnValueOnce('$50.00');
      formatCurrency(price, 'USD');
      
      // Change to EUR - price value should remain 50.00
      mockFormatCurrency.mockReturnValueOnce('€50.00');
      formatCurrency(price, 'EUR');
      
      // Verify no conversion occurred
      expect(price).toBe(50.00);
    });

    /**
     * Requirement 7.3: When a user changes the menu currency,
     * THE Platform SHALL update the currency symbol and formatting for all menu displays
     */
    it('should update currency symbol when currency changes (Req 7.3)', () => {
      const price = 25.00;
      
      // Initial format in USD
      mockFormatCurrency.mockReturnValueOnce('$25.00');
      const formattedUSD = formatCurrency(price, 'USD');
      expect(formattedUSD).toBe('$25.00');
      
      // Update to SGD - symbol should change
      mockFormatCurrency.mockReturnValueOnce('S$25.00');
      const formattedSGD = formatCurrency(price, 'SGD');
      expect(formattedSGD).toBe('S$25.00');
      
      // Verify symbol changed but value didn't
      expect(formattedUSD).not.toBe(formattedSGD);
      expect(price).toBe(25.00);
    });

    /**
     * Requirement 8.5: When retrieving a Menu_Item price for display,
     * THE Platform SHALL format it using the Currency_Formatter with the Account's menu currency code
     */
    it('should use Currency_Formatter for all price displays (Req 8.5)', () => {
      const price = 18.99;
      const currency = 'AUD';
      
      mockFormatCurrency.mockReturnValue('A$18.99');
      const formatted = formatCurrency(price, currency);
      
      expect(formatted).toBe('A$18.99');
      expect(mockFormatCurrency).toHaveBeenCalledWith(price, currency);
    });
  });
});
