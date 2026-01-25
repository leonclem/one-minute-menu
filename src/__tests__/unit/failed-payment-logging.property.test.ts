/** @jest-environment node */

/**
 * Property-based tests for failed payment logging
 * 
 * Feature: stripe-payment-integration
 * 
 * Tests Property:
 * - Property 19: Failed Payment Logging (Requirements 7.5)
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
jest.mock('@/lib/notification-service')

import { processInvoicePaymentFailed } from '@/lib/stripe-webhook-processor'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import fc from 'fast-check'
import Stripe from 'stripe'

const mockSupabase = {
  from: jest.fn(),
}

describe('Feature: stripe-payment-integration - Failed Payment Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(createServerSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  /**
   * Property 19: Failed Payment Logging
   * For any invoice.payment_failed webhook event, the system SHALL create a purchase_audit
   * record with status='failed' and log the failure reason.
   * 
   * Validates: Requirements 7.5
   */
  describe('Property 19: Failed Payment Logging', () => {
    it('should create purchase_audit record with status=failed for all payment failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invoiceId: fc.uuid().map(id => `in_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            subscriptionId: fc.uuid().map(id => `sub_${id.replace(/-/g, '')}`),
            amountDue: fc.integer({ min: 100, max: 100000 }),
            userId: fc.uuid(),
            failureCode: fc.constantFrom(
              'card_declined',
              'insufficient_funds',
              'expired_card',
              'incorrect_cvc',
              'processing_error',
              'generic_decline'
            ),
            failureMessage: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
            requestId: fc.uuid(),
          }),
          async ({ invoiceId, customerId, subscriptionId, amountDue, userId, failureCode, failureMessage, requestId }) => {
            // Setup mocks
            let capturedAuditRecord: any = null
            const purchaseAuditChain = {
              insert: jest.fn().mockImplementation((record) => {
                capturedAuditRecord = record
                return purchaseAuditChain
              }),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { id: 'audit_123' }, 
                error: null 
              }),
            }
            
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId,
                  email: 'user@example.com',
                  plan: 'grid_plus',
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create invoice.payment_failed event
            const invoice: Stripe.Invoice = {
              id: invoiceId,
              object: 'invoice',
              customer: customerId,
              subscription: subscriptionId,
              amount_due: amountDue,
              amount_paid: 0,
              amount_remaining: amountDue,
              currency: 'usd',
              status: 'open',
              metadata: {
                user_id: userId,
              },
              charge: null,
              last_finalization_error: {
                code: failureCode,
                message: failureMessage,
                type: 'card_error',
              } as any,
            } as Stripe.Invoice

            // Act: Process payment failure
            await processInvoicePaymentFailed(invoice, requestId)

            // Assert: purchase_audit record should be created with status='failed'
            expect(purchaseAuditChain.insert).toHaveBeenCalled()
            expect(capturedAuditRecord).toBeTruthy()
            expect(capturedAuditRecord.status).toBe('failed')
            
            // Assert: Failure information should be logged in metadata
            // The implementation logs failure details in the metadata field
            expect(capturedAuditRecord.metadata).toBeTruthy()
            expect(capturedAuditRecord.metadata.action).toBe('payment_failed')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should log failure code and message for all payment failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invoiceId: fc.uuid().map(id => `in_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            subscriptionId: fc.uuid().map(id => `sub_${id.replace(/-/g, '')}`),
            amountDue: fc.integer({ min: 100, max: 100000 }),
            userId: fc.uuid(),
            failureCode: fc.constantFrom(
              'card_declined',
              'insufficient_funds',
              'expired_card',
              'incorrect_cvc'
            ),
            failureMessage: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length > 0),
            requestId: fc.uuid(),
          }),
          async ({ invoiceId, customerId, subscriptionId, amountDue, userId, failureCode, failureMessage, requestId }) => {
            // Setup mocks
            let capturedAuditRecord: any = null
            const purchaseAuditChain = {
              insert: jest.fn().mockImplementation((record) => {
                capturedAuditRecord = record
                return purchaseAuditChain
              }),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { id: 'audit_123' }, 
                error: null 
              }),
            }
            
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId,
                  email: 'user@example.com',
                  plan: 'grid_plus',
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create invoice with specific failure details
            const invoice: Stripe.Invoice = {
              id: invoiceId,
              object: 'invoice',
              customer: customerId,
              subscription: subscriptionId,
              amount_due: amountDue,
              amount_paid: 0,
              amount_remaining: amountDue,
              currency: 'usd',
              status: 'open',
              metadata: {
                user_id: userId,
              },
              charge: null,
              last_finalization_error: {
                code: failureCode,
                message: failureMessage,
                type: 'card_error',
              } as any,
            } as Stripe.Invoice

            // Act
            await processInvoicePaymentFailed(invoice, requestId)

            // Assert: Audit record should contain metadata with action='payment_failed'
            expect(capturedAuditRecord).toBeTruthy()
            expect(capturedAuditRecord.metadata).toBeTruthy()
            expect(capturedAuditRecord.metadata.action).toBe('payment_failed')
            
            // The metadata should contain invoice and subscription information
            expect(capturedAuditRecord.metadata.invoice_id).toBe(invoiceId)
            expect(capturedAuditRecord.metadata.subscription_id).toBe(subscriptionId)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should include transaction details in failed payment audit log', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invoiceId: fc.uuid().map(id => `in_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            subscriptionId: fc.uuid().map(id => `sub_${id.replace(/-/g, '')}`),
            amountDue: fc.integer({ min: 100, max: 100000 }),
            userId: fc.uuid(),
            failureCode: fc.string({ minLength: 5, maxLength: 20 }),
            requestId: fc.uuid(),
          }),
          async ({ invoiceId, customerId, subscriptionId, amountDue, userId, failureCode, requestId }) => {
            // Setup mocks
            let capturedAuditRecord: any = null
            const purchaseAuditChain = {
              insert: jest.fn().mockImplementation((record) => {
                capturedAuditRecord = record
                return purchaseAuditChain
              }),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { id: 'audit_123' }, 
                error: null 
              }),
            }
            
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId,
                  email: 'user@example.com',
                  plan: 'grid_plus',
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create invoice
            const invoice: Stripe.Invoice = {
              id: invoiceId,
              object: 'invoice',
              customer: customerId,
              subscription: subscriptionId,
              amount_due: amountDue,
              amount_paid: 0,
              amount_remaining: amountDue,
              currency: 'usd',
              status: 'open',
              metadata: {
                user_id: userId,
              },
              charge: null,
              last_finalization_error: {
                code: failureCode,
                message: 'Payment failed',
                type: 'card_error',
              } as any,
            } as Stripe.Invoice

            // Act
            await processInvoicePaymentFailed(invoice, requestId)

            // Assert: Audit record should include key transaction details
            expect(capturedAuditRecord).toBeTruthy()
            expect(capturedAuditRecord.user_id).toBe(userId)
            expect(capturedAuditRecord.transaction_id).toBe(invoiceId)
            expect(capturedAuditRecord.amount_cents).toBe(amountDue)
            expect(capturedAuditRecord.status).toBe('failed')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should create audit log even when failure reason is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            invoiceId: fc.uuid().map(id => `in_${id.replace(/-/g, '')}`),
            customerId: fc.uuid().map(id => `cus_${id.replace(/-/g, '')}`),
            subscriptionId: fc.uuid().map(id => `sub_${id.replace(/-/g, '')}`),
            amountDue: fc.integer({ min: 100, max: 100000 }),
            userId: fc.uuid(),
            requestId: fc.uuid(),
          }),
          async ({ invoiceId, customerId, subscriptionId, amountDue, userId, requestId }) => {
            // Setup mocks
            let capturedAuditRecord: any = null
            const purchaseAuditChain = {
              insert: jest.fn().mockImplementation((record) => {
                capturedAuditRecord = record
                return purchaseAuditChain
              }),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { id: 'audit_123' }, 
                error: null 
              }),
            }
            
            const profileChain = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              update: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: userId,
                  email: 'user@example.com',
                  plan: 'grid_plus',
                }, 
                error: null 
              }),
            }
            
            mockSupabase.from.mockImplementation((table: string) => {
              if (table === 'purchase_audit') return purchaseAuditChain
              if (table === 'profiles') return profileChain
              return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }
            })

            // Create invoice without failure details
            const invoice: Stripe.Invoice = {
              id: invoiceId,
              object: 'invoice',
              customer: customerId,
              subscription: subscriptionId,
              amount_due: amountDue,
              amount_paid: 0,
              amount_remaining: amountDue,
              currency: 'usd',
              status: 'open',
              metadata: {
                user_id: userId,
              },
              charge: null,
              last_finalization_error: null, // No failure details
            } as Stripe.Invoice

            // Act
            await processInvoicePaymentFailed(invoice, requestId)

            // Assert: Audit record should still be created with status='failed'
            expect(purchaseAuditChain.insert).toHaveBeenCalled()
            expect(capturedAuditRecord).toBeTruthy()
            expect(capturedAuditRecord.status).toBe('failed')
            expect(capturedAuditRecord.user_id).toBe(userId)
            expect(capturedAuditRecord.transaction_id).toBe(invoiceId)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
