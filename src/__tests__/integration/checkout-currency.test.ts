/** @jest-environment node */

/**
 * Integration Tests: Checkout Flow with Billing Currency
 * 
 * Tests the complete checkout flow with multi-currency support.
 * Validates Requirements 2.3, 3.1, 3.2, 3.3
 * 
 * Test Coverage:
 * - Checkout uses correct Price ID for each currency
 * - Checkout summary displays correct currency
 * - Subscription metadata includes billing currency
 * - Checkout with all 5 billing currencies
 */

// Mock dependencies BEFORE any imports
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))
jest.mock('@/lib/stripe-config', () => ({
  getStripe: jest.fn(),
  getStripePriceId: jest.fn()
}))
jest.mock('@/lib/billing-currency-service', () => ({
  getBillingCurrency: jest.fn(),
  setBillingCurrency: jest.fn(),
  getStripePriceId: jest.fn()
}))
jest.mock('@/lib/purchase-logger', () => ({
  purchaseLogger: {
    logPurchase: jest.fn()
  }
}))
jest.mock('@/lib/stripe-rate-limiter', () => ({
  checkoutRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }))
  }
}))

import { POST } from '@/app/api/checkout/route'
import { NextRequest } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe-config'
import type { BillingCurrency } from '@/lib/currency-config'
import { getBillingCurrency, setBillingCurrency, getStripePriceId } from '@/lib/billing-currency-service'

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const mockCreateAdminSupabaseClient = createAdminSupabaseClient as jest.MockedFunction<typeof createAdminSupabaseClient>
const mockGetStripe = getStripe as jest.MockedFunction<typeof getStripe>
const mockGetStripePriceId = getStripePriceId as jest.MockedFunction<typeof getStripePriceId>
const mockGetBillingCurrency = getBillingCurrency as jest.MockedFunction<typeof getBillingCurrency>
const mockSetBillingCurrency = setBillingCurrency as jest.MockedFunction<typeof setBillingCurrency>

