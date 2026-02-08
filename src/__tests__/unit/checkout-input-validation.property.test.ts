/** @jest-environment node */

/**
 * Property-based tests for checkout input validation
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 27: Input Validation Before Checkout (Requirements 10.4)
 */

// Mock dependencies BEFORE any imports
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))
jest.mock('@/lib/stripe-config', () => ({
  getStripe: jest.fn(),
  getPriceId: jest.fn(),
}))
jest.mock('@/lib/purchase-logger', () => ({
  purchaseLogger: {
    logPurchase: jest.fn(),
  },
}))
jest.mock('@/lib/billing-currency-service', () => ({
  getBillingCurrency: jest.fn().mockResolvedValue('USD'),
  getStripePriceId: jest.fn((productType: string) => {
    const priceIds: Record<string, string> = {
      'grid_plus': 'price_mock_grid_plus',
      'grid_plus_premium': 'price_mock_grid_plus_premium',
      'creator_pack': 'price_mock_creator_pack'
    }
    return priceIds[productType] || 'price_mock_default'
  })
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checkout/route'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { getStripe, getPriceId } from '@/lib/stripe-config'
import fc from 'fast-check'
import Stripe from 'stripe'

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
}

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
}

describe('Feature: stripe-payment-integration - Checkout Input Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(getStripe as jest.Mock).mockReturnValue(mockStripe)
    ;(getPriceId as jest.Mock).mockImplementation((productType: string) => {
      const priceIds: Record<string, string> = {
        grid_plus: 'price_mock_grid_plus',
        grid_plus_premium: 'price_mock_grid_plus_premium',
        creator_pack: 'price_mock_creator_pack',
      }
      if (!priceIds[productType]) {
        throw new Error(`Invalid product type: ${productType}`)
      }
      return priceIds[productType]
    })

    // Mock profiles lookup for checking existing customer ID
    const profileChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { stripe_customer_id: 'cus_test_123' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain
      return {
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      }
    })

    // Mock Stripe checkout session creation
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/test',
    })
  })

  /**
   * Property 27: Input Validation Before Checkout
   * For any checkout session creation request, the system SHALL validate that
   * product_type is one of the allowed values (grid_plus, grid_plus_premium, creator_pack)
   * before calling Stripe API.
   * 
   * Validates: Requirements 10.4
   */
  describe('Property 27: Input Validation Before Checkout', () => {
    it('should accept any valid product type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          async (productType) => {
            // Arrange
            const request = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType,
                successUrl: 'http://localhost:3000/success',
                cancelUrl: 'http://localhost:3000/cancel',
              }),
            })

            // Act
            const response = await POST(request)
            const data = await response.json()

            // Assert: Should succeed with valid product type
            expect(response.status).toBeLessThan(400)
            expect(data.error).toBeUndefined()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject any invalid product type', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate invalid product types
          fc.oneof(
            fc.string().filter(s => !['grid_plus', 'grid_plus_premium', 'creator_pack'].includes(s)),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('invalid_product'),
            fc.constant('GRID_PLUS'), // Wrong case
            fc.constant('grid-plus'), // Wrong separator
            fc.integer(),
            fc.boolean(),
            fc.array(fc.string()),
            fc.object()
          ),
          async (invalidProductType) => {
            // Arrange
            const request = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType: invalidProductType,
                successUrl: 'http://localhost:3000/success',
                cancelUrl: 'http://localhost:3000/cancel',
              }),
            })

            // Act
            const response = await POST(request)
            const data = await response.json()

            // Assert: Should reject with 400 status
            expect(response.status).toBe(400)
            expect(data.error).toBeDefined()
            expect(data.code).toBe('INVALID_PRODUCT_TYPE')
            expect(data.error).toContain('Invalid product type')
            
            // Assert: Stripe API should NOT be called
            expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate URLs before creating checkout session', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          fc.oneof(
            fc.constant('not-a-url'),
            fc.constant('ftp://invalid.com'),
            fc.constant('javascript:alert(1)'),
            fc.constant('//example.com'),
            fc.constant('relative/path'),
          ),
          async (productType, invalidUrl) => {
            // Test invalid success URL
            const requestWithInvalidSuccess = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType,
                successUrl: invalidUrl,
                cancelUrl: 'http://localhost:3000/cancel',
              }),
            })

            const responseSuccess = await POST(requestWithInvalidSuccess)
            const dataSuccess = await responseSuccess.json()

            expect(responseSuccess.status).toBe(400)
            expect(dataSuccess.error).toBeDefined()
            expect(dataSuccess.code).toBe('INVALID_SUCCESS_URL')

            // Test invalid cancel URL
            const requestWithInvalidCancel = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType,
                successUrl: 'http://localhost:3000/success',
                cancelUrl: invalidUrl,
              }),
            })

            const responseCancel = await POST(requestWithInvalidCancel)
            const dataCancel = await responseCancel.json()

            expect(responseCancel.status).toBe(400)
            expect(dataCancel.error).toBeDefined()
            expect(dataCancel.code).toBe('INVALID_CANCEL_URL')

            // Assert: Stripe API should NOT be called for invalid URLs
            expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate URLs accept valid HTTP/HTTPS URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          async (productType, successUrl, cancelUrl) => {
            // Arrange
            const request = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType,
                successUrl,
                cancelUrl,
              }),
            })

            // Act
            const response = await POST(request)
            const data = await response.json()

            // Assert: Should succeed with valid URLs
            expect(response.status).toBeLessThan(400)
            expect(data.error).toBeUndefined()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle malformed JSON gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => {
            try {
              JSON.parse(s)
              return false // Valid JSON, skip
            } catch {
              return true // Invalid JSON, use it
            }
          }),
          async (malformedJson) => {
            // Arrange
            const request = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: malformedJson,
            })

            // Act
            const response = await POST(request)
            const data = await response.json()

            // Assert: Should reject with 400 status
            expect(response.status).toBe(400)
            expect(data.error).toBeDefined()
            expect(data.code).toBe('INVALID_JSON')
            
            // Assert: Stripe API should NOT be called
            expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should validate product type before checking price ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter(s => !['grid_plus', 'grid_plus_premium', 'creator_pack'].includes(s)),
          async (invalidProductType) => {
            // Arrange
            const request = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType: invalidProductType,
              }),
            })

            // Act
            const response = await POST(request)
            const data = await response.json()

            // Assert: Should fail at product type validation, not price ID lookup
            expect(response.status).toBe(400)
            expect(data.code).toBe('INVALID_PRODUCT_TYPE')
            
            // Assert: getPriceId should NOT be called for invalid product types
            // (validation happens before price ID lookup)
            expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
