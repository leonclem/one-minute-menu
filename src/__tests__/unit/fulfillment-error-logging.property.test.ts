/**
 * Property-Based Tests for Fulfillment Error Logging
 * Feature: stripe-payment-integration, Property 33: Fulfillment Error Logging
 * Validates: Requirements 5.7, 6.6, 12.2
 */

import * as fc from 'fast-check'
import { purchaseLogger } from '@/lib/purchase-logger'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock the Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

// Spy on console.error
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

describe('Property 33: Fulfillment Error Logging', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    consoleErrorSpy.mockClear()
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should log subscription fulfillment errors with full context (user_id, transaction_id, error message, stack trace)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom('grid_plus' as const, 'grid_plus_premium' as const),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `cus_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `sub_${s}`),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        fc.integer({ min: 100, max: 100000 }),
        
        async (userId, plan, stripeCustomerId, stripeSubscriptionId, transactionId, amountCents) => {
          // Clear console spy for this iteration
          consoleErrorSpy.mockClear()
          
          // Create fresh mock that will cause an error
          const testError = new Error('Database connection failed')
          const mockUpdate = jest.fn().mockRejectedValue(testError)
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
          const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'purchase_audit') {
              return { select: mockSelect }
            } else if (table === 'profiles') {
              return { update: jest.fn().mockReturnValue({ eq: mockUpdate }) }
            }
            return {}
          })
          
          const mockSupabase = { from: mockFrom }
          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          
          // Execute: Fulfill subscription (should fail and log error)
          try {
            await purchaseLogger.fulfillSubscription(
              userId,
              plan,
              stripeCustomerId,
              stripeSubscriptionId,
              transactionId,
              amountCents
            )
            // Should not reach here
            expect(true).toBe(false)
          } catch (error) {
            // Expected to throw
          }
          
          // Verify: Error was logged with context
          expect(consoleErrorSpy).toHaveBeenCalled()
          
          // Verify: Log includes user_id in context object
          const errorLog = consoleErrorSpy.mock.calls[0]
          const logMessage = errorLog[0]
          const errorContext = errorLog[1]
          
          expect(logMessage).toContain('Failed to fulfill subscription')
          expect(errorContext.userId).toBe(userId)
          expect(errorContext.plan).toBe(plan)
          expect(errorContext.transactionId).toBe(transactionId)
          expect(errorContext.error).toBe(testError.message)
          expect(errorContext.stack).toBe(testError.stack)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should log Creator Pack fulfillment errors with full context (user_id, transaction_id, error message)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        fc.integer({ min: 100, max: 100000 }),
        fc.boolean(),
        
        async (userId, transactionId, amountCents, isFree) => {
          // Clear console spy for this iteration
          consoleErrorSpy.mockClear()
          
          // Create fresh mock that will cause an error
          const testError = new Error('Pack creation failed')
          const mockPackInsert = jest.fn().mockRejectedValue(testError)
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
          const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'purchase_audit') {
              return { select: mockSelect }
            } else if (table === 'user_packs') {
              return { insert: mockPackInsert }
            }
            return {}
          })
          
          const mockSupabase = { from: mockFrom }
          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          
          // Execute: Fulfill Creator Pack (should fail and log error)
          try {
            await purchaseLogger.fulfillCreatorPack(
              userId,
              transactionId,
              amountCents,
              isFree
            )
            // Should not reach here
            expect(true).toBe(false)
          } catch (error) {
            // Expected to throw
          }
          
          // Verify: Error was logged with context
          expect(consoleErrorSpy).toHaveBeenCalled()
          
          // Verify: Log includes user_id in context object
          const errorLog = consoleErrorSpy.mock.calls[0]
          const logMessage = errorLog[0]
          const errorContext = errorLog[1]
          
          expect(logMessage).toContain('Exception granting creator pack')
          expect(errorContext.userId).toBe(userId)
          expect(errorContext.error).toBe(testError.message)
          expect(errorContext.stack).toBe(testError.stack)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should log cancellation errors with full context (user_id, subscription_id, error message)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `sub_${s}`),
        fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: undefined }),
        
        async (userId, stripeSubscriptionId, reason) => {
          // Clear console spy for this iteration
          consoleErrorSpy.mockClear()
          
          // Create fresh mock that will cause an error
          const testError = new Error('Cancellation update failed')
          const mockInsertSingle = jest.fn().mockRejectedValue(testError)
          const mockInsertSelect = jest.fn().mockReturnValue({ single: mockInsertSingle })
          const mockInsert = jest.fn().mockReturnValue({ select: mockInsertSelect })
          const mockFrom = jest.fn((table: string) => {
            if (table === 'purchase_audit') {
              return { insert: mockInsert }
            }
            if (table === 'profiles') {
              return { 
                update: jest.fn().mockReturnValue({ 
                  eq: jest.fn().mockReturnValue({ 
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }) 
                  }) 
                }) 
              }
            }
            return {}
          })
          
          const mockSupabase = { from: mockFrom }
          ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
          
          // Execute: Cancel subscription (should fail and log error)
          try {
            await purchaseLogger.cancelSubscription(
              userId,
              stripeSubscriptionId,
              reason
            )
            // Should not reach here
            expect(true).toBe(false)
          } catch (error) {
            // Expected to throw
          }
          
          // Verify: Error was logged with context
          expect(consoleErrorSpy).toHaveBeenCalled()
          
          // Verify: Log includes user_id in context object
          const errorLog = consoleErrorSpy.mock.calls[0]
          const logMessage = errorLog[0]
          const errorContext = errorLog[1]
          
          expect(logMessage).toContain('Failed to cancel subscription')
          expect(errorContext.userId).toBe(userId)
          expect(errorContext.stripeSubscriptionId).toBe(stripeSubscriptionId)
          expect(errorContext.error).toBe(testError.message)
          expect(errorContext.stack).toBe(testError.stack)
        }
      ),
      { numRuns: 100 }
    )
  })
})
