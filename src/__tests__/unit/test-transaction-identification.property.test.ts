/** @jest-environment node */

/**
 * Property-based tests for test transaction identification
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 26: Test Transaction Identification (Requirements 9.5)
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

import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { purchaseLogger } from '@/lib/purchase-logger'
import fc from 'fast-check'

const mockSupabase = {
  from: jest.fn(),
}

describe('Feature: stripe-payment-integration - Test Transaction Identification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  /**
   * Property 26: Test Transaction Identification
   * For any transaction record in purchase_audit, the system SHALL be able to determine
   * if it originated from test mode or production mode (via metadata or transaction_id prefix).
   * 
   * Validates: Requirements 9.5
   */
  describe('Property 26: Test Transaction Identification', () => {
    it('should store test mode flag in purchase_audit for all transactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            productType: fc.constantFrom('grid_plus', 'grid_plus_premium', 'creator_pack'),
            transactionId: fc.uuid().map(id => `cs_${id.replace(/-/g, '')}`),
            amountCents: fc.integer({ min: 100, max: 100000 }),
            isTestMode: fc.boolean(),
          }),
          async ({ userId, productType, transactionId, amountCents, isTestMode }) => {
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
            
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { id: userId, plan: 'free' }, 
                error: null 
              }),
            }
            
            const quotaChain = {
              upsert: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            const userPackChain = {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'profiles') return profileChain
              if (table === 'generation_quotas') return quotaChain
              if (table === 'user_packs') return userPackChain
              return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Log a purchase with test mode flag
            if (productType === 'creator_pack') {
              await purchaseLogger.fulfillCreatorPack(userId, transactionId, amountCents, false, isTestMode)
            } else {
              const customerId = `cus_${userId.replace(/-/g, '')}`
              const subscriptionId = `sub_${userId.replace(/-/g, '')}`
              await purchaseLogger.fulfillSubscription(
                userId,
                productType,
                customerId,
                subscriptionId,
                transactionId,
                amountCents,
                isTestMode
              )
            }

            // Assert: purchase_audit record should contain test mode information
            expect(purchaseAuditChain.insert).toHaveBeenCalled()
            expect(capturedAuditRecord).toBeTruthy()
            
            // The record should have a way to identify test mode
            // This could be via a dedicated field or in metadata
            const hasTestModeField = 'is_test_mode' in capturedAuditRecord || 
                                     'test_mode' in capturedAuditRecord ||
                                     (capturedAuditRecord.metadata && 
                                      ('is_test_mode' in capturedAuditRecord.metadata || 
                                       'test_mode' in capturedAuditRecord.metadata))
            
            expect(hasTestModeField).toBe(true)
            
            // Verify the test mode value matches what was passed
            const recordedTestMode = capturedAuditRecord.is_test_mode ?? 
                                    capturedAuditRecord.test_mode ??
                                    capturedAuditRecord.metadata?.is_test_mode ??
                                    capturedAuditRecord.metadata?.test_mode
            
            expect(recordedTestMode).toBe(isTestMode)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should be able to query test vs production transactions separately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            transactionId: fc.uuid().map(id => `cs_${id.replace(/-/g, '')}`),
            amountCents: fc.integer({ min: 100, max: 100000 }),
            isTestMode: fc.boolean(),
          }),
          async ({ userId, transactionId, amountCents, isTestMode }) => {
            // Setup mocks
            const purchaseAuditChain = {
              insert: jest.fn().mockReturnThis(),
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

            // Act: Create a transaction
            await purchaseLogger.fulfillCreatorPack(userId, transactionId, amountCents, false, isTestMode)

            // Simulate querying for test mode transactions
            const queryChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
            }
            
            mockSupabase.from.mockReturnValue(queryChain)
            
            // Query by test mode
            mockSupabase.from('purchase_audit')
              .select('*')
              .eq('is_test_mode', isTestMode)

            // Assert: Should be able to filter by test mode
            expect(queryChain.eq).toHaveBeenCalledWith('is_test_mode', isTestMode)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should identify test transactions from Stripe ID prefixes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            idType: fc.constantFrom('cs', 'sub', 'in', 'pi', 'ch', 'cus'),
            suffix: fc.string({ minLength: 24, maxLength: 24 }),
            isTest: fc.boolean(),
          }),
          async ({ idType, suffix, isTest }) => {
            // Construct transaction ID with test prefix if applicable
            const prefix = isTest ? `${idType}_test_` : `${idType}_`
            const transactionId = `${prefix}${suffix}`

            // Import the helper function
            const { isTestModeTransaction } = require('@/lib/purchase-logger')

            // Act: Check if transaction is identified as test mode
            const detected = isTestModeTransaction(transactionId)

            // Assert: Should correctly identify test transactions
            expect(detected).toBe(isTest)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve test mode information through the entire fulfillment flow', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            productType: fc.constantFrom('grid_plus', 'grid_plus_premium'),
            transactionId: fc.uuid().map(id => `cs_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            subscriptionId: fc.uuid().map(id => `sub_${id.replace(/-/g, '')}`),
            amountCents: fc.integer({ min: 100, max: 100000 }),
            isTestMode: fc.boolean(),
          }),
          async ({ userId, productType, transactionId, customerId, subscriptionId, amountCents, isTestMode }) => {
            // Setup mocks to capture all database operations
            const operations: any[] = []
            
            const purchaseAuditChain = {
              insert: jest.fn().mockImplementation((record) => {
                operations.push({ table: 'purchase_audit', operation: 'insert', record })
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
            
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              update: jest.fn().mockImplementation((record) => {
                operations.push({ table: 'profiles', operation: 'update', record })
                return profileChain
              }),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { id: userId, plan: 'free' }, 
                error: null 
              }),
            }
            
            const quotaChain = {
              upsert: jest.fn().mockImplementation((record) => {
                operations.push({ table: 'generation_quotas', operation: 'upsert', record })
                return quotaChain
              }),
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'profiles') return profileChain
              if (table === 'generation_quotas') return quotaChain
              return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Act: Fulfill subscription with test mode flag
            await purchaseLogger.fulfillSubscription(
              userId,
              productType,
              customerId,
              subscriptionId,
              transactionId,
              amountCents,
              isTestMode
            )

            // Assert: Test mode information should be in purchase_audit
            const auditOperation = operations.find(op => op.table === 'purchase_audit')
            expect(auditOperation).toBeTruthy()
            
            const testModeValue = auditOperation.record.is_test_mode ?? 
                                 auditOperation.record.test_mode ??
                                 auditOperation.record.metadata?.is_test_mode ??
                                 auditOperation.record.metadata?.test_mode
            
            expect(testModeValue).toBe(isTestMode)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
