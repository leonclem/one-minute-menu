/** @jest-environment node */

/**
 * Property-based tests for Creator Pack audit logging
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 16: Creator Pack Fulfillment Creates Audit Log (Requirements 6.4)
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
    sendCreatorPackConfirmation: jest.fn().mockResolvedValue(undefined),
  }
}))

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'
import fc from 'fast-check'

const mockSupabase = {
  from: jest.fn(),
}

describe('Feature: stripe-payment-integration - Creator Pack Audit Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  /**
   * Property 16: Creator Pack Fulfillment Creates Audit Log
   * For any Creator Pack grant (paid or free), the system SHALL create a purchase_audit
   * record with status='success' and productId='creator_pack'.
   * 
   * Validates: Requirements 6.4
   */
  describe('Property 16: Creator Pack Fulfillment Creates Audit Log', () => {
    it('should create purchase_audit record with status=success, product_id=creator_pack, and correct amount_cents for any Creator Pack grant', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
          fc.integer({ min: 100, max: 100000 }),
          fc.boolean(),
          async (userId, transactionId, amountCents, isFree) => {
            // Setup mocks
            let capturedAuditRecord: any = null
            const purchaseAuditChain = {
              insert: jest.fn().mockImplementation((record) => {
                capturedAuditRecord = record
                return purchaseAuditChain
              }),
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: null, 
                error: null
              }),
              single: jest.fn().mockResolvedValue({ 
                data: { id: 'audit_123' }, 
                error: null 
              }),
            }
            
            const userPackChain = {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'user_packs') return userPackChain
              return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Fulfill Creator Pack
            await purchaseLogger.fulfillCreatorPack(userId, transactionId, amountCents, isFree, false)

            // Assert: purchase_audit record should be created with correct details
            expect(purchaseAuditChain.insert).toHaveBeenCalled()
            expect(capturedAuditRecord).toBeTruthy()
            expect(capturedAuditRecord.user_id).toBe(userId)
            expect(capturedAuditRecord.transaction_id).toBe(transactionId)
            expect(capturedAuditRecord.product_id).toBe('creator_pack')
            expect(capturedAuditRecord.amount_cents).toBe(amountCents)
            expect(capturedAuditRecord.status).toBe('success')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not create audit log if transaction already processed (idempotency)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
          fc.integer({ min: 100, max: 100000 }),
          fc.boolean(),
          async (userId, transactionId, amountCents, isFree) => {
            // Setup mocks: transaction already exists
            const purchaseAuditChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ 
                data: { id: 'audit_123', transaction_id: transactionId }, 
                error: null 
              }),
              insert: jest.fn().mockReturnThis(),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Fulfill Creator Pack
            await purchaseLogger.fulfillCreatorPack(userId, transactionId, amountCents, isFree, false)

            // Assert: Audit record should NOT be created (idempotency)
            expect(purchaseAuditChain.insert).not.toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
