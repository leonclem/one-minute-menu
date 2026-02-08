/**
 * Unit Tests for Menu Preview Page
 * 
 * Feature: currency-support
 * Task: 20.2 Write unit tests for menu preview
 * 
 * These tests verify that the menu preview correctly:
 * 1. Uses account menu currency
 * 2. Formatting matches editor
 * 3. Various currencies display correctly
 * 
 * Requirements: 6.2, 10.5
 */

import { render, screen } from '@testing-library/react'
import PublicMenuPage from '../page'
import { menuOperations } from '@/lib/database'
import { getMenuCurrency } from '@/lib/menu-currency-service'
import { formatCurrency } from '@/lib/currency-formatter'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Mock dependencies
jest.mock('@/lib/database')
jest.mock('@/lib/menu-currency-service')
jest.mock('@/lib/currency-formatter')
jest.mock('@/lib/supabase-server')
jest.mock('@/components/PublicMenuImage', () => {
  return function MockPublicMenuImage({ url, alt }: { url: string; alt: string }) {
    return <img src={url} alt={alt} data-testid="menu-item-image" />
  }
})
jest.mock('@/components/CopyOrderNote', () => {
  return function MockCopyOrderNote() {
    return <div data-testid="copy-order-note">Copy Order Note</div>
  }
})
jest.mock('@/components/MenuViewTracker', () => {
  return function MockMenuViewTracker() {
    return null
  }
})

const mockedMenuOperations = menuOperations as jest.Mocked<typeof menuOperations>
const mockedGetMenuCurrency = getMenuCurrency as jest.MockedFunction<typeof getMenuCurrency>
const mockedFormatCurrency = formatCurrency as jest.MockedFunction<typeof formatCurrency>
const mockedCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>

// Sample menu data for testing
const createMockMenu = (overrides = {}) => ({
  id: 'menu-001',
  userId: 'user-001',
  slug: 'test-menu',
  name: 'Test Restaurant Menu',
  items: [
    {
      id: 'item-001',
      name: 'Burger',
      description: 'Delicious beef burger',
      price: 12.50,
      available: true,
      imageSource: 'ai' as const,
      customImageUrl: 'https://example.com/burger.jpg',
    },
    {
      id: 'item-002',
      name: 'Sushi Roll',
      description: 'Fresh salmon sushi',
      price: 1500,
      available: true,
      imageSource: 'ai' as const,
      customImageUrl: 'https://example.com/sushi.jpg',
    },
    {
      id: 'item-003',
      name: 'Coffee',
      description: 'Hot brewed coffee',
      price: 4.00,
      available: true,
      imageSource: 'none' as const,
    },
    {
      id: 'item-004',
      name: 'Salad',
      description: 'Fresh garden salad',
      price: 8.75,
      available: false,
      imageSource: 'none' as const,
    },
  ],
  theme: {
    colors: {
      primary: '#3B82F6',
      secondary: '#6B7280',
      background: '#FFFFFF',
      text: '#111827',
    },
  },
  paymentInfo: null,
  updatedAt: new Date('2024-01-15'),
  ...overrides,
})

