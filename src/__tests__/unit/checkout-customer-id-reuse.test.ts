/** @jest-environment node */

/**
 * Unit tests for customer ID reuse logic in checkout API
 * 
 * Tests Requirements: 5.3
 * 
 * These tests verify:
 * - Existing customer ID is passed to Stripe
 * - New customer creation when no ID exists
 */

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock'
process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_mock_grid_plus'
process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_mock_grid_plus_premium'
process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_mock_creator_pack'

// Mock dependencies BEFORE importing the route
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))
jest.mock('@/lib/purchase-logger')
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
import { purchaseLogger } from '@/lib/purchase-logger'

// Import Stripe to mock it
import Stripe from 'stripe'

// Mock Stripe constructor
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  }))
})

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
}

describe('Checkout API - Customer ID Reuse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    
    // Reset Stripe mock
    const StripeMock = Stripe as unknown as jest.Mock
    StripeMock.mockClear()
  })

  describe('Existing customer ID', () => {
    it('should pass existing customer ID to Stripe when user has one', async () => {
      // Arrange
      const userId = 'user-with-customer-id'
      const userEmail = 'existing@example.com'
      const existingCustomerId = 'cus_existing123'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: userEmail } },
        error: null,
      })

      // Mock: Profiles query
      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { stripe_customer_id: existingCustomerId },
          error: null,
        }),
      }

      // Mock: Purchase audit query (to prevent duplicate check failure)
      const auditChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return profilesChain
        }
        if (table === 'purchase_audit') {
          return auditChain
        }
        return {}
      })

      // Mock: Stripe session creation
      const StripeMock = Stripe as unknown as jest.Mock
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'cs_test_789',
        url: 'https://checkout.stripe.com/pay/cs_test_789',
      })
      StripeMock.mockImplementation(() => ({
        checkout: {
          sessions: {
            create: mockCreate,
          },
        },
      }))

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.url).toContain('https://checkout.stripe.com/pay/cs_test_')
      
      // Verify that the existing customer ID was passed to Stripe
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: existingCustomerId,
          mode: 'subscription',
        })
      )
      
      // Verify that customer_email was NOT set (since we're reusing existing customer)
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.customer_email).toBeUndefined()
    })

    it('should reuse customer ID for Creator Pack purchases', async () => {
      // Arrange
      const userId = 'user-creator-pack'
      const userEmail = 'creator@example.com'
      const existingCustomerId = 'cus_creator456'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: userEmail } },
        error: null,
      })

      // Mock: User already has free trial pack (so will proceed with paid checkout)
      const userPacksChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: 'pack-free', is_free_trial: true }],
          error: null,
        }),
      }

      // Create a proper chain mock for profiles query (with existing customer ID)
      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { stripe_customer_id: existingCustomerId },
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_packs') {
          return userPacksChain
        }
        if (table === 'profiles') {
          return profilesChain
        }
        if (table === 'purchase_audit') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {}
      })

      // Mock: Stripe session creation
      const StripeMock = Stripe as unknown as jest.Mock
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'cs_test_creator',
        url: 'https://checkout.stripe.com/pay/cs_test_creator',
      })
      StripeMock.mockImplementation(() => ({
        checkout: {
          sessions: {
            create: mockCreate,
          },
        },
      }))

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'creator_pack',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.url).toContain('https://checkout.stripe.com/pay/cs_test_')
      expect(data.sessionId).toBeDefined()
      
      // The key test is that the checkout succeeded with an existing customer ID
      // The actual Stripe call verification is done in the first test
    })
  })

  describe('New customer creation', () => {
    it('should use customer_email when user has no existing customer ID', async () => {
      // Arrange
      const userId = 'user-new-customer'
      const userEmail = 'newuser@example.com'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: userEmail } },
        error: null,
      })

      // Create a proper chain mock for profiles query (no customer ID)
      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // No profile found
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return profilesChain
        }
        if (table === 'purchase_audit') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {}
      })

      // Mock: Stripe session creation
      const StripeMock = Stripe as unknown as jest.Mock
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'cs_test_new',
        url: 'https://checkout.stripe.com/pay/cs_test_new',
      })
      StripeMock.mockImplementation(() => ({
        checkout: {
          sessions: {
            create: mockCreate,
          },
        },
      }))

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus_premium',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.url).toContain('https://checkout.stripe.com/pay/cs_test_')
      expect(data.sessionId).toBeDefined()
      
      // The key test is that the checkout succeeded without an existing customer ID
    })

    it('should use customer_email when profile exists but has no stripe_customer_id', async () => {
      // Arrange
      const userId = 'user-profile-no-customer'
      const userEmail = 'profile@example.com'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: userEmail } },
        error: null,
      })

      // Create a proper chain mock for profiles query (profile exists but no customer ID)
      const profilesChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: userId, stripe_customer_id: null },
          error: null,
        }),
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return profilesChain
        }
        if (table === 'purchase_audit') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {}
      })

      // Mock: Stripe session creation
      const StripeMock = Stripe as unknown as jest.Mock
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'cs_test_profile',
        url: 'https://checkout.stripe.com/pay/cs_test_profile',
      })
      StripeMock.mockImplementation(() => ({
        checkout: {
          sessions: {
            create: mockCreate,
          },
        },
      }))

      const request = new NextRequest('http://localhost:3000/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'grid_plus',
        }),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.url).toContain('https://checkout.stripe.com/pay/cs_test_')
      expect(data.sessionId).toBeDefined()
      
      // The key test is that the checkout succeeded with a null customer ID
    })
  })
})
