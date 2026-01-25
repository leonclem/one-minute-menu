/** @jest-environment node */

/**
 * Unit tests for free Creator Pack logic in checkout API
 * 
 * Tests Requirements: 6.1, 6.2, 6.3
 */

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock'
process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_mock_grid_plus'
process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_mock_grid_plus_premium'
process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_mock_creator_pack'

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

jest.mock('@/lib/stripe-config', () => {
  const actual = jest.requireActual('@/lib/stripe-config');
  return {
    ...actual,
    getStripe: jest.fn(),
  };
});

jest.mock('@/lib/purchase-logger')
jest.mock('@/lib/stripe-rate-limiter', () => ({
  checkoutRateLimiter: {
    check: jest.fn().mockReturnValue({ allowed: true })
  }
}))

jest.mock('@/lib/security', () => ({
  logUnauthorizedAccess: jest.fn(),
  logRateLimitViolation: jest.fn(),
  logInvalidInput: jest.fn()
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checkout/route'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'
import { getStripe } from '@/lib/stripe-config'

// Helper to create a robust Supabase chain mock
const createChain = (data: any = null, error: any = null) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    limit: jest.fn().mockImplementation(function() {
      return Promise.resolve({ data, error });
    }),
    single: jest.fn().mockImplementation(function() {
      return Promise.resolve({ data, error });
    }),
    insert: jest.fn().mockImplementation(function() {
      return Promise.resolve({ error });
    }),
  }
  // Allow limit and single to be used as both promises and chainable methods
  // by making them return the chain if called with nothing, but we usually call with args
  return chain
}

describe('Checkout API - Free Pack Logic', () => {
  let mockSupabase: any
  let mockStripe: any
  let mockStripeCreate: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: jest.fn().mockImplementation(() => createChain()),
    }

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

    // Setup Stripe Mock
    mockStripeCreate = jest.fn().mockResolvedValue({
      id: 'cs_test_default',
      url: 'https://checkout.stripe.com/pay/cs_test_default',
    })
    mockStripe = {
      checkout: {
        sessions: {
          create: mockStripeCreate,
        },
      },
    }
    ;(getStripe as jest.Mock).mockReturnValue(mockStripe)
  })

  describe('Free pack eligibility check', () => {
    it('should grant free Creator Pack to eligible user (no existing free trial)', async () => {
      // Arrange
      const userId = 'user-123'
      const userEmail = 'test@example.com'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: userEmail } },
        error: null,
      })

      // Mock profiles (no existing customer)
      const profilesChain = createChain(null, null)
      
      // Mock user_packs (no free trial)
      const userPacksChain = createChain([], null)

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profilesChain
        if (table === 'user_packs') return userPacksChain
        return createChain([], null)
      })

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
      expect(data.grantedFree).toBe(true)
      expect(userPacksChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          pack_type: 'creator_pack',
          is_free_trial: true,
        })
      )
      expect(mockStripeCreate).not.toHaveBeenCalled()
    })

    it('should proceed with paid checkout for ineligible user (already used free trial)', async () => {
      // Arrange
      const userId = 'user-456'
      const userEmail = 'test2@example.com'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: userEmail } },
        error: null,
      })

      // Mock user_packs (existing free trial found)
      const userPacksChain = createChain([{ id: 'pack-123', is_free_trial: true }], null)

      // Mock profiles (has customer ID)
      const profilesChain = createChain({ stripe_customer_id: 'cus_test123' }, null)

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_packs') return userPacksChain
        if (table === 'profiles') return profilesChain
        return createChain([], null)
      })

      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      })

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
      expect(data.grantedFree).toBeUndefined()
      expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_123')
      expect(mockStripeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          metadata: expect.objectContaining({
            user_id: userId,
            product_type: 'creator_pack',
          }),
        })
      )
    })

    it('should proceed with paid checkout for subscription products', async () => {
      // Arrange
      const userId = 'user-789'
      const userEmail = 'test3@example.com'

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: userEmail } },
        error: null,
      })

      mockStripeCreate.mockResolvedValue({
        id: 'cs_test_sub',
        url: 'https://checkout.stripe.com/pay/cs_test_sub',
      })

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
      expect(data.grantedFree).toBeUndefined()
      expect(data.sessionId).toBe('cs_test_sub')
    })
  })

  describe('Error handling', () => {
    it('should return 500 if database error occurs during eligibility check', async () => {
      // Arrange
      const userId = 'user-error'
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: 'error@example.com' } },
        error: null,
      })

      const errorChain = createChain(null, { message: 'Database connection failed' })
      const normalChain = createChain([], null)

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_packs') return errorChain
        return normalChain
      })

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
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to check pack eligibility')
      expect(data.code).toBe('DATABASE_ERROR')
    })

    it('should return 500 if free pack grant fails', async () => {
      // Arrange
      const userId = 'user-grant-fail'
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: 'fail@example.com' } },
        error: null,
      })

      const userPacksChain = createChain([], null)
      // Override insert to fail
      userPacksChain.insert = jest.fn().mockResolvedValue({ error: { message: 'Insert failed' } })

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_packs') return userPacksChain
        return createChain([], null)
      })

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
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to grant free Creator Pack')
      expect(data.code).toBe('FULFILLMENT_ERROR')
    })
  })
})
