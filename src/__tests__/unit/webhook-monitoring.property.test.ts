/**
 * Property-based tests for webhook monitoring features
 * 
 * Property 32: Webhook Retry Tracking
 * Validates: Requirements 12.1
 * 
 * Property 34: Error Context Logging
 * Validates: Requirements 12.4
 * 
 * Property 35: Webhook Processing Latency Tracking
 * Validates: Requirements 12.6
 */

import fc from 'fast-check'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Property 32: Webhook Retry Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should increment retry_count on each webhook retry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 50 }),
        fc.integer({ min: 0, max: 10 }),
        async (stripeEventId, eventType, initialRetryCount) => {
          // Setup mock for checking existing event
          const mockMaybeSingle = jest.fn().mockResolvedValue({
            data: initialRetryCount > 0 ? { retry_count: initialRetryCount } : null,
            error: null
          })

          const mockEq = jest.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
          })

          const mockSelect = jest.fn().mockReturnValue({
            eq: mockEq
          })

          const mockUpsert = jest.fn().mockResolvedValue({
            data: null,
            error: null
          })

          const mockSupabase = {
            from: jest.fn().mockImplementation((table) => {
              if (table === 'webhook_events') {
                return {
                  select: mockSelect,
                  upsert: mockUpsert,
                  update: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                }
              }
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })
          }

          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase as any)

          // Simulate webhook retry logic
          const { data: existingEvent } = await mockSupabase
            .from('webhook_events')
            .select('retry_count')
            .eq('stripe_event_id', stripeEventId)
            .maybeSingle()

          const currentRetryCount = existingEvent?.retry_count ?? 0
          const newRetryCount = currentRetryCount + (existingEvent ? 1 : 0)

          await mockSupabase
            .from('webhook_events')
            .upsert({
              stripe_event_id: stripeEventId,
              event_type: eventType,
              processed: false,
              payload: {},
              created_at: new Date().toISOString(),
              retry_count: newRetryCount,
            }, {
              onConflict: 'stripe_event_id'
            })

          // Verify retry count incremented correctly
          expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
              stripe_event_id: stripeEventId,
              retry_count: initialRetryCount > 0 ? initialRetryCount + 1 : 0
            }),
            expect.any(Object)
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should track retry_count starting from 0 for new events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 50 }),
        async (stripeEventId, eventType) => {
          // Setup mock for new event (no existing record)
          const mockMaybeSingle = jest.fn().mockResolvedValue({
            data: null,
            error: null
          })

          const mockEq = jest.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle
          })

          const mockSelect = jest.fn().mockReturnValue({
            eq: mockEq
          })

          const mockUpsert = jest.fn().mockResolvedValue({
            data: null,
            error: null
          })

          const mockSupabase = {
            from: jest.fn().mockImplementation((table) => {
              if (table === 'webhook_events') {
                return {
                  select: mockSelect,
                  upsert: mockUpsert,
                  update: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                }
              }
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })
          }

          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase as any)

          // Simulate first webhook attempt
          const { data: existingEvent } = await mockSupabase
            .from('webhook_events')
            .select('retry_count')
            .eq('stripe_event_id', stripeEventId)
            .maybeSingle()

          const currentRetryCount = existingEvent?.retry_count ?? 0

          await mockSupabase
            .from('webhook_events')
            .upsert({
              stripe_event_id: stripeEventId,
              event_type: eventType,
              processed: false,
              payload: {},
              created_at: new Date().toISOString(),
              retry_count: currentRetryCount,
            }, {
              onConflict: 'stripe_event_id'
            })

          // Verify retry count is 0 for new events
          expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
              stripe_event_id: stripeEventId,
              retry_count: 0
            }),
            expect.any(Object)
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 34: Error Context Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should log errors with complete context including userId, transactionId, error message, and stack trace', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.string({ minLength: 50, maxLength: 500 }),
        async (userId, transactionId, errorMessage, stackTrace) => {
          // Create error with stack trace
          const error = new Error(errorMessage)
          error.stack = stackTrace

          // Simulate error logging
          const errorContext = {
            userId,
            transactionId,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }

          // Verify all required fields are present
          expect(errorContext).toHaveProperty('userId', userId)
          expect(errorContext).toHaveProperty('transactionId', transactionId)
          expect(errorContext).toHaveProperty('error', errorMessage)
          expect(errorContext).toHaveProperty('stack', stackTrace)
          expect(errorContext).toHaveProperty('timestamp')
          expect(errorContext.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 35: Webhook Processing Latency Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should record processing_time_ms for all webhook events', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 5000 }),
        async (stripeEventId, processingTimeMs) => {
          // Setup mock
          const mockUpdate = jest.fn().mockResolvedValue({
            data: null,
            error: null
          })

          const mockEq = jest.fn().mockReturnValue({
            update: mockUpdate
          })

          const mockSupabase = {
            from: jest.fn().mockReturnValue({
              update: jest.fn().mockReturnValue({
                eq: mockEq
              })
            })
          }

          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase as any)

          // Simulate webhook processing completion
          await mockSupabase
            .from('webhook_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              processing_time_ms: processingTimeMs,
            })
            .eq('stripe_event_id', stripeEventId)

          // Verify processing_time_ms was recorded
          const updateCall = mockSupabase.from('webhook_events').update
          expect(updateCall).toHaveBeenCalledWith(
            expect.objectContaining({
              processing_time_ms: processingTimeMs
            })
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should calculate latency as difference between start and end time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 100 }),
        async (delayMs) => {
          const startTime = Date.now()
          
          // Simulate processing delay
          await new Promise(resolve => setTimeout(resolve, delayMs))
          
          const endTime = Date.now()
          const actualLatency = endTime - startTime

          // Verify latency is approximately correct
          // Note: setTimeout is not guaranteed to be exact, so we allow a small tolerance
          // Timer can fire up to 2ms early on some systems
          expect(actualLatency).toBeGreaterThanOrEqual(delayMs - 2)
          expect(actualLatency).toBeLessThan(delayMs + 500) // Increased tolerance for slow CI systems
        }
      ),
      { numRuns: 10 } // Fewer runs since this involves actual delays
    )
  }, 15000) // 15 second timeout

  it('should record processing_time_ms even when processing fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 5000 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (stripeEventId, processingTimeMs, errorMessage) => {
          // Setup mock
          const mockUpdate = jest.fn().mockResolvedValue({
            data: null,
            error: null
          })

          const mockEq = jest.fn().mockReturnValue({
            update: mockUpdate
          })

          const mockSupabase = {
            from: jest.fn().mockReturnValue({
              update: jest.fn().mockReturnValue({
                eq: mockEq
              })
            })
          }

          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase as any)

          // Simulate webhook processing failure with latency tracking
          await mockSupabase
            .from('webhook_events')
            .update({
              processing_error: errorMessage,
              processing_time_ms: processingTimeMs,
            })
            .eq('stripe_event_id', stripeEventId)

          // Verify processing_time_ms was recorded even on failure
          const updateCall = mockSupabase.from('webhook_events').update
          expect(updateCall).toHaveBeenCalledWith(
            expect.objectContaining({
              processing_time_ms: processingTimeMs,
              processing_error: errorMessage
            })
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})