describe('Checkout Flow with Billing Currency', () => {
  let mockStripe: any
  let mockSupabaseClient: any
  let mockAdminSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Stripe
    mockStripe = {
      checkout: {
        sessions: {
          create: jest.fn()
        }
      }
    }
    mockGetStripe.mockReturnValue(mockStripe)

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn()
      }
    }
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabaseClient)

    // Mock Admin Supabase with proper chaining
    const createChainableMock = () => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
        gt: jest.fn(() => chain),
        insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }
      return chain
    }

    mockAdminSupabase = {
      from: jest.fn(() => createChainableMock())
    }
    mockCreateAdminSupabaseClient.mockReturnValue(mockAdminSupabase)
  })

  /**
   * Test: Checkout uses correct Price ID for each currency
   * Validates: Requirements 3.1, 3.2
   */
  describe('Price ID Selection', () => {
    const currencies: BillingCurrency[] = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']
    // Only test subscription products to avoid creator_pack free trial logic
    const productTypes = ['grid_plus', 'grid_plus_premium'] as const

    currencies.forEach(currency => {
      productTypes.forEach(productType => {
        it(`should use correct Price ID for ${productType} with ${currency}`, async () => {
          // Arrange
          const userId = 'user-123'
          const expectedPriceId = `price_${productType}_${currency.toLowerCase()}`

          mockSupabaseClient.auth.getUser.mockResolvedValue({
            data: { user: { id: userId, email: 'test@example.com' } }
          })

          mockGetBillingCurrency.mockResolvedValue(currency)
          mockGetStripePriceId.mockReturnValue(expectedPriceId)

          mockStripe.checkout.sessions.create.mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/test'
          })

          const request = new NextRequest('http://localhost:3000/api/checkout', {
            method: 'POST',
            body: JSON.stringify({
              productType,
              successUrl: 'http://localhost:3000/success',
              cancelUrl: 'http://localhost:3000/cancel'
            })
          })

          // Act
          const response = await POST(request)
          const data = await response.json()

          // Assert
          expect(response.status).toBe(200)
          expect(mockGetBillingCurrency).toHaveBeenCalledWith(userId)
          expect(mockGetStripePriceId).toHaveBeenCalledWith(productType, currency)
          expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
              line_items: [
                {
                  price: expectedPriceId,
                  quantity: 1
                }
              ]
            })
          )
        })
      })
    })
  })

  /**
   * Test: Subscription metadata includes billing currency
   * Validates: Requirement 3.3
   */
  describe('Subscription Metadata', () => {
    it('should include billing currency in subscription metadata', async () => {
      // Arrange
      const userId = 'user-456'
      const billingCurrency: BillingCurrency = 'GBP'

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: 'test@example.com' } }
      })

      mockGetBillingCurrency.mockResolvedValue(billingCurrency)
      mockGetStripePriceId.mockReturnValue('price_grid_plus_gbp')

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/test'
      })

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel'
        })
      })

      // Act
      await POST(request)

      // Assert
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            billing_currency: billingCurrency,
            product_type: 'grid_plus',
            user_id: userId
          })
        })
      )
    })

    it('should include billing currency for all 5 supported currencies', async () => {
      const currencies: BillingCurrency[] = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']

      for (const currency of currencies) {
        jest.clearAllMocks()

        const userId = `user-${currency}`

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: userId, email: 'test@example.com' } }
        })

        mockGetBillingCurrency.mockResolvedValue(currency)
        mockGetStripePriceId.mockReturnValue(`price_grid_plus_${currency.toLowerCase()}`)

        mockStripe.checkout.sessions.create.mockResolvedValue({
          id: `cs_test_${currency}`,
          url: 'https://checkout.stripe.com/test'
        })

        const request = new NextRequest('http://localhost:3000/api/checkout', {
          method: 'POST',
          body: JSON.stringify({
            productType: 'grid_plus',
            successUrl: 'http://localhost:3000/success',
            cancelUrl: 'http://localhost:3000/cancel'
          })
        })

        await POST(request)

        expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              billing_currency: currency
            })
          })
        )
      }
    })
  })

  /**
   * Test: Anonymous user checkout with billing currency
   * Validates: Requirements 2.3, 3.1
   */
  describe('Anonymous User Checkout', () => {
    it('should use billing currency from localStorage for anonymous users', async () => {
      // Arrange
      const billingCurrency: BillingCurrency = 'AUD'

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      mockGetBillingCurrency.mockResolvedValue(billingCurrency)
      mockGetStripePriceId.mockReturnValue('price_grid_plus_aud')

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_anon',
        url: 'https://checkout.stripe.com/test'
      })

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel'
        })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGetBillingCurrency).toHaveBeenCalledWith(undefined)
      expect(mockGetStripePriceId).toHaveBeenCalledWith('grid_plus', billingCurrency)
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: 'price_grid_plus_aud',
              quantity: 1
            }
          ],
          metadata: expect.objectContaining({
            billing_currency: billingCurrency,
            product_type: 'grid_plus'
          })
        })
      )
    })
  })

  /**
   * Test: Checkout session mode based on product type
   * Validates: Requirement 2.3
   */
  describe('Session Mode', () => {
    it('should use subscription mode for grid_plus', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } }
      })

      mockGetBillingCurrency.mockResolvedValue('USD')
      mockGetStripePriceId.mockReturnValue('price_grid_plus_usd')

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_sub',
        url: 'https://checkout.stripe.com/test'
      })

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel'
        })
      })

      // Act
      await POST(request)

      // Assert
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription'
        })
      )
    })

    it('should use subscription mode for grid_plus_premium', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-2', email: 'test@example.com' } }
      })

      mockGetBillingCurrency.mockResolvedValue('SGD')
      mockGetStripePriceId.mockReturnValue('price_grid_plus_premium_sgd')

      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_premium',
        url: 'https://checkout.stripe.com/test'
      })

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus_premium',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel'
        })
      })

      // Act
      await POST(request)

      // Assert
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription'
        })
      )
    })
  })

  /**
   * Test: Error handling for invalid currency configuration
   * Validates: Requirement 3.1
   */
  describe('Error Handling', () => {
    it('should return error if Price ID is not configured for currency', async () => {
      // Arrange
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-error', email: 'test@example.com' } }
      })

      mockGetBillingCurrency.mockResolvedValue('USD')
      mockGetStripePriceId.mockImplementation(() => {
        throw new Error('Price ID not configured for product grid_plus and currency USD')
      })

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus',
          successUrl: 'http://localhost:3000/success',
          cancelUrl: 'http://localhost:3000/cancel'
        })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.code).toBe('INVALID_PRODUCT_CONFIG')
      expect(data.error).toBe('Product configuration error')
      expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
    })
  })
})
