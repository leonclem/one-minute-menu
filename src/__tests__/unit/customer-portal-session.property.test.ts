/**
 * Property-Based Tests for Customer Portal Session Creation
 * Feature: stripe-payment-integration
 * 
 * Tests Property 38: Customer Portal Session Creation
 * Validates: Requirements 15.2, 15.3
 * 
 * @jest-environment node
 */

import fc from 'fast-check'
import { NextRequest } from 'next/server'
import type { CustomerPortalResponse } from '@/types'

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret_key_for_testing'
process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_mock_grid_plus'
process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_mock_grid_plus_premium'
process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_mock_creator_pack'

// Mock dependencies BEFORE importing the route
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/stripe-config', () => ({
  getStripe: jest.fn(),
  validateStripeConfig: jest.fn(),
  getPriceId: jest.fn(),
}))

import { POST } from '@/app/api/customer-portal/route'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe-config'

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const mockGetStripe = getStripe as jest.MockedFunction<typeof getStripe>

describe('Feature: stripe-payment-integration, Property 38: Customer Portal Session Creation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Property 38: Customer Portal Session Creation
   * For any authenticated user with a stripe_customer_id requesting a Customer Portal session,
   * the system SHALL create a Stripe Customer Portal session with the customer_id and a return_url.
   * 
   * Validates: Requirements 15.2, 15.3
   */
  it('should create a Customer Portal session with customer_id and return_url for any authenticated user with stripe_customer_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`), // stripe_customer_id
        fc.option(fc.webUrl(), { nil: undefined }), // optional returnUrl
        
        async (userId, stripeCustomerId, returnUrl) => {
          // Mock authenticated user
          const mockSupabase = {
            auth: {
              getUser: jest.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
              }),
            },
            from: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { stripe_customer_id: stripeCustomerId },
                    error: null,
                  }),
                }),
              }),
            }),
          }
          mockCreateServerSupabaseClient.mockReturnValue(mockSupabase as any)

          // Mock Stripe Customer Portal session creation
          const mockPortalUrl = `https://billing.stripe.com/session/${fc.sample(fc.string({ minLength: 20, maxLength: 40 }), 1)[0]}`
          const mockStripe = {
            billingPortal: {
              sessions: {
                create: jest.fn().mockResolvedValue({
                  url: mockPortalUrl,
                }),
              },
            },
          }
          mockGetStripe.mockReturnValue(mockStripe as any)

          // Create request
          const requestBody = returnUrl ? { returnUrl } : {}
          const request = new NextRequest('http://localhost:3000/api/customer-portal', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json',
            },
          })

          // Call the API
          const response = await POST(request)
          const data = await response.json() as CustomerPortalResponse

          // Verify response
          expect(response.status).toBe(200)
          expect(data.url).toBeDefined()
          expect(typeof data.url).toBe('string')
          expect(data.url).toContain('billing.stripe.com')

          // Verify Stripe was called with correct parameters
          expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: stripeCustomerId,
            return_url: returnUrl || 'http://localhost:3000/dashboard',
          })

          // Verify authentication was checked
          expect(mockSupabase.auth.getUser).toHaveBeenCalled()

          // Verify profile was queried for stripe_customer_id
          expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: Unauthenticated user should be rejected
   */
  it('should reject unauthenticated users with 401 status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.webUrl(), { nil: undefined }), // optional returnUrl
        
        async (returnUrl) => {
          // Mock unauthenticated user
          // Note: logUnauthorizedAccess logs to webhook_events, so we need to mock that
          const mockSupabase = {
            auth: {
              getUser: jest.fn().mockResolvedValue({
                data: { user: null },
                error: { message: 'Not authenticated' },
              }),
            },
            from: jest.fn().mockReturnValue({
              insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
          mockCreateServerSupabaseClient.mockReturnValue(mockSupabase as any)

          // Create request
          const requestBody = returnUrl ? { returnUrl } : {}
          const request = new NextRequest('http://localhost:3000/api/customer-portal', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json',
            },
          })

          // Call the API
          const response = await POST(request)
          const data = await response.json()

          // Verify response
          expect(response.status).toBe(401)
          expect(data.error).toBeDefined()
          expect(data.code).toBe('UNAUTHENTICATED')

          // Verify profile was not queried (only webhook_events for security logging)
          expect(mockSupabase.from).not.toHaveBeenCalledWith('profiles')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: User without stripe_customer_id should be rejected
   */
  it('should reject users without stripe_customer_id with 400 status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.option(fc.webUrl(), { nil: undefined }), // optional returnUrl
        
        async (userId, returnUrl) => {
          // Mock authenticated user without stripe_customer_id
          const mockSupabase = {
            auth: {
              getUser: jest.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
              }),
            },
            from: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { stripe_customer_id: null },
                    error: null,
                  }),
                }),
              }),
            }),
          }
          mockCreateServerSupabaseClient.mockReturnValue(mockSupabase as any)

          // Create request
          const requestBody = returnUrl ? { returnUrl } : {}
          const request = new NextRequest('http://localhost:3000/api/customer-portal', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json',
            },
          })

          // Call the API
          const response = await POST(request)
          const data = await response.json()

          // Verify response
          expect(response.status).toBe(400)
          expect(data.error).toBeDefined()
          expect(data.code).toBe('NO_CUSTOMER_ID')
          expect(data.error).toContain('No Stripe customer found')

          // Verify authentication was checked
          expect(mockSupabase.auth.getUser).toHaveBeenCalled()

          // Verify profile was queried
          expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: Stripe API error should be handled gracefully
   */
  it('should handle Stripe API errors gracefully with 500 status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`), // stripe_customer_id
        fc.option(fc.webUrl(), { nil: undefined }), // optional returnUrl
        fc.string({ minLength: 10, maxLength: 100 }), // error message
        
        async (userId, stripeCustomerId, returnUrl, errorMessage) => {
          // Mock authenticated user
          const mockSupabase = {
            auth: {
              getUser: jest.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
              }),
            },
            from: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { stripe_customer_id: stripeCustomerId },
                    error: null,
                  }),
                }),
              }),
            }),
          }
          mockCreateServerSupabaseClient.mockReturnValue(mockSupabase as any)

          // Mock Stripe API error
          const mockStripe = {
            billingPortal: {
              sessions: {
                create: jest.fn().mockRejectedValue(new Error(errorMessage)),
              },
            },
          }
          mockGetStripe.mockReturnValue(mockStripe as any)

          // Create request
          const requestBody = returnUrl ? { returnUrl } : {}
          const request = new NextRequest('http://localhost:3000/api/customer-portal', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
              'Content-Type': 'application/json',
            },
          })

          // Call the API
          const response = await POST(request)
          const data = await response.json()

          // Verify response
          expect(response.status).toBe(500)
          expect(data.error).toBeDefined()
          expect(data.code).toBe('STRIPE_API_ERROR')

          // Verify Stripe was called
          expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Edge case: Default return URL should be used when not provided
   */
  it('should use default dashboard return URL when returnUrl is not provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`), // stripe_customer_id
        
        async (userId, stripeCustomerId) => {
          // Mock authenticated user
          const mockSupabase = {
            auth: {
              getUser: jest.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
              }),
            },
            from: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { stripe_customer_id: stripeCustomerId },
                    error: null,
                  }),
                }),
              }),
            }),
          }
          mockCreateServerSupabaseClient.mockReturnValue(mockSupabase as any)

          // Mock Stripe Customer Portal session creation
          const mockPortalUrl = `https://billing.stripe.com/session/test`
          const mockStripe = {
            billingPortal: {
              sessions: {
                create: jest.fn().mockResolvedValue({
                  url: mockPortalUrl,
                }),
              },
            },
          }
          mockGetStripe.mockReturnValue(mockStripe as any)

          // Create request without returnUrl
          const request = new NextRequest('http://localhost:3000/api/customer-portal', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: {
              'Content-Type': 'application/json',
            },
          })

          // Call the API
          const response = await POST(request)

          // Verify Stripe was called with default return URL
          expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: stripeCustomerId,
            return_url: 'http://localhost:3000/dashboard',
          })

          expect(response.status).toBe(200)
        }
      ),
      { numRuns: 100 }
    )
  })
})
