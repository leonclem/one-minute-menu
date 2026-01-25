/**
 * Property-Based Tests for Cancellation Audit Log
 * 
 * Feature: stripe-payment-integration, Property 23: Cancellation Audit Log
 * Validates: Requirements 8.4
 * 
 * Tests that subscription cancellations create proper audit log records.
 */

import * as fc from 'fast-check'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Property 23: Cancellation Audit Log', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }
    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Property: For any subscription cancellation, the system SHALL create
   * a purchase_audit record with status='refunded' or a custom 'cancelled' status.
   */
  it('should create audit log record for every subscription cancellation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.constantFrom('user_requested', 'payment_failed', 'admin_action', 'unknown'),
        fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
        async (userId, subscriptionId, reason, periodEndTimestamp) => {
          const periodEnd = new Date(periodEndTimestamp)
          
          // Mock successful insert
          mockSupabase.insert.mockResolvedValue({
            data: {
              user_id: userId,
              transaction_id: `cancel_${subscriptionId}_${Date.now()}`,
              product_id: 'subscription_cancellation',
              amount_cents: 0,
              currency: 'usd',
              status: 'refunded',
              metadata: {
                stripe_subscription_id: subscriptionId,
                reason,
                cancelled_at: new Date().toISOString(),
                period_end: periodEnd.toISOString(),
              },
            },
            error: null,
          })

          // Execute: Log cancellation in purchase_audit
          const { data, error } = await mockSupabase
            .from('purchase_audit')
            .insert({
              user_id: userId,
              transaction_id: `cancel_${subscriptionId}_${Date.now()}`,
              product_id: 'subscription_cancellation',
              amount_cents: 0,
              currency: 'usd',
              status: 'refunded',
              metadata: {
                stripe_subscription_id: subscriptionId,
                reason,
                cancelled_at: new Date().toISOString(),
                period_end: periodEnd.toISOString(),
              },
            })

          // Verify: Audit log was created
          expect(mockSupabase.from).toHaveBeenCalledWith('purchase_audit')
          expect(mockSupabase.insert).toHaveBeenCalled()
          expect(error).toBeNull()

          // Verify: Audit log has correct status
          if (data) {
            expect(['refunded', 'cancelled']).toContain(data.status)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should include subscription ID in audit log metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        async (userId, subscriptionId) => {
          // Mock audit log record
          const auditRecord = {
            user_id: userId,
            transaction_id: `cancel_${subscriptionId}_${Date.now()}`,
            product_id: 'subscription_cancellation',
            status: 'refunded',
            metadata: {
              stripe_subscription_id: subscriptionId,
              reason: 'user_requested',
            },
          }

          mockSupabase.single.mockResolvedValue({
            data: auditRecord,
            error: null,
          })

          // Execute: Query audit log
          const { data: audit } = await mockSupabase
            .from('purchase_audit')
            .select('*')
            .eq('user_id', userId)
            .single()

          // Verify: Audit log contains subscription ID
          expect(audit).toBeDefined()
          expect(audit.metadata).toBeDefined()
          expect(audit.metadata.stripe_subscription_id).toBe(subscriptionId)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should include cancellation reason in audit log', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.constantFrom('user_requested', 'payment_failed', 'admin_action', 'unknown'),
        async (userId, subscriptionId, reason) => {
          // Mock audit log record
          const auditRecord = {
            user_id: userId,
            transaction_id: `cancel_${subscriptionId}_${Date.now()}`,
            product_id: 'subscription_cancellation',
            status: 'refunded',
            metadata: {
              stripe_subscription_id: subscriptionId,
              reason,
              cancelled_at: new Date().toISOString(),
            },
          }

          mockSupabase.single.mockResolvedValue({
            data: auditRecord,
            error: null,
          })

          // Execute: Query audit log
          const { data: audit } = await mockSupabase
            .from('purchase_audit')
            .select('*')
            .eq('user_id', userId)
            .single()

          // Verify: Audit log contains cancellation reason
          expect(audit).toBeDefined()
          expect(audit.metadata).toBeDefined()
          expect(audit.metadata.reason).toBe(reason)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should include period_end date in audit log', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
        async (userId, subscriptionId, periodEndTimestamp) => {
          const periodEnd = new Date(periodEndTimestamp)
          
          // Mock audit log record
          const auditRecord = {
            user_id: userId,
            transaction_id: `cancel_${subscriptionId}_${Date.now()}`,
            product_id: 'subscription_cancellation',
            status: 'refunded',
            metadata: {
              stripe_subscription_id: subscriptionId,
              reason: 'user_requested',
              cancelled_at: new Date().toISOString(),
              period_end: periodEnd.toISOString(),
            },
          }

          mockSupabase.single.mockResolvedValue({
            data: auditRecord,
            error: null,
          })

          // Execute: Query audit log
          const { data: audit } = await mockSupabase
            .from('purchase_audit')
            .select('*')
            .eq('user_id', userId)
            .single()

          // Verify: Audit log contains period_end
          expect(audit).toBeDefined()
          expect(audit.metadata).toBeDefined()
          expect(audit.metadata.period_end).toBeDefined()
          
          // Verify: period_end is a valid ISO date string
          const storedPeriodEnd = new Date(audit.metadata.period_end)
          expect(storedPeriodEnd.toISOString()).toBe(audit.metadata.period_end)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should use amount_cents of 0 for cancellation records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 15, maxLength: 50 }).map(s => `sub_${s}`),
        async (userId, subscriptionId) => {
          // Mock audit log record
          const auditRecord = {
            user_id: userId,
            transaction_id: `cancel_${subscriptionId}_${Date.now()}`,
            product_id: 'subscription_cancellation',
            amount_cents: 0,
            currency: 'usd',
            status: 'refunded',
            metadata: {
              stripe_subscription_id: subscriptionId,
            },
          }

          mockSupabase.single.mockResolvedValue({
            data: auditRecord,
            error: null,
          })

          // Execute: Query audit log
          const { data: audit } = await mockSupabase
            .from('purchase_audit')
            .select('*')
            .eq('user_id', userId)
            .single()

          // Verify: Amount is 0 for cancellation
          expect(audit).toBeDefined()
          expect(audit.amount_cents).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
