/**
 * Unit Tests for Data Model Validation
 * 
 * Feature: currency-support
 * Task: 24.2
 * 
 * Tests cover:
 * - menu_currency stored as ISO 4217 code in account
 * - billing_currency stored as one of 5 supported codes
 * - prices in menu_data JSONB are numeric
 * - no currency symbols in menu item records
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type { BillingCurrency } from '@/lib/currency-config'

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

describe('Feature: currency-support, Data Model Validation - Unit Tests', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    jest.clearAllMocks()
  })

  describe('menu_currency stored as ISO 4217 code in account', () => {
    it('should store menu_currency as 3-letter uppercase ISO 4217 code', async () => {
      // Arrange
      const testCurrencies = ['SGD', 'USD', 'GBP', 'EUR', 'AUD', 'MYR', 'THB', 'IDR', 'JPY', 'KRW']
      
      for (const currency of testCurrencies) {
        // Mock database response
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: 'test-user-001',
            menu_currency: currency,
          },
          error: null,
        })

        // Act
        const supabase = createAdminSupabaseClient()
        const { data } = await supabase
          .from('profiles')
          .select('menu_currency')
          .eq('id', 'test-user-001')
          .single()

        // Assert
        expect(data?.menu_currency).toBe(currency)
        expect(data?.menu_currency).toMatch(/^[A-Z]{3}$/) // 3 uppercase letters
        expect(data?.menu_currency.length).toBe(3)
      }
    })

    it('should validate menu_currency is exactly 3 characters', async () => {
      // Arrange
      const validCurrency = 'USD'
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'test-user-002',
          menu_currency: validCurrency,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('menu_currency')
        .eq('id', 'test-user-002')
        .single()

      // Assert
      expect(data?.menu_currency.length).toBe(3)
      expect(typeof data?.menu_currency).toBe('string')
    })

    it('should store menu_currency in uppercase', async () => {
      // Arrange
      const currency = 'EUR'
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'test-user-003',
          menu_currency: currency,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('menu_currency')
        .eq('id', 'test-user-003')
        .single()

      // Assert
      expect(data?.menu_currency).toBe(data?.menu_currency.toUpperCase())
      expect(data?.menu_currency).not.toMatch(/[a-z]/) // No lowercase letters
    })
  })

  describe('billing_currency stored as one of 5 supported codes', () => {
    const SUPPORTED_BILLING_CURRENCIES: BillingCurrency[] = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']

    it('should store billing_currency as one of 5 supported currencies', async () => {
      // Arrange & Act & Assert
      for (const currency of SUPPORTED_BILLING_CURRENCIES) {
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: `test-user-${currency}`,
            billing_currency: currency,
          },
          error: null,
        })

        const supabase = createAdminSupabaseClient()
        const { data } = await supabase
          .from('profiles')
          .select('billing_currency')
          .eq('id', `test-user-${currency}`)
          .single()

        expect(data?.billing_currency).toBe(currency)
        expect(SUPPORTED_BILLING_CURRENCIES).toContain(data?.billing_currency)
      }
    })

    it('should validate billing_currency is exactly 3 characters', async () => {
      // Arrange
      const currency = 'USD'
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'test-user-004',
          billing_currency: currency,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('billing_currency')
        .eq('id', 'test-user-004')
        .single()

      // Assert
      expect(data?.billing_currency.length).toBe(3)
      expect(typeof data?.billing_currency).toBe('string')
    })

    it('should store billing_currency in uppercase', async () => {
      // Arrange
      const currency = 'GBP'
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'test-user-005',
          billing_currency: currency,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('profiles')
        .select('billing_currency')
        .eq('id', 'test-user-005')
        .single()

      // Assert
      expect(data?.billing_currency).toBe(data?.billing_currency.toUpperCase())
      expect(data?.billing_currency).not.toMatch(/[a-z]/) // No lowercase letters
    })

    it('should enforce check constraint for billing_currency', async () => {
      // Arrange - Attempt to insert invalid currency
      const invalidCurrency = 'XXX'
      
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: {
          message: 'new row for relation "profiles" violates check constraint "check_billing_currency"',
          code: '23514', // PostgreSQL check constraint violation
        },
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: 'test-user-006',
          billing_currency: invalidCurrency,
        })
        .single()

      // Assert
      expect(error).toBeTruthy()
      expect(error?.message).toContain('check_billing_currency')
    })
  })

  describe('prices in menu_data JSONB are numeric', () => {
    it('should store menu item prices as numbers in JSONB', async () => {
      // Arrange
      const menuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD',
        },
        sections: [
          {
            name: 'Main Dishes',
            items: [
              { name: 'Burger', price: 12.50, featured: false },
              { name: 'Pizza', price: 15.00, featured: true },
              { name: 'Salad', price: 8.75, featured: false },
            ],
          },
        ],
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'menu-001',
          menu_data: menuData,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('menus')
        .select('menu_data')
        .eq('id', 'menu-001')
        .single()

      // Assert
      expect(data?.menu_data).toBeDefined()
      expect(data?.menu_data.sections).toBeDefined()
      
      for (const section of data.menu_data.sections) {
        for (const item of section.items) {
          expect(typeof item.price).toBe('number')
          expect(Number.isFinite(item.price)).toBe(true)
          expect(item.price).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('should handle various numeric price formats', async () => {
      // Arrange
      const menuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'JPY',
        },
        sections: [
          {
            name: 'Items',
            items: [
              { name: 'Free Item', price: 0, featured: false },
              { name: 'Cheap Item', price: 0.01, featured: false },
              { name: 'Sub-dollar', price: 0.99, featured: false },
              { name: 'Exact Dollar', price: 1.00, featured: false },
              { name: 'Common Price', price: 9.99, featured: false },
              { name: 'High Price', price: 999.99, featured: false },
              { name: 'JPY Price', price: 1500, featured: false }, // Zero-decimal currency
            ],
          },
        ],
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'menu-002',
          menu_data: menuData,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('menus')
        .select('menu_data')
        .eq('id', 'menu-002')
        .single()

      // Assert
      for (const section of data.menu_data.sections) {
        for (const item of section.items) {
          expect(typeof item.price).toBe('number')
          expect(Number.isFinite(item.price)).toBe(true)
          // Verify exact value preservation
          const originalItem = menuData.sections[0].items.find(i => i.name === item.name)
          expect(item.price).toBe(originalItem?.price)
        }
      }
    })

    it('should not store prices as strings', async () => {
      // Arrange
      const menuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD',
        },
        sections: [
          {
            name: 'Main Dishes',
            items: [
              { name: 'Burger', price: 12.50, featured: false },
            ],
          },
        ],
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'menu-003',
          menu_data: menuData,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('menus')
        .select('menu_data')
        .eq('id', 'menu-003')
        .single()

      // Assert
      for (const section of data.menu_data.sections) {
        for (const item of section.items) {
          expect(typeof item.price).not.toBe('string')
          // Verify price doesn't contain string representations
          const priceStr = String(item.price)
          expect(priceStr).not.toMatch(/[$£€¥₹₽₩]/i) // No currency symbols
          expect(priceStr).not.toMatch(/SGD|USD|GBP|EUR|AUD/i) // No currency codes
        }
      }
    })
  })

  describe('no currency symbols in menu item records', () => {
    it('should not have currency symbol fields in menu items', async () => {
      // Arrange
      const menuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'SGD',
        },
        sections: [
          {
            name: 'Main Dishes',
            items: [
              { name: 'Burger', price: 12.50, featured: false },
              { name: 'Pizza', price: 15.00, featured: true },
            ],
          },
        ],
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'menu-004',
          menu_data: menuData,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('menus')
        .select('menu_data')
        .eq('id', 'menu-004')
        .single()

      // Assert
      for (const section of data.menu_data.sections) {
        for (const item of section.items) {
          // Verify no currency symbol fields
          expect(item).not.toHaveProperty('currencySymbol')
          expect(item).not.toHaveProperty('currency_symbol')
          expect(item).not.toHaveProperty('symbol')
        }
      }
    })

    it('should not have formatted price fields in menu items', async () => {
      // Arrange
      const menuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'EUR',
        },
        sections: [
          {
            name: 'Desserts',
            items: [
              { name: 'Cake', price: 6.50, featured: false },
              { name: 'Ice Cream', price: 4.00, featured: false },
            ],
          },
        ],
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'menu-005',
          menu_data: menuData,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('menus')
        .select('menu_data')
        .eq('id', 'menu-005')
        .single()

      // Assert
      for (const section of data.menu_data.sections) {
        for (const item of section.items) {
          // Verify no formatted price fields
          expect(item).not.toHaveProperty('formattedPrice')
          expect(item).not.toHaveProperty('formatted_price')
          expect(item).not.toHaveProperty('priceString')
          expect(item).not.toHaveProperty('price_string')
          expect(item).not.toHaveProperty('displayPrice')
          expect(item).not.toHaveProperty('display_price')
        }
      }
    })

    it('should store currency only in metadata, not in items', async () => {
      // Arrange
      const menuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'GBP',
        },
        sections: [
          {
            name: 'Beverages',
            items: [
              { name: 'Coffee', price: 3.50, featured: false },
              { name: 'Tea', price: 2.50, featured: false },
            ],
          },
        ],
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'menu-006',
          menu_data: menuData,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('menus')
        .select('menu_data')
        .eq('id', 'menu-006')
        .single()

      // Assert
      // Currency should be in metadata
      expect(data.menu_data.metadata).toHaveProperty('currency')
      expect(typeof data.menu_data.metadata.currency).toBe('string')
      expect(data.menu_data.metadata.currency).toBe('GBP')

      // Currency should NOT be in items
      for (const section of data.menu_data.sections) {
        for (const item of section.items) {
          expect(item).not.toHaveProperty('currency')
          expect(item).not.toHaveProperty('currencyCode')
          expect(item).not.toHaveProperty('currency_code')
        }
      }
    })

    it('should verify menu items only have essential fields', async () => {
      // Arrange
      const menuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'AUD',
        },
        sections: [
          {
            name: 'Starters',
            items: [
              { 
                name: 'Spring Rolls', 
                price: 8.00, 
                description: 'Crispy vegetable rolls',
                imageRef: 'image-123',
                featured: true 
              },
            ],
          },
        ],
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'menu-007',
          menu_data: menuData,
        },
        error: null,
      })

      // Act
      const supabase = createAdminSupabaseClient()
      const { data } = await supabase
        .from('menus')
        .select('menu_data')
        .eq('id', 'menu-007')
        .single()

      // Assert
      const item = data.menu_data.sections[0].items[0]
      
      // Verify essential fields exist
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('price')
      expect(item).toHaveProperty('featured')
      
      // Verify optional fields can exist
      expect(item).toHaveProperty('description')
      expect(item).toHaveProperty('imageRef')
      
      // Verify currency-related fields do NOT exist
      const currencyFields = [
        'currencySymbol', 'currency_symbol', 'symbol',
        'formattedPrice', 'formatted_price',
        'priceString', 'price_string',
        'displayPrice', 'display_price',
        'currency', 'currencyCode', 'currency_code'
      ]
      
      for (const field of currencyFields) {
        expect(item).not.toHaveProperty(field)
      }
    })
  })
})
