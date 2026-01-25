/** @jest-environment node */

/**
 * Property-based tests for webhook metadata extraction
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 9: Metadata Extraction from Webhook (Requirements 4.3, 4.4, 4.5)
 */

// Set up environment variables before any imports
process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret_key_for_testing'
process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_mock_grid_plus'
process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_mock_grid_plus_premium'
process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_mock_creator_pack'

// Mock dependencies BEFORE importing
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))
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
  logPurchase: jest.fn(),
  grantCreatorPack: jest.fn(),
  fulfillSubscription: jest.fn(),
  fulfillCreatorPack: jest.fn(),
  checkIdempotency: jest.fn(),
}

describe('Feature: stripe-payment-integration - Webhook Metadata Extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(purchaseLogger.logPurchase as jest.Mock) = mockPurchaseLogger.logPurchase
    ;(purchaseLogger.grantCreatorPack as jest.Mock) = mockPurchaseLogger.grantCreatorPack
    ;(purchaseLogger.fulfillSubscription as jest.Mock) = mockPurchaseLogger.fulfillSubscription
    ;(purchaseLogger.fulfillCreatorPack as jest.Mock) = mockPurchaseLogger.fulfillCreatorPack
    ;(purchaseLogger.checkIdempotency as jest.Mock) = mockPurchaseLogger.checkIdempotency
    
    // Setup default mocks for database operations
    const defaultChain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    
    mockSupabase.from.mockReturnValue(defaultChain)
    mockPurchaseLogger.logPurchase.mockResolvedValue(undefined)
    mockPurchaseLogger.grantCreatorPack.mockResolvedValue(undefined)
    mockPurchaseLogger.fulfillSubscription.mockResolvedValue(undefined)
    mockPurchaseLogger.fulfillCreatorPack.mockResolvedValue(undefined)
    mockPurchaseLogger.checkIdempotency.mockResolvedValue(false)
  })

  /**
   * Property 9: Metadata Extraction from Webhook
   * For any valid checkout.session.completed webhook event, the system SHALL
   * successfully extract both user_id and product_type from the session metadata.
   * 
   * Validates: Requirements 4.3, 4.4, 4.5
   */
  describe('Property 9: Metadata Extraction from Webhook', () => {
    it('should extract user_id and product_type from any checkout session metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            productType: fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
            sessionId: fc.uuid().map(id => `cs_test_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            subscriptionId: fc.uuid().map(id => `sub_${id.replace(/-/g, '')}`),
            amountTotal: fc.integer({ min: 100, max: 100000 }),
            requestId: fc.uuid(),
          }),
          async ({ userId, productType, sessionId, customerId, subscriptionId, amountTotal, requestId }) => {
            // Setup mock to track if metadata was extracted correctly
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' } // No rows found - not processed yet
              }),
            }
            
            const quotaChain = {
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'generation_quotas') return quotaChain
              return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create a checkout session with metadata
            const session: Stripe.Checkout.Session = {
              id: sessionId,
              object: 'checkout.session',
              amount_total: amountTotal,
              customer: customerId,
              subscription: productType !== 'creator_pack' ? subscriptionId : null,
              metadata: {
                user_id: userId,
                product_type: productType,
              },
              // Required fields for Stripe.Checkout.Session type
              cancel_url: 'https://example.com/cancel',
              created: Math.floor(Date.now() / 1000),
              currency: 'usd',
              livemode: false,
              mode: productType === 'creator_pack' ? 'payment' : 'subscription',
              payment_status: 'paid',
              status: 'complete',
              success_url: 'https://example.com/success',
            } as Stripe.Checkout.Session

            // Ensure per-iteration call isolation
            mockPurchaseLogger.fulfillSubscription.mockClear()
            mockPurchaseLogger.fulfillCreatorPack.mockClear()

            // Act - process the checkout session
            await processCheckoutCompleted(session, requestId)

            // Assert: Metadata should be extracted and used
            // For subscriptions, fulfillSubscription should be called
            if (productType === 'grid_plus' || productType === 'grid_plus_premium') {
              const callArgs = mockPurchaseLogger.fulfillSubscription.mock.calls.at(-1)
              expect(callArgs).toEqual([
                userId,
                productType,
                customerId,
                subscriptionId,
                sessionId,
                amountTotal,
                true // isTestMode
              ])
            }
            
            // For creator packs, fulfillCreatorPack should be called
            if (productType === 'creator_pack') {
              const callArgs = mockPurchaseLogger.fulfillCreatorPack.mock.calls.at(-1)
              expect(callArgs).toEqual([
                userId,
                sessionId,
                amountTotal,
                false, // isFree
                true  // isTestMode
              ])
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should throw error when user_id is missing from metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            productType: fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
            sessionId: fc.uuid().map(id => `cs_test_${id.replace(/-/g, '')}`),
            requestId: fc.uuid(),
          }),
          async ({ productType, sessionId, requestId }) => {
            // Create session with missing user_id
            const session: Stripe.Checkout.Session = {
              id: sessionId,
              object: 'checkout.session',
              amount_total: 1000,
              customer: 'cus_test',
              metadata: {
                // user_id is missing
                product_type: productType,
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

            // Act & Assert: Should throw error
            await expect(
              processCheckoutCompleted(session, requestId)
            ).rejects.toThrow(/No customer email found|Missing product_type/)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should throw error when product_type is missing from metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            sessionId: fc.uuid().map(id => `cs_test_${id.replace(/-/g, '')}`),
            requestId: fc.uuid(),
          }),
          async ({ userId, sessionId, requestId }) => {
            // Create session with missing product_type
            const session: Stripe.Checkout.Session = {
              id: sessionId,
              object: 'checkout.session',
              amount_total: 1000,
              customer: 'cus_test',
              metadata: {
                user_id: userId,
                // product_type is missing
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

            // Act & Assert: Should throw error
            await expect(
              processCheckoutCompleted(session, requestId)
            ).rejects.toThrow(/No customer email found|Missing product_type/)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should throw error when both user_id and product_type are missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.uuid().map(id => `cs_test_${id.replace(/-/g, '')}`),
            requestId: fc.uuid(),
          }),
          async ({ sessionId, requestId }) => {
            // Create session with no metadata
            const session: Stripe.Checkout.Session = {
              id: sessionId,
              object: 'checkout.session',
              amount_total: 1000,
              customer: 'cus_test',
              metadata: {}, // Empty metadata
              cancel_url: 'https://example.com/cancel',
              created: Math.floor(Date.now() / 1000),
              currency: 'usd',
              livemode: false,
              mode: 'payment',
              payment_status: 'paid',
              status: 'complete',
              success_url: 'https://example.com/success',
            } as Stripe.Checkout.Session

            // Act & Assert: Should throw error
            await expect(
              processCheckoutCompleted(session, requestId)
            ).rejects.toThrow(/No customer email found|Missing product_type/)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
