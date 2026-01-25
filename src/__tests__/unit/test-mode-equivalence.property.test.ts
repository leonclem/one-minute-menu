/** @jest-environment node */

/**
 * Property-based tests for test mode processing equivalence
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 25: Test Mode Processing Equivalence (Requirements 9.4)
 */

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret_key_for_testing'
process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_mock_grid_plus'
process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_mock_grid_plus_premium'
process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_mock_creator_pack'

// Mock dependencies BEFORE importing
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/purchase-logger')

import { processCheckoutCompleted } from '@/lib/stripe-webhook-processor'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'
import fc from 'fast-check'
import Stripe from 'stripe'

const mockSupabase = {
  from: jest.fn(),
}

const mockPurchaseLogger = {
  fulfillSubscription: jest.fn(),
  fulfillCreatorPack: jest.fn(),
}

describe('Feature: stripe-payment-integration - Test Mode Processing Equivalence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(purchaseLogger.fulfillSubscription as jest.Mock) = mockPurchaseLogger.fulfillSubscription
    ;(purchaseLogger.fulfillCreatorPack as jest.Mock) = mockPurchaseLogger.fulfillCreatorPack
    
    mockPurchaseLogger.fulfillSubscription.mockResolvedValue(undefined)
    mockPurchaseLogger.fulfillCreatorPack.mockResolvedValue(undefined)
  })

  /**
   * Property 25: Test Mode Processing Equivalence
   * For any webhook event (test mode or production mode), the processing logic SHALL be identical
   * (same validation, same fulfillment, same logging).
   * 
   * Validates: Requirements 9.4
   */
  describe('Property 25: Test Mode Processing Equivalence', () => {
    it('should process test mode and production mode subscriptions identically', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            productType: fc.constantFrom('grid_plus', 'grid_plus_premium'),
            sessionId: fc.uuid().map(id => `cs_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            subscriptionId: fc.uuid().map(id => `sub_${id.replace(/-/g, '')}`),
            amountTotal: fc.integer({ min: 100, max: 100000 }),
            requestId: fc.uuid(),
          }),
          async ({ userId, productType, sessionId, customerId, subscriptionId, amountTotal, requestId }) => {
            // Setup mocks for both test and production mode
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: null, 
                error: null // Not processed yet
              }),
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' } // Not processed yet
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              return {
                select: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create test mode session
            const testSession: Stripe.Checkout.Session = {
              id: `${sessionId}_test`,
              object: 'checkout.session',
              amount_total: amountTotal,
              customer: customerId,
              subscription: subscriptionId,
              metadata: {
                user_id: userId,
                product_type: productType,
              },
              cancel_url: 'https://example.com/cancel',
              created: Math.floor(Date.now() / 1000),
              currency: 'usd',
              livemode: false, // Test mode
              mode: 'subscription',
              payment_status: 'paid',
              status: 'complete',
              success_url: 'https://example.com/success',
            } as Stripe.Checkout.Session

            // Create production mode session (identical except livemode)
            const prodSession: Stripe.Checkout.Session = {
              ...testSession,
              id: `${sessionId}_prod`,
              livemode: true, // Production mode
            } as Stripe.Checkout.Session

            // Act: Process test mode
            await processCheckoutCompleted(testSession, `${requestId}_test`)
            
            // Verify test mode called fulfillSubscription
            expect(mockPurchaseLogger.fulfillSubscription).toHaveBeenCalled()
            const testCallArgs = mockPurchaseLogger.fulfillSubscription.mock.calls[mockPurchaseLogger.fulfillSubscription.mock.calls.length - 1]

            // Reset ALL mocks including purchaseLogger
            jest.clearAllMocks()
            
            // Re-setup Supabase client mock
            ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
            ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
            
            // Re-setup purchaseLogger mocks after reset
            ;(purchaseLogger.fulfillSubscription as jest.Mock) = mockPurchaseLogger.fulfillSubscription
            mockPurchaseLogger.fulfillSubscription.mockResolvedValue(undefined)
            
            // Create fresh chains for production mode
            const prodPurchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: null, 
                error: null // Not processed yet
              }),
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' } // Not processed yet
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return prodPurchaseAuditChain
              return {
                select: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Process production mode
            await processCheckoutCompleted(prodSession, `${requestId}_prod`)

            // Assert: Production mode also called fulfillSubscription
            expect(mockPurchaseLogger.fulfillSubscription).toHaveBeenCalled()
            const prodCallArgs = mockPurchaseLogger.fulfillSubscription.mock.calls[mockPurchaseLogger.fulfillSubscription.mock.calls.length - 1]
            
            // Assert: Both modes called with same parameters (except isTestMode)
            expect(testCallArgs[0]).toBe(prodCallArgs[0]) // userId
            expect(testCallArgs[1]).toBe(prodCallArgs[1]) // productType
            expect(testCallArgs[2]).toBe(prodCallArgs[2]) // customerId
            expect(testCallArgs[3]).toBe(prodCallArgs[3]) // subscriptionId
            expect(testCallArgs[5]).toBe(prodCallArgs[5]) // amountCents
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should process test mode and production mode Creator Packs identically', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            sessionId: fc.uuid().map(id => `cs_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            amountTotal: fc.integer({ min: 100, max: 100000 }),
            requestId: fc.uuid(),
          }),
          async ({ userId, sessionId, customerId, amountTotal, requestId }) => {
            // Setup mocks for Creator Pack test
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: null, 
                error: null
              }),
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' }
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              return {
                select: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create test mode session
            const testSession: Stripe.Checkout.Session = {
              id: `${sessionId}_test`,
              object: 'checkout.session',
              amount_total: amountTotal,
              customer: customerId,
              subscription: null,
              metadata: {
                user_id: userId,
                product_type: 'creator_pack',
              },
              cancel_url: 'https://example.com/cancel',
              created: Math.floor(Date.now() / 1000),
              currency: 'usd',
              livemode: false,
              mode: 'payment',
              payment_status: 'paid',
              status: 'complete',
              success_url: 'https://example.com/success',
            } as Stripe.Checkout.Session

            // Create production mode session
            const prodSession: Stripe.Checkout.Session = {
              ...testSession,
              id: `${sessionId}_prod`,
              livemode: true,
            } as Stripe.Checkout.Session

            // Process test mode
            await processCheckoutCompleted(testSession, `${requestId}_test`)
            
            // Verify test mode called fulfillCreatorPack
            expect(mockPurchaseLogger.fulfillCreatorPack).toHaveBeenCalled()
            const testCallArgs = mockPurchaseLogger.fulfillCreatorPack.mock.calls[mockPurchaseLogger.fulfillCreatorPack.mock.calls.length - 1]

            // Reset ALL mocks including purchaseLogger
            jest.clearAllMocks()
            
            // Re-setup Supabase client mock
            ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
            ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
            
            // Re-setup purchaseLogger mocks after reset
            ;(purchaseLogger.fulfillCreatorPack as jest.Mock) = mockPurchaseLogger.fulfillCreatorPack
            mockPurchaseLogger.fulfillCreatorPack.mockResolvedValue(undefined)
            
            // Create fresh chains for production mode
            const prodPurchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: null, 
                error: null
              }),
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' }
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return prodPurchaseAuditChain
              return {
                select: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Process production mode
            await processCheckoutCompleted(prodSession, `${requestId}_prod`)

            // Assert: Production mode also called fulfillCreatorPack
            expect(mockPurchaseLogger.fulfillCreatorPack).toHaveBeenCalled()
            const prodCallArgs = mockPurchaseLogger.fulfillCreatorPack.mock.calls[mockPurchaseLogger.fulfillCreatorPack.mock.calls.length - 1]
            
            // Assert: Both modes called with same parameters (except isTestMode)
            expect(testCallArgs[0]).toBe(prodCallArgs[0]) // userId
            expect(testCallArgs[2]).toBe(prodCallArgs[2]) // amountCents
            expect(testCallArgs[3]).toBe(prodCallArgs[3]) // isFree
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should perform same validation checks regardless of test mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.uuid().map(id => `cs_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            amountTotal: fc.integer({ min: 100, max: 100000 }),
            requestId: fc.uuid(),
            livemode: fc.boolean(),
          }),
          async ({ sessionId, customerId, amountTotal, requestId, livemode }) => {
            // Setup mocks for validation test
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: null, 
                error: null
              }),
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' }
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              return {
                select: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create session with missing metadata (invalid)
            const invalidSession: Stripe.Checkout.Session = {
              id: sessionId,
              object: 'checkout.session',
              amount_total: amountTotal,
              customer: customerId,
              subscription: null,
              metadata: {}, // Missing required metadata
              cancel_url: 'https://example.com/cancel',
              created: Math.floor(Date.now() / 1000),
              currency: 'usd',
              livemode,
              mode: 'payment',
              payment_status: 'paid',
              status: 'complete',
              success_url: 'https://example.com/success',
            } as Stripe.Checkout.Session

            // Act & Assert: Should throw error regardless of test mode
            await expect(processCheckoutCompleted(invalidSession, requestId)).rejects.toThrow(
              /Missing product_type in checkout session metadata/
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
