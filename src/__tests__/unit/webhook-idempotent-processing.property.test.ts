/** @jest-environment node */

/**
 * Property-based tests for idempotent webhook processing
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 3: Idempotent Webhook Processing (Requirements 4.6, 14.6)
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
jest.mock('@/lib/notification-service', () => ({
  notificationService: {
    sendSubscriptionConfirmation: jest.fn().mockResolvedValue(undefined),
    sendCreatorPackConfirmation: jest.fn().mockResolvedValue(undefined),
    sendPaymentFailedNotification: jest.fn().mockResolvedValue(undefined),
    sendSubscriptionCancelledNotification: jest.fn().mockResolvedValue(undefined),
  },
}))

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'
import fc from 'fast-check'

const mockSupabase = {
  from: jest.fn(),
}

describe('Feature: stripe-payment-integration - Idempotent Webhook Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  /**
   * Property 3: Idempotent Webhook Processing
   * For any webhook event processed multiple times with the same stripe_event_id,
   * the system SHALL produce the same database state as processing it once
   * (no duplicate fulfillments, no duplicate audit logs).
   * 
   * Validates: Requirements 4.6, 14.6
   */
  describe('Property 3: Idempotent Webhook Processing', () => {
    it('should not duplicate fulfillment when processing same transaction twice', async () => {
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
          async ({ userId, productType, sessionId, customerId, subscriptionId, amountTotal }) => {
            // Setup mocks for first processing (transaction not yet processed)
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            // First call: transaction not found (not processed yet)
            // Second call: transaction found (already processed)
            let callCount = 0
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                  // First call: not processed yet
                  return Promise.resolve({ 
                    data: null, 
                    error: null
                  })
                } else {
                  // Second call: already processed
                  return Promise.resolve({ 
                    data: { id: 'audit_123', transaction_id: sessionId }, 
                    error: null 
                  })
                }
              }),
              single: jest.fn().mockResolvedValue({ data: { id: 'audit_123' }, error: null }),
            }
            
            const quotaChain = {
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }

            const userPackChain = {
              insert: jest.fn().mockReturnThis(),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'generation_quotas') return quotaChain
              if (table === 'user_packs') return userPackChain
              return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act - process the same transaction twice
            if (productType === 'creator_pack') {
              await purchaseLogger.fulfillCreatorPack(userId, sessionId, amountTotal, false, false)
            } else {
              await purchaseLogger.fulfillSubscription(
                userId,
                productType,
                customerId,
                subscriptionId,
                sessionId,
                amountTotal,
                false
              )
            }
            
            // Reset mock call counts for second processing
            const firstCallCounts = {
              profileUpdate: profileChain.update.mock.calls.length,
              userPackInsert: userPackChain.insert.mock.calls.length,
              auditInsert: purchaseAuditChain.insert.mock.calls.length,
            }
            
            // Process again with same transaction ID
            if (productType === 'creator_pack') {
              await purchaseLogger.fulfillCreatorPack(userId, sessionId, amountTotal, false, false)
            } else {
              await purchaseLogger.fulfillSubscription(
                userId,
                productType,
                customerId,
                subscriptionId,
                sessionId,
                amountTotal,
                false
              )
            }

            // Assert: Second processing should be skipped (idempotent)
            // The counts should not increase after second processing
            if (productType === 'grid_plus' || productType === 'grid_plus_premium') {
              expect(profileChain.update.mock.calls.length).toBe(firstCallCounts.profileUpdate)
            }
            
            if (productType === 'creator_pack') {
              expect(userPackChain.insert.mock.calls.length).toBe(firstCallCounts.userPackInsert)
            }
            
            // Purchase logging should not happen twice
            expect(purchaseAuditChain.insert.mock.calls.length).toBe(firstCallCounts.auditInsert)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should check idempotency before any database modifications', async () => {
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
          async ({ userId, productType, sessionId, customerId, subscriptionId, amountTotal }) => {
            // Setup mocks - transaction already processed
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            // Transaction already exists (already processed)
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: { id: 'audit_123', transaction_id: sessionId }, 
                error: null 
              }),
              single: jest.fn().mockResolvedValue({ data: { id: 'audit_123' }, error: null }),
            }
            
            const quotaChain = {
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }

            const userPackChain = {
              insert: jest.fn().mockReturnThis(),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'generation_quotas') return quotaChain
              if (table === 'user_packs') return userPackChain
              return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act - process already-processed transaction
            if (productType === 'creator_pack') {
              await purchaseLogger.fulfillCreatorPack(userId, sessionId, amountTotal, false, false)
            } else {
              await purchaseLogger.fulfillSubscription(
                userId,
                productType,
                customerId,
                subscriptionId,
                sessionId,
                amountTotal,
                false
              )
            }

            // Assert: No database modifications should occur
            expect(profileChain.update).not.toHaveBeenCalled()
            expect(profileChain.insert).not.toHaveBeenCalled()
            expect(quotaChain.upsert).not.toHaveBeenCalled()
            expect(userPackChain.insert).not.toHaveBeenCalled()
            expect(purchaseAuditChain.insert).not.toHaveBeenCalled()
            
            // Only the idempotency check should have been performed
            expect(purchaseAuditChain.select).toHaveBeenCalled()
            expect(purchaseAuditChain.eq).toHaveBeenCalledWith('transaction_id', sessionId)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use transaction_id as idempotency key', async () => {
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
          async ({ userId, productType, sessionId, customerId, subscriptionId, amountTotal }) => {
            // Setup mocks
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              insert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: null, 
                error: null
              }),
              single: jest.fn().mockResolvedValue({ data: { id: 'audit_123' }, error: null }),
            }
            
            const quotaChain = {
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }

            const userPackChain = {
              insert: jest.fn().mockReturnThis(),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'profiles') return profileChain
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'generation_quotas') return quotaChain
              if (table === 'user_packs') return userPackChain
              return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act
            if (productType === 'creator_pack') {
              await purchaseLogger.fulfillCreatorPack(userId, sessionId, amountTotal, false, false)
            } else {
              await purchaseLogger.fulfillSubscription(
                userId,
                productType,
                customerId,
                subscriptionId,
                sessionId,
                amountTotal,
                false
              )
            }

            // Assert: Idempotency check should use session.id as transaction_id
            expect(purchaseAuditChain.select).toHaveBeenCalled()
            expect(purchaseAuditChain.eq).toHaveBeenCalledWith('transaction_id', sessionId)
            expect(purchaseAuditChain.maybeSingle).toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