describe('Menu Preview Page - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    mockedCreateServerSupabaseClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(null)
    mockedMenuOperations.getDraftByUserAndSlug.mockResolvedValue(null)
    mockedGetMenuCurrency.mockResolvedValue('USD')
    
    // Mock formatCurrency to return a predictable format
    mockedFormatCurrency.mockImplementation((amount, currency) => {
      const symbols: Record<string, string> = {
        USD: '$',
        SGD: 'S$',
        GBP: '£',
        EUR: '€',
        AUD: 'A$',
        JPY: '¥',
        THB: '฿',
      }
      const symbol = symbols[currency] || '$'
      
      // Handle zero-decimal currencies
      if (currency === 'JPY' || currency === 'KRW') {
        return `${symbol}${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      }
      
      return `${symbol}${amount.toFixed(2)}`
    })
  })

  describe('Preview uses account menu currency', () => {
    it('should fetch menu currency for the user', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('SGD')

      await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      expect(mockedGetMenuCurrency).toHaveBeenCalledWith('user-001')
    })

    it('should use account menu currency for all price formatting', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('SGD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      // Render the result
      render(result as any)

      // Verify formatCurrency was called with SGD for each item
      expect(mockedFormatCurrency).toHaveBeenCalledWith(12.50, 'SGD')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(1500, 'SGD')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(4.00, 'SGD')
    })

    it('should display formatted prices with correct currency', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('USD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // Verify formatted prices are displayed
      expect(screen.getByText('$12.50')).toBeInTheDocument()
      expect(screen.getByText('$1500.00')).toBeInTheDocument()
      expect(screen.getByText('$4.00')).toBeInTheDocument()
    })

    it('should use different currency when account setting changes', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('GBP')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // Verify formatCurrency was called with GBP
      expect(mockedFormatCurrency).toHaveBeenCalledWith(12.50, 'GBP')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(1500, 'GBP')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(4.00, 'GBP')

      // Verify GBP formatted prices are displayed
      expect(screen.getByText('£12.50')).toBeInTheDocument()
      expect(screen.getByText('£1500.00')).toBeInTheDocument()
      expect(screen.getByText('£4.00')).toBeInTheDocument()
    })
  })

  describe('Formatting matches editor', () => {
    it('should use the same formatCurrency function as editor', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('EUR')

      await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      // Verify formatCurrency from currency-formatter is used
      // This ensures consistency with editor which also uses formatCurrency
      expect(mockedFormatCurrency).toHaveBeenCalled()
      expect(mockedFormatCurrency.mock.calls.every(call => call[1] === 'EUR')).toBe(true)
    })

    it('should format prices consistently for the same currency', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('AUD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // All prices should use the same currency format
      const prices = ['A$12.50', 'A$1500.00', 'A$4.00']
      prices.forEach(price => {
        expect(screen.getByText(price)).toBeInTheDocument()
      })
    })

    it('should handle decimal precision consistently', async () => {
      const menu = createMockMenu({
        items: [
          {
            id: 'item-001',
            name: 'Item with cents',
            price: 10.99,
            available: true,
            imageSource: 'none' as const,
          },
          {
            id: 'item-002',
            name: 'Item whole number',
            price: 15.00,
            available: true,
            imageSource: 'none' as const,
          },
        ],
      })
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('USD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // Both should show 2 decimal places
      expect(screen.getByText('$10.99')).toBeInTheDocument()
      expect(screen.getByText('$15.00')).toBeInTheDocument()
    })
  })

  describe('Various currencies display correctly', () => {
    it('should display SGD currency correctly', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('SGD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      expect(screen.getByText('S$12.50')).toBeInTheDocument()
      expect(screen.getByText('S$1500.00')).toBeInTheDocument()
      expect(screen.getByText('S$4.00')).toBeInTheDocument()
    })

    it('should display EUR currency correctly', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('EUR')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      expect(screen.getByText('€12.50')).toBeInTheDocument()
      expect(screen.getByText('€1500.00')).toBeInTheDocument()
      expect(screen.getByText('€4.00')).toBeInTheDocument()
    })

    it('should display JPY currency correctly (zero decimals)', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('JPY')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // JPY should have no decimal places
      expect(screen.getByText('¥13')).toBeInTheDocument() // 12.50 rounded
      expect(screen.getByText('¥1,500')).toBeInTheDocument()
      expect(screen.getByText('¥4')).toBeInTheDocument()
    })

    it('should display THB currency correctly', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('THB')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      expect(screen.getByText('฿12.50')).toBeInTheDocument()
      expect(screen.getByText('฿1500.00')).toBeInTheDocument()
      expect(screen.getByText('฿4.00')).toBeInTheDocument()
    })

    it('should handle currency changes without affecting numeric values', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)

      // First render with USD
      mockedGetMenuCurrency.mockResolvedValue('USD')
      const result1 = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })
      const { unmount } = render(result1 as any)

      // Verify USD prices
      expect(mockedFormatCurrency).toHaveBeenCalledWith(12.50, 'USD')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(1500, 'USD')

      unmount()
      jest.clearAllMocks()

      // Re-render with EUR
      mockedGetMenuCurrency.mockResolvedValue('EUR')
      const result2 = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })
      render(result2 as any)

      // Verify same numeric values are passed, just different currency
      expect(mockedFormatCurrency).toHaveBeenCalledWith(12.50, 'EUR')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(1500, 'EUR')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle menu not found', async () => {
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(null)
      mockedMenuOperations.getDraftByUserAndSlug.mockResolvedValue(null)

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'nonexistent' },
        searchParams: {},
      })

      render(result as any)

      expect(screen.getByText('Menu not found')).toBeInTheDocument()
      expect(mockedGetMenuCurrency).not.toHaveBeenCalled()
    })

    it('should handle items without prices', async () => {
      const menu = createMockMenu({
        items: [
          {
            id: 'item-001',
            name: 'Free Item',
            price: 0,
            available: true,
            imageSource: 'none' as const,
          },
        ],
      })
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('USD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      expect(mockedFormatCurrency).toHaveBeenCalledWith(0, 'USD')
      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('should only format prices for available items in main section', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('USD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // Available items should have formatted prices
      expect(screen.getByText('$12.50')).toBeInTheDocument()
      expect(screen.getByText('$1500.00')).toBeInTheDocument()
      expect(screen.getByText('$4.00')).toBeInTheDocument()

      // Unavailable item (Salad) should not show price in main section
      // It appears in unavailable section with "Out of stock" label
      const unavailableSection = screen.getByLabelText(/currently unavailable/i)
      expect(unavailableSection).toBeInTheDocument()
    })

    it('should handle preview mode for owner', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getDraftByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('USD')

      // Mock authenticated user
      mockedCreateServerSupabaseClient.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-001' } },
          }),
        },
      } as any)

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: { preview: '1' },
      })

      render(result as any)

      // Should show preview banner
      expect(screen.getByText(/preview — not live/i)).toBeInTheDocument()

      // Should still format prices correctly
      expect(mockedFormatCurrency).toHaveBeenCalledWith(12.50, 'USD')
    })

    it('should display menu metadata correctly', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('USD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // Verify menu name is displayed
      expect(screen.getByText('Test Restaurant Menu')).toBeInTheDocument()

      // Verify item names and descriptions
      expect(screen.getByText('Burger')).toBeInTheDocument()
      expect(screen.getByText('Delicious beef burger')).toBeInTheDocument()
      expect(screen.getByText('Sushi Roll')).toBeInTheDocument()
      expect(screen.getByText('Fresh salmon sushi')).toBeInTheDocument()
    })

    it('should handle payment information display', async () => {
      const menu = createMockMenu({
        paymentInfo: {
          payNowQR: 'https://example.com/qr.png',
          instructions: 'Scan QR code to pay',
          alternativePayments: ['Cash', 'Card'],
          disclaimer: 'Payment processed by bank',
        },
      })
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('USD')

      const result = await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      render(result as any)

      // Verify payment section is displayed
      expect(screen.getByText('Payment')).toBeInTheDocument()
      expect(screen.getByText('Scan QR code to pay')).toBeInTheDocument()
      expect(screen.getByText('Cash')).toBeInTheDocument()
      expect(screen.getByText('Card')).toBeInTheDocument()
      expect(screen.getByText('Payment processed by bank')).toBeInTheDocument()
    })
  })

  describe('Integration with Currency Formatter', () => {
    it('should pass correct parameters to formatCurrency', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('SGD')

      await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      // Verify formatCurrency is called with correct parameters
      // (amount: number, currencyCode: string)
      expect(mockedFormatCurrency).toHaveBeenCalledWith(12.50, 'SGD')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(1500, 'SGD')
      expect(mockedFormatCurrency).toHaveBeenCalledWith(4.00, 'SGD')

      // Verify no additional options are passed (uses defaults)
      mockedFormatCurrency.mock.calls.forEach(call => {
        expect(call.length).toBe(2) // Only amount and currency
      })
    })

    it('should use formatCurrency for all price displays', async () => {
      const menu = createMockMenu()
      mockedMenuOperations.getLatestPublishedSnapshotByUserAndSlug.mockResolvedValue(menu as any)
      mockedGetMenuCurrency.mockResolvedValue('EUR')

      await PublicMenuPage({
        params: { userId: 'user-001', slug: 'test-menu' },
        searchParams: {},
      })

      // Count how many times formatCurrency was called
      // Should be called once for each available item (3 items)
      expect(mockedFormatCurrency).toHaveBeenCalledTimes(3)

      // All calls should use EUR
      mockedFormatCurrency.mock.calls.forEach(call => {
        expect(call[1]).toBe('EUR')
      })
    })
  })
})
