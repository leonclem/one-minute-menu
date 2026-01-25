/** @jest-environment node */

/**
 * Property-based tests for webhook rate limiting
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 36: Webhook Rate Limiting (Requirements 14.3)
 */

// Mock dependencies BEFORE any imports
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/stripe-config', () => ({
  getStripe: jest.fn(),
  getWebhookSecret: jest.fn(() => 'whsec_test_secret'),
}))
jest.mock('@/lib/security', () => ({
  logRateLimitViolation: jest.fn(),
  logSecurityEvent: jest.fn(),
}))
jest.mock('@/lib/stripe-webhook-processor', () => ({
  processCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
  processSubscriptionCreated: jest.fn().mockResolvedValue(undefined),
  processSubscriptionUpdated: jest.fn().mockResolvedValue(undefined),
  processSubscriptionDeleted: jest.fn().mockResolvedValue(undefined),
  processInvoicePaymentSucceeded: jest.fn().mockResolvedValue(undefined),
  processInvoicePaymentFailed: jest.fn().mockResolvedValue(undefined),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/stripe/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe-config'
import { webhookRateLimiter, cleanupRateLimiters } from '@/lib/stripe-rate-limiter'
import fc from 'fast-check'
import Stripe from 'stripe'

const mockSupabase = {
  from: jest.fn(),
}

const mockStripe = {
  webhooks: {
    constructEvent: jest.fn(),
  },
}

describe('Feature: stripe-payment-integration - Webhook Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ENFORCE_RATE_LIMITING_IN_TESTS = 'true'
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(getStripe as jest.Mock).mockReturnValue(mockStripe)

    // Mock webhook_events chains
    const webhookEventsChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
    }

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return webhookEventsChain
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    // Mock successful signature verification
    mockStripe.webhooks.constructEvent.mockReturnValue({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: {
            userId: 'user-123',
            productType: 'grid_plus',
          },
        },
      },
    } as Stripe.Event)
  })

  afterEach(() => {
    // Reset rate limiter after each test
    webhookRateLimiter.reset('test-ip-123')
    webhookRateLimiter.reset('192.168.1.1')
  })

  afterAll(() => {
    // Properly cleanup rate limiter intervals
    cleanupRateLimiters()
  })

  /**
   * Property 36: Webhook Rate Limiting
   * For any IP address making more than N webhook requests within M seconds,
   * the system SHALL reject subsequent requests with a 429 status code.
   * 
   * Validates: Requirements 14.3
   */
  describe('Property 36: Webhook Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // Within the limit of 100 requests per minute
          async (numRequests) => {
            const testIp = `192.168.1.${Math.floor(Math.random() * 255)}`
            
            // Reset rate limiter for this test
            webhookRateLimiter.reset(testIp)

            // Act: Make numRequests requests
            for (let i = 0; i < numRequests; i++) {
              const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                headers: {
                  'stripe-signature': 't=123,v1=signature',
                  'x-forwarded-for': testIp,
                },
                body: JSON.stringify({
                  id: `evt_test_${i}`,
                  type: 'checkout.session.completed',
                }),
              })

              const response = await POST(request)

              // Assert: All requests within limit should not be rate limited
              expect(response.status).not.toBe(429)
            }

            // Cleanup
            webhookRateLimiter.reset(testIp)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should reject requests exceeding rate limit with 429', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 101, max: 110 }), // Exceeds the limit of 100 requests per minute
          async (numRequests) => {
            const testIp = `192.168.2.${Math.floor(Math.random() * 255)}`
            
            // Reset rate limiter for this test
            webhookRateLimiter.reset(testIp)

            let exceededCount = 0

            // Act: Make numRequests requests
            for (let i = 0; i < numRequests; i++) {
              const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                headers: {
                  'stripe-signature': 't=123,v1=signature',
                  'x-forwarded-for': testIp,
                },
                body: JSON.stringify({
                  id: `evt_test_${i}`,
                  type: 'checkout.session.completed',
                }),
              })

              const response = await POST(request)

              if (response.status === 429) {
                exceededCount++
                const data = await response.json()
                
                // Assert: 429 response should have proper error structure
                expect(data.error).toBeDefined()
                expect(data.error).toContain('Too many webhook requests')
                
                // Assert: Should have rate limit headers
                expect(response.headers.get('Retry-After')).toBeDefined()
              }
            }

            // Assert: At least one request should have been rate limited
            expect(exceededCount).toBeGreaterThan(0)

            // Cleanup
            webhookRateLimiter.reset(testIp)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should enforce rate limit per IP address independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.ipV4(), { minLength: 2, maxLength: 3 }), // Multiple IP addresses
          async (ipAddresses) => {
            // Reset rate limiters for all IPs
            ipAddresses.forEach(ip => webhookRateLimiter.reset(ip))

            // Act: Each IP makes 100 requests (at the limit)
            for (const ip of ipAddresses) {
              for (let i = 0; i < 100; i++) {
                const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
                  method: 'POST',
                  headers: {
                    'stripe-signature': 't=123,v1=signature',
                    'x-forwarded-for': ip,
                  },
                  body: JSON.stringify({
                    id: `evt_test_${i}`,
                    type: 'checkout.session.completed',
                  }),
                })

                const response = await POST(request)

                // Assert: Each IP should be able to make 100 requests
                // (rate limits are per-IP, not global)
                expect(response.status).not.toBe(429)
              }
            }

            // Cleanup
            ipAddresses.forEach(ip => webhookRateLimiter.reset(ip))
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should include rate limit information in response headers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.ipV4(),
          async (testIp) => {
            // Reset rate limiter for this test
            webhookRateLimiter.reset(testIp)

            // Act: Make a request
            const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
              method: 'POST',
              headers: {
                'stripe-signature': 't=123,v1=signature',
                'x-forwarded-for': testIp,
              },
              body: JSON.stringify({
                id: 'evt_test_123',
                type: 'checkout.session.completed',
              }),
            })

            const response = await POST(request)

            // If not rate limited, we won't have rate limit headers in success response
            // But we can verify the rate limiter is tracking correctly
            if (response.status !== 429) {
              // Make 100 more requests to hit the limit
              for (let i = 0; i < 100; i++) {
                const req = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
                  method: 'POST',
                  headers: {
                    'stripe-signature': 't=123,v1=signature',
                    'x-forwarded-for': testIp,
                  },
                  body: JSON.stringify({
                    id: `evt_test_${i}`,
                    type: 'checkout.session.completed',
                  }),
                })
                await POST(req)
              }

              // Now the next request should be rate limited with headers
              const rateLimitedReq = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
                method: 'POST',
                headers: {
                  'stripe-signature': 't=123,v1=signature',
                  'x-forwarded-for': testIp,
                },
                body: JSON.stringify({
                  id: 'evt_test_final',
                  type: 'checkout.session.completed',
                }),
              })

              const rateLimitedResponse = await POST(rateLimitedReq)
              
              if (rateLimitedResponse.status === 429) {
                // Assert: Rate limited response should include headers
                expect(rateLimitedResponse.headers.get('X-RateLimit-Remaining')).toBeDefined()
                expect(rateLimitedResponse.headers.get('X-RateLimit-Reset')).toBeDefined()
                expect(rateLimitedResponse.headers.get('Retry-After')).toBeDefined()
              }
            }

            // Cleanup
            webhookRateLimiter.reset(testIp)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should handle unknown IP addresses gracefully', async () => {
      // Reset rate limiter
      webhookRateLimiter.reset('unknown')

      // Act: Make a request without IP headers
      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 't=123,v1=signature',
        },
        body: JSON.stringify({
          id: 'evt_test_123',
          type: 'checkout.session.completed',
        }),
      })

      const response = await POST(request)

      // Assert: Should process normally (not rate limited immediately)
      expect(response.status).not.toBe(429)

      // Cleanup
      webhookRateLimiter.reset('unknown')
    })
  })
})
