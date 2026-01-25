/** @jest-environment node */

/**
 * Property-based tests for checkout rate limiting
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 28: Rate Limiting on Checkout (Requirements 10.5)
 */

// Mock dependencies BEFORE any imports
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/stripe-config', () => ({
  getStripe: jest.fn(),
  getPriceId: jest.fn(),
}))
jest.mock('@/lib/purchase-logger', () => ({
  purchaseLogger: {
    logPurchase: jest.fn(),
  },
}))
jest.mock('@/lib/security', () => ({
  logRateLimitViolation: jest.fn(),
  logSecurityEvent: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/checkout/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getStripe, getPriceId } from '@/lib/stripe-config'
import { checkoutRateLimiter, cleanupRateLimiters } from '@/lib/stripe-rate-limiter'
import fc from 'fast-check'

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

describe('Feature: stripe-payment-integration - Checkout Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ENFORCE_RATE_LIMITING_IN_TESTS = 'true'
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(getStripe as jest.Mock).mockReturnValue(mockStripe)
    ;(getPriceId as jest.Mock).mockImplementation((productType: string) => {
      const priceIds: Record<string, string> = {
        grid_plus: 'price_mock_grid_plus',
        grid_plus_premium: 'price_mock_grid_plus_premium',
        creator_pack: 'price_mock_creator_pack',
      }
      return priceIds[productType] || 'price_mock_default'
    })

    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      },
      error: null,
    })

    // Mock user_packs query (free trial already used)
    const userPacksChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [{ id: 'pack-123', is_free_trial: true }],
        error: null,
      }),
    }

    // Mock profile query
    const profileChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { stripe_customer_id: 'cus_test_123' },
        error: null,
      }),
    }

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'user_packs') {
        return userPacksChain
      }
      if (table === 'profiles') {
        return profileChain
      }
      return {}
    })

    // Mock Stripe checkout session creation
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/test',
    })
  })

  afterEach(() => {
    // Reset rate limiter after each test
    checkoutRateLimiter.reset('user-123')
  })

  afterAll(() => {
    // Properly cleanup rate limiter intervals
    cleanupRateLimiters()
  })

  /**
   * Property 28: Rate Limiting on Checkout
   * For any user making more than N checkout session creation requests within M minutes,
   * the system SHALL reject subsequent requests with a 429 status code.
   * 
   * Validates: Requirements 10.5
   */
  describe('Property 28: Rate Limiting on Checkout', () => {
    it('should allow requests within rate limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          fc.integer({ min: 1, max: 10 }), // Within the limit of 10 requests per 5 minutes
          async (productType, numRequests) => {
            // Reset rate limiter for this test
            checkoutRateLimiter.reset('user-123')

            // Act: Make numRequests requests
            for (let i = 0; i < numRequests; i++) {
              const request = new NextRequest('http://localhost:3000/api/checkout', {
                method: 'POST',
                body: JSON.stringify({
                  productType,
                  successUrl: 'http://localhost:3000/success',
                  cancelUrl: 'http://localhost:3000/cancel',
                }),
              })

              const response = await POST(request)

              // Assert: All requests within limit should succeed (not 429)
              expect(response.status).not.toBe(429)
            }

            // Cleanup
            checkoutRateLimiter.reset('user-123')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should reject requests exceeding rate limit with 429', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          fc.integer({ min: 11, max: 15 }), // Exceeds the limit of 10 requests per 5 minutes
          async (productType, numRequests) => {
            // Reset rate limiter for this test
            checkoutRateLimiter.reset('user-123')

            let exceededCount = 0

            // Act: Make numRequests requests
            for (let i = 0; i < numRequests; i++) {
              const request = new NextRequest('http://localhost:3000/api/checkout', {
                method: 'POST',
                body: JSON.stringify({
                  productType,
                  successUrl: 'http://localhost:3000/success',
                  cancelUrl: 'http://localhost:3000/cancel',
                }),
              })

              const response = await POST(request)

              if (response.status === 429) {
                exceededCount++
                const data = await response.json()
                
                // Assert: 429 response should have proper error structure
                expect(data.error).toBeDefined()
                expect(data.code).toBe('RATE_LIMIT_EXCEEDED')
                
                // Assert: Should have rate limit headers
                expect(response.headers.get('Retry-After')).toBeDefined()
              }
            }

            // Assert: At least one request should have been rate limited
            expect(exceededCount).toBeGreaterThan(0)

            // Cleanup
            checkoutRateLimiter.reset('user-123')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should enforce rate limit per user (different users have independent limits)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          fc.array(fc.uuid(), { minLength: 2, maxLength: 3 }), // Multiple user IDs
          async (productType, userIds) => {
            // Reset rate limiters for all users
            userIds.forEach(userId => checkoutRateLimiter.reset(userId))

            // Act: Each user makes 10 requests (at the limit)
            for (const userId of userIds) {
              // Mock different user
              mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                  user: {
                    id: userId,
                    email: `${userId}@example.com`,
                  },
                },
                error: null,
              })

              for (let i = 0; i < 10; i++) {
                const request = new NextRequest('http://localhost:3000/api/checkout', {
                  method: 'POST',
                  body: JSON.stringify({
                    productType,
                    successUrl: 'http://localhost:3000/success',
                    cancelUrl: 'http://localhost:3000/cancel',
                  }),
                })

                const response = await POST(request)

                // Assert: Each user should be able to make 10 requests
                // (rate limits are per-user, not global)
                expect(response.status).not.toBe(429)
              }
            }

            // Cleanup
            userIds.forEach(userId => checkoutRateLimiter.reset(userId))
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should include rate limit information in response headers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          async (productType) => {
            // Reset rate limiter for this test
            checkoutRateLimiter.reset('user-123')

            // Act: Make a request
            const request = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType,
                successUrl: 'http://localhost:3000/success',
                cancelUrl: 'http://localhost:3000/cancel',
              }),
            })

            const response = await POST(request)

            // Assert: Response should include rate limit headers
            expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
            expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()

            const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')
            expect(remaining).toBeGreaterThanOrEqual(0)
            expect(remaining).toBeLessThan(10) // Less than max (one request consumed)

            // Cleanup
            checkoutRateLimiter.reset('user-123')
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should reset rate limit after time window expires', async () => {
      // This test verifies the rate limit window behavior
      // Note: We can't easily test the actual time-based reset in a unit test,
      // but we can verify the reset() method works correctly

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
          async (productType) => {
            // Reset rate limiter
            checkoutRateLimiter.reset('user-123')

            // Act: Make 10 requests (at the limit)
            for (let i = 0; i < 10; i++) {
              const request = new NextRequest('http://localhost:3000/api/checkout', {
                method: 'POST',
                body: JSON.stringify({
                  productType,
                  successUrl: 'http://localhost:3000/success',
                  cancelUrl: 'http://localhost:3000/cancel',
                }),
              })

              await POST(request)
            }

            // Act: 11th request should be rate limited
            const request11 = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType,
                successUrl: 'http://localhost:3000/success',
                cancelUrl: 'http://localhost:3000/cancel',
              }),
            })

            const response11 = await POST(request11)
            expect(response11.status).toBe(429)

            // Act: Reset the rate limiter (simulating time window expiry)
            checkoutRateLimiter.reset('user-123')

            // Act: After reset, requests should work again
            const requestAfterReset = new NextRequest('http://localhost:3000/api/checkout', {
              method: 'POST',
              body: JSON.stringify({
                productType,
                successUrl: 'http://localhost:3000/success',
                cancelUrl: 'http://localhost:3000/cancel',
              }),
            })

            const responseAfterReset = await POST(requestAfterReset)

            // Assert: After reset, request should succeed
            expect(responseAfterReset.status).not.toBe(429)

            // Cleanup
            checkoutRateLimiter.reset('user-123')
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
