/** @jest-environment node */

/**
 * Property-Based Tests for Security Event Logging
 * Feature: stripe-payment-integration
 * 
 * Tests Property 29: Security Event Logging
 * Validates: Requirements 10.6
 * 
 * Property 29: Security Event Logging
 * For any security-relevant event (invalid webhook signature, rate limit exceeded, 
 * unauthorized access attempt), the system SHALL create a log entry with sufficient context.
 */

// Mock Supabase BEFORE any imports - this is the ONLY dependency we mock
const mockSupabaseFrom = jest.fn()
const mockSupabaseInsert = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: mockSupabaseFrom,
  })),
}))

import fc from 'fast-check'
import { NextRequest } from 'next/server'

// Import security module AFTER mocking its dependencies
import * as security from '@/lib/security'
const { 
  logSecurityEvent, 
  logUnauthorizedAccess, 
  logRateLimitViolation,
  logInvalidInput,
} = security

describe('Feature: stripe-payment-integration, Property 29: Security Event Logging', () => {
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock console methods
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    // Reset and configure mocks
    mockSupabaseFrom.mockReturnValue({
      insert: mockSupabaseInsert.mockResolvedValue({ data: null, error: null }),
    })
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  /**
   * Property 29: Security Event Logging
   * For any security-relevant event, the system SHALL create a log entry with sufficient context.
   * Validates: Requirements 10.6
   */
  it('should log any security event to database with sufficient context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'invalid_signature',
          'missing_signature',
          'rate_limit_exceeded',
          'unauthorized_access',
          'invalid_input',
          'suspicious_activity'
        ),
        fc.webUrl(),
        fc.uuid(),
        fc.option(fc.string(), { nil: undefined }),
        fc.option(fc.string(), { nil: undefined }),
        fc.option(fc.string(), { nil: undefined }),
        async (eventType, url, requestId, userId, endpoint, details) => {
          // Clear mocks at the start of each iteration for proper isolation
          jest.clearAllMocks()
          mockSupabaseFrom.mockReturnValue({
            insert: mockSupabaseInsert.mockResolvedValue({ data: null, error: null }),
          })
          consoleWarnSpy.mockClear()
          consoleErrorSpy.mockClear()

          // Create mock request
          const request = new NextRequest(url, {
            headers: {
              'x-forwarded-for': '192.168.1.1',
              'user-agent': 'test-agent',
            },
          })

          // Log security event
          await logSecurityEvent(eventType, request, requestId, {
            userId,
            endpoint,
            details,
          })

          // Verify database insert was called
          expect(mockSupabaseFrom).toHaveBeenCalledWith('webhook_events')
          expect(mockSupabaseInsert).toHaveBeenCalled()

          // Get the inserted data (use last call for proper isolation)
          const insertCall = mockSupabaseInsert.mock.calls[mockSupabaseInsert.mock.calls.length - 1][0]

          // Verify sufficient context is logged
          expect(insertCall).toMatchObject({
            stripe_event_id: `security_${requestId}`,
            event_type: `security.${eventType}`,
            processed: false,
            processing_error: expect.any(String),
            payload: expect.objectContaining({
              source_ip: expect.any(String),
              user_agent: 'test-agent',
              endpoint: expect.any(String),
              timestamp: expect.any(String),
              request_id: requestId,
            }),
          })

          // Verify optional fields are included when provided
          if (userId) {
            expect(insertCall.payload.user_id).toBe(userId)
          }
          if (endpoint) {
            expect(insertCall.payload.endpoint).toBe(endpoint)
          }
          if (details) {
            expect(insertCall.payload.details).toBe(details)
          }

          // Verify console logging occurred
          if (eventType === 'rate_limit_exceeded' || eventType === 'invalid_input') {
            expect(consoleWarnSpy).toHaveBeenCalled()
          } else {
            expect(consoleErrorSpy).toHaveBeenCalled()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that unauthorized access attempts are logged with user context
   */
  it('should log unauthorized access attempts with user ID and reason', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.uuid(),
        fc.option(fc.uuid(), { nil: undefined }),
        fc.option(fc.string(), { nil: undefined }),
        async (url, requestId, userId, reason) => {
          // Clear mocks at the start of each iteration
          jest.clearAllMocks()
          mockSupabaseFrom.mockReturnValue({
            insert: mockSupabaseInsert.mockResolvedValue({ data: null, error: null }),
          })

          const request = new NextRequest(url, {
            headers: {
              'x-forwarded-for': '10.0.0.1',
              'user-agent': 'test-browser',
            },
          })

          await logUnauthorizedAccess(request, requestId, userId, reason)

          expect(mockSupabaseFrom).toHaveBeenCalledWith('webhook_events')
          expect(mockSupabaseInsert).toHaveBeenCalled()

          // Get the last call for proper isolation
          const insertCall = mockSupabaseInsert.mock.calls[mockSupabaseInsert.mock.calls.length - 1][0]
          expect(insertCall.event_type).toBe('security.unauthorized_access')
          expect(insertCall.payload).toMatchObject({
            request_id: requestId,
            source_ip: expect.any(String),
          })

          if (userId) {
            expect(insertCall.payload.user_id).toBe(userId)
          }
          if (reason) {
            expect(insertCall.payload.details).toBe(reason)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that rate limit violations are logged with identifier and retry info
   */
  it('should log rate limit violations with identifier and retry information', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.uuid(),
        fc.string(),
        fc.option(fc.integer({ min: 1, max: 3600 }), { nil: undefined }),
        async (url, requestId, identifier, retryAfter) => {
          // Clear mocks at the start of each iteration
          jest.clearAllMocks()
          mockSupabaseFrom.mockReturnValue({
            insert: mockSupabaseInsert.mockResolvedValue({ data: null, error: null }),
          })

          const request = new NextRequest(url, {
            headers: {
              'x-forwarded-for': '172.16.0.1',
              'user-agent': 'rate-limiter-test',
            },
          })

          await logRateLimitViolation(request, requestId, identifier, retryAfter)

          expect(mockSupabaseFrom).toHaveBeenCalledWith('webhook_events')
          expect(mockSupabaseInsert).toHaveBeenCalled()

          // Get the last call for proper isolation
          const insertCall = mockSupabaseInsert.mock.calls[mockSupabaseInsert.mock.calls.length - 1][0]
          expect(insertCall.event_type).toBe('security.rate_limit_exceeded')
          expect(insertCall.payload).toMatchObject({
            request_id: requestId,
            identifier,
            details: expect.stringContaining(identifier),
          })

          if (retryAfter !== undefined) {
            expect(insertCall.payload.retryAfter).toBe(retryAfter)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that invalid input is logged with field, value, and reason
   */
  it('should log invalid input with field name, sanitized value, and validation reason', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.uuid(),
        fc.string(),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        fc.string(),
        async (url, requestId, field, value, reason) => {
          // Clear mocks at the start of each iteration
          jest.clearAllMocks()
          mockSupabaseFrom.mockReturnValue({
            insert: mockSupabaseInsert.mockResolvedValue({ data: null, error: null }),
          })

          const request = new NextRequest(url, {
            headers: {
              'x-forwarded-for': '192.168.100.1',
              'user-agent': 'validation-test',
            },
          })

          await logInvalidInput(request, requestId, field, value, reason)

          expect(mockSupabaseFrom).toHaveBeenCalledWith('webhook_events')
          expect(mockSupabaseInsert).toHaveBeenCalled()

          // Get the last call for proper isolation
          const insertCall = mockSupabaseInsert.mock.calls[mockSupabaseInsert.mock.calls.length - 1][0]
          expect(insertCall.event_type).toBe('security.invalid_input')
          expect(insertCall.payload).toMatchObject({
            request_id: requestId,
            field,
            details: reason,
          })

          // Value should be sanitized (not contain sensitive data)
          expect(insertCall.payload.value).toBeDefined()
          if (typeof value === 'string' && value.startsWith('sk_')) {
            expect(insertCall.payload.value).toBe('[REDACTED_API_KEY]')
          } else if (typeof value === 'string' && value.startsWith('whsec_')) {
            expect(insertCall.payload.value).toBe('[REDACTED_WEBHOOK_SECRET]')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that logging continues even if database insert fails
   */
  it('should log to console even when database logging fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'invalid_signature',
          'unauthorized_access',
          'suspicious_activity'
        ),
        fc.webUrl(),
        fc.uuid(),
        async (eventType, url, requestId) => {
          // Clear mocks at the start of each iteration
          jest.clearAllMocks()
          consoleErrorSpy.mockClear()
          
          // Mock database failure for this iteration
          mockSupabaseFrom.mockReturnValue({
            insert: mockSupabaseInsert.mockRejectedValue(new Error('Database connection failed')),
          })

          const request = new NextRequest(url)

          // Should not throw
          await expect(
            logSecurityEvent(eventType, request, requestId)
          ).resolves.not.toThrow()

          // Console logging should still occur
          expect(consoleErrorSpy).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that source IP is extracted correctly from various header configurations
   */
  it('should extract source IP from x-forwarded-for or x-real-ip headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.uuid(),
        fc.ipV4(),
        fc.option(fc.ipV4(), { nil: undefined }),
        async (url, requestId, forwardedIp, realIp) => {
          // Clear mocks at the start of each iteration
          jest.clearAllMocks()
          mockSupabaseFrom.mockReturnValue({
            insert: mockSupabaseInsert.mockResolvedValue({ data: null, error: null }),
          })

          const headers: Record<string, string> = {}
          
          if (forwardedIp) {
            headers['x-forwarded-for'] = `${forwardedIp}, 10.0.0.1`
          }
          if (realIp) {
            headers['x-real-ip'] = realIp
          }

          const request = new NextRequest(url, { headers })

          await logSecurityEvent('suspicious_activity', request, requestId)

          // Get the last call for proper isolation
          const insertCall = mockSupabaseInsert.mock.calls[mockSupabaseInsert.mock.calls.length - 1][0]
          
          // Should use first IP from x-forwarded-for if available
          if (forwardedIp) {
            expect(insertCall.payload.source_ip).toBe(forwardedIp)
          } else if (realIp) {
            expect(insertCall.payload.source_ip).toBe(realIp)
          } else {
            expect(insertCall.payload.source_ip).toBe('unknown')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Test that endpoint is extracted from request URL or metadata
   */
  it('should extract endpoint from request URL or use provided endpoint in metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.uuid(),
        fc.option(fc.string(), { nil: undefined }),
        async (url, requestId, customEndpoint) => {
          // Clear mocks at the start of each iteration
          jest.clearAllMocks()
          mockSupabaseFrom.mockReturnValue({
            insert: mockSupabaseInsert.mockResolvedValue({ data: null, error: null }),
          })

          const request = new NextRequest(url)

          await logSecurityEvent('invalid_signature', request, requestId, {
            endpoint: customEndpoint,
          })

          // Get the last call for proper isolation
          const insertCall = mockSupabaseInsert.mock.calls[mockSupabaseInsert.mock.calls.length - 1][0]
          
          if (customEndpoint) {
            expect(insertCall.payload.endpoint).toBe(customEndpoint)
          } else {
            expect(insertCall.payload.endpoint).toBe(new URL(url).pathname)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
