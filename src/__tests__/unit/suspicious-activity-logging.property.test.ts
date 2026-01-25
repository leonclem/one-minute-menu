/** @jest-environment node */

/**
 * Property-Based Tests for Suspicious Activity Logging
 * Feature: stripe-payment-integration
 * 
 * Tests Property 37: Suspicious Activity Logging
 * Validates: Requirements 14.4
 * 
 * Property 37: Suspicious Activity Logging
 * For any webhook request with an invalid signature or from an unexpected source, 
 * the system SHALL log it as suspicious activity with the source IP and request details.
 */

// Mock dependencies BEFORE any imports
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
}))

jest.mock('@/lib/stripe-config', () => ({
  getStripe: jest.fn(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
  })),
  getWebhookSecret: jest.fn(() => 'whsec_test_secret'),
}))

jest.mock('@/lib/security', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  logRateLimitViolation: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/stripe-webhook-processor', () => ({
  processCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
  processSubscriptionCreated: jest.fn().mockResolvedValue(undefined),
  processSubscriptionUpdated: jest.fn().mockResolvedValue(undefined),
  processSubscriptionDeleted: jest.fn().mockResolvedValue(undefined),
  processInvoicePaymentSucceeded: jest.fn().mockResolvedValue(undefined),
  processInvoicePaymentFailed: jest.fn().mockResolvedValue(undefined),
}))

import fc from 'fast-check'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/stripe/route'
import { getStripe } from '@/lib/stripe-config'
import { logSecurityEvent } from '@/lib/security'

const mockLogSecurityEvent = logSecurityEvent as jest.MockedFunction<typeof logSecurityEvent>

describe('Feature: stripe-payment-integration, Property 37: Suspicious Activity Logging', () => {
  let mockStripe: any
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.ENFORCE_RATE_LIMITING_IN_TESTS
    
    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    // Get the mocked Stripe instance
    mockStripe = { webhooks: { constructEvent: jest.fn() } }
    ;(getStripe as jest.Mock).mockReturnValue(mockStripe)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  /**
   * Property 37: Suspicious Activity Logging
   * For any webhook request with an invalid signature, the system SHALL log it 
   * as suspicious activity with the source IP and request details.
   * Validates: Requirements 14.4
   */
  it('should log security event for any webhook with invalid signature', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => s.trim().length > 0), // Invalid signature (non-whitespace)
        fc.ipV4(), // Source IP
        fc.string().filter(s => s.trim().length > 0), // User agent (non-whitespace)
        async (invalidSignature, sourceIp, userAgent) => {
          // Clear mocks at the start of each iteration
          jest.clearAllMocks()
          consoleErrorSpy.mockClear()
          
          // Mock Stripe signature verification to throw error
          mockStripe.webhooks.constructEvent.mockImplementation(() => {
            throw new Error('Invalid signature')
          })

          // Create request with invalid signature
          const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
            method: 'POST',
            headers: {
              'stripe-signature': invalidSignature,
              'x-forwarded-for': sourceIp,
              'user-agent': userAgent,
            },
            body: JSON.stringify({ type: 'test', data: { object: { id: 'test' } } }),
          })

          // Call webhook handler
          const response = await POST(request)

          // Should return 400 for invalid signature
          expect(response.status).toBe(400)

          // Verify security event logging was called
          expect(mockLogSecurityEvent).toHaveBeenCalled()
          
          // Get the call arguments
          const callArgs = mockLogSecurityEvent.mock.calls[mockLogSecurityEvent.mock.calls.length - 1]
          if (callArgs) {
            const [eventType] = callArgs
            
            // Verify it's logged as invalid signature
            expect(eventType).toBe('invalid_signature')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that missing signature header triggers security logging
   */
  it('should log security event when stripe-signature header is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        fc.string().filter(s => s.trim().length > 0),
        async (sourceIp, userAgent) => {
          // Clear mocks
          jest.clearAllMocks()
          consoleErrorSpy.mockClear()

          // Create request without signature header
          const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
            method: 'POST',
            headers: {
              'x-forwarded-for': sourceIp,
              'user-agent': userAgent,
              // No stripe-signature header
            },
            body: JSON.stringify({ type: 'test', data: { object: { id: 'test' } } }),
          })

          const response = await POST(request)

          // Should return 400
          expect(response.status).toBe(400)

          // Verify security logging was called
          expect(mockLogSecurityEvent).toHaveBeenCalled()
          
          const callArgs = mockLogSecurityEvent.mock.calls[mockLogSecurityEvent.mock.calls.length - 1]
          if (callArgs) {
            const [eventType] = callArgs
            expect(eventType).toBe('missing_signature')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that valid webhooks do NOT log security events
   */
  it('should NOT log security events for valid webhook signatures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => s.trim().length > 0),
        fc.ipV4(),
        fc.uuid(),
        async (signature, sourceIp, eventId) => {
          // Clear mocks
          jest.clearAllMocks()

          // Mock valid webhook event
          const validEvent = {
            id: eventId,
            object: 'event',
            type: 'checkout.session.completed',
            data: {
              object: {
                id: 'cs_test_123',
                object: 'checkout.session',
              },
            },
          }

          mockStripe.webhooks.constructEvent.mockReturnValue(validEvent)

          const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
            method: 'POST',
            headers: {
              'stripe-signature': signature,
              'x-forwarded-for': sourceIp,
            },
            body: JSON.stringify(validEvent),
          })

          const response = await POST(request)

          // Should return 200 for valid webhook
          expect(response.status).toBe(200)

          // Verify NO security events were logged
          expect(mockLogSecurityEvent).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
