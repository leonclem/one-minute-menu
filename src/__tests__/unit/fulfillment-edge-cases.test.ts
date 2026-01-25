/**
 * Unit Tests for Fulfillment Edge Cases
 * Feature: stripe-payment-integration, Task 4.9
 * Validates: Requirements 5.7, 6.7
 * 
 * Tests edge cases in subscription and Creator Pack fulfillment:
 * - Duplicate transaction handling (idempotency)
 * - User not found scenarios
 * - Database transaction rollback on errors
 */

import { purchaseLogger } from '@/lib/purchase-logger'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { DatabaseError } from '@/lib/database'

// Mock the Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Fulfillment Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Duplicate Transaction Handling', () => {
    it('should skip subscription fulfillment if transaction already processed', async () => {
      const userId = 'user-123'
      const transactionId = 'pi_duplicate_transaction'
      const plan = 'grid_plus'
      const stripeCustomerId = 'cus_123'
      const stripeSubscriptionId = 'sub_123'
      const amountCents = 1999

      // Mock: Transaction already exists in purchase_audit
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { id: 'existing-audit-id' },
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
      const mockUpdate = jest.fn()
      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { select: mockSelect }
        } else if (table === 'profiles') {
          return { update: mockUpdate }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute
      await purchaseLogger.fulfillSubscription(
        userId,
        plan,
        stripeCustomerId,
        stripeSubscriptionId,
        transactionId,
        amountCents
      )

      // Verify: Profile update was NOT called (transaction already processed)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('should skip Creator Pack fulfillment if transaction already processed', async () => {
      const userId = 'user-456'
      const transactionId = 'pi_duplicate_pack'
      const amountCents = 4999
      const isFree = false

      // Mock: Transaction already exists in purchase_audit
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { id: 'existing-audit-id' },
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
      const mockInsert = jest.fn()
      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { select: mockSelect }
        } else if (table === 'user_packs') {
          return { insert: mockInsert }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute
      await purchaseLogger.fulfillCreatorPack(
        userId,
        transactionId,
        amountCents,
        isFree
      )

      // Verify: Insert was NOT called (transaction already processed)
      expect(mockInsert).not.toHaveBeenCalled()
    })
  })

  describe('User Not Found Scenarios', () => {
    it('should throw DatabaseError when user profile does not exist during subscription fulfillment', async () => {
      const userId = 'nonexistent-user'
      const transactionId = 'pi_new_transaction'
      const plan = 'grid_plus_premium'
      const stripeCustomerId = 'cus_456'
      const stripeSubscriptionId = 'sub_456'
      const amountCents = 4999

      // Mock: Idempotency check passes (transaction not processed)
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock: Profile update fails (user not found)
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'User not found',
          code: '23503' // Foreign key violation
        }
      })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })

      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { select: mockSelect }
        } else if (table === 'profiles') {
          return { update: mockUpdate }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute & Verify: Should throw DatabaseError
      await expect(
        purchaseLogger.fulfillSubscription(
          userId,
          plan,
          stripeCustomerId,
          stripeSubscriptionId,
          transactionId,
          amountCents
        )
      ).rejects.toThrow(DatabaseError)

      await expect(
        purchaseLogger.fulfillSubscription(
          userId,
          plan,
          stripeCustomerId,
          stripeSubscriptionId,
          transactionId,
          amountCents
        )
      ).rejects.toThrow('Failed to update profile')
    })

    it('should throw DatabaseError when user does not exist during Creator Pack fulfillment', async () => {
      const userId = 'nonexistent-user-2'
      const transactionId = 'pi_new_pack_transaction'
      const amountCents = 4999
      const isFree = false

      // Mock: Idempotency check passes (transaction not processed)
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock: user_packs insert fails (user not found)
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'User not found',
          code: '23503' // Foreign key violation
        }
      })

      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { select: mockSelect }
        } else if (table === 'user_packs') {
          return { insert: mockInsert }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute & Verify: Should throw DatabaseError
      await expect(
        purchaseLogger.fulfillCreatorPack(
          userId,
          transactionId,
          amountCents,
          isFree
        )
      ).rejects.toThrow(DatabaseError)

      await expect(
        purchaseLogger.fulfillCreatorPack(
          userId,
          transactionId,
          amountCents,
          isFree
        )
      ).rejects.toThrow('Failed to grant creator pack')
    })
  })

  describe('Database Transaction Rollback', () => {
    it('should not log purchase_audit if profile update fails during subscription fulfillment', async () => {
      const userId = 'user-789'
      const transactionId = 'pi_rollback_test'
      const plan = 'grid_plus'
      const stripeCustomerId = 'cus_789'
      const stripeSubscriptionId = 'sub_789'
      const amountCents = 1999

      // Mock: Idempotency check passes
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock: Profile update fails
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Database connection lost',
          code: '08006'
        }
      })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })

      // Mock: Audit insert (should not be called)
      const mockAuditInsert = jest.fn()

      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { select: mockSelect, insert: mockAuditInsert }
        } else if (table === 'profiles') {
          return { update: mockUpdate }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute & Verify: Should throw error
      await expect(
        purchaseLogger.fulfillSubscription(
          userId,
          plan,
          stripeCustomerId,
          stripeSubscriptionId,
          transactionId,
          amountCents
        )
      ).rejects.toThrow()

      // Verify: Audit insert was NOT called (transaction rolled back)
      expect(mockAuditInsert).not.toHaveBeenCalled()
    })

    it('should not log purchase_audit if user_packs insert fails during Creator Pack fulfillment', async () => {
      const userId = 'user-101'
      const transactionId = 'pi_pack_rollback_test'
      const amountCents = 4999
      const isFree = false

      // Mock: Idempotency check passes
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock: user_packs insert fails
      const mockPackInsert = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Constraint violation',
          code: '23505'
        }
      })

      // Mock: Audit insert (should not be called)
      const mockAuditInsert = jest.fn()

      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { select: mockSelect, insert: mockAuditInsert }
        } else if (table === 'user_packs') {
          return { insert: mockPackInsert }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute & Verify: Should throw error
      await expect(
        purchaseLogger.fulfillCreatorPack(
          userId,
          transactionId,
          amountCents,
          isFree
        )
      ).rejects.toThrow()

      // Verify: Audit insert was NOT called (transaction rolled back)
      expect(mockAuditInsert).not.toHaveBeenCalled()
    })

    it('should not update quotas if audit logging fails during subscription fulfillment', async () => {
      const userId = 'user-202'
      const transactionId = 'pi_quota_rollback_test'
      const plan = 'grid_plus_premium'
      const stripeCustomerId = 'cus_202'
      const stripeSubscriptionId = 'sub_202'
      const amountCents = 4999

      // Mock: Idempotency check passes
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock: Profile update succeeds
      const mockEq = jest.fn().mockResolvedValue({
        data: { id: userId },
        error: null
      })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq })

      // Mock: Audit insert fails
      const mockAuditSingle = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Insert failed',
          code: '23505'
        }
      })
      const mockAuditSelect = jest.fn().mockReturnValue({
        single: mockAuditSingle
      })
      const mockAuditInsert = jest.fn().mockReturnValue({
        select: mockAuditSelect
      })

      // Mock: Quota upsert (should not be called)
      const mockQuotaUpsert = jest.fn()

      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { select: mockSelect, insert: mockAuditInsert }
        } else if (table === 'profiles') {
          return { update: mockUpdate }
        } else if (table === 'generation_quotas') {
          return { upsert: mockQuotaUpsert }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute & Verify: Should throw error
      await expect(
        purchaseLogger.fulfillSubscription(
          userId,
          plan,
          stripeCustomerId,
          stripeSubscriptionId,
          transactionId,
          amountCents
        )
      ).rejects.toThrow()

      // Verify: Quota upsert was NOT called (transaction rolled back)
      expect(mockQuotaUpsert).not.toHaveBeenCalled()
    })
  })

  describe('Subscription Cancellation Edge Cases', () => {
    it('should handle cancellation when subscription ID does not match', async () => {
      const userId = 'user-303'
      const stripeSubscriptionId = 'sub_wrong_id'
      const reason = 'user_requested'

      // Mock: Profile update with no matching rows
      const mockEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null // No error, but no rows updated
      })
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock: Audit insert succeeds
      const mockAuditSingle = jest.fn().mockResolvedValue({
        data: { id: 'audit-id' },
        error: null
      })
      const mockAuditSelect = jest.fn().mockReturnValue({
        single: mockAuditSingle
      })
      const mockAuditInsert = jest.fn().mockReturnValue({
        select: mockAuditSelect
      })

      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { insert: mockAuditInsert }
        } else if (table === 'profiles') {
          return { update: mockUpdate }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute: Should not throw (graceful handling)
      await expect(
        purchaseLogger.cancelSubscription(
          userId,
          stripeSubscriptionId,
          reason
        )
      ).resolves.not.toThrow()

      // Verify: Cancellation was still logged in audit trail
      expect(mockAuditInsert).toHaveBeenCalled()
    })

    it('should throw DatabaseError when audit logging fails during cancellation', async () => {
      const userId = 'user-404'
      const stripeSubscriptionId = 'sub_404'
      const reason = 'payment_failed'

      // Mock: Profile update succeeds
      const mockEq2 = jest.fn().mockResolvedValue({
        data: { id: userId },
        error: null
      })
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 })
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq1 })

      // Mock: Audit insert fails
      const mockAuditSingle = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'Audit insert failed',
          code: '23505'
        }
      })
      const mockAuditSelect = jest.fn().mockReturnValue({
        single: mockAuditSingle
      })
      const mockAuditInsert = jest.fn().mockReturnValue({
        select: mockAuditSelect
      })

      const mockFrom = jest.fn((table: string) => {
        if (table === 'purchase_audit') {
          return { insert: mockAuditInsert }
        } else if (table === 'profiles') {
          return { update: mockUpdate }
        }
        return {}
      })

      const mockSupabase = { from: mockFrom }
      ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)

      // Execute & Verify: Should throw DatabaseError
      await expect(
        purchaseLogger.cancelSubscription(
          userId,
          stripeSubscriptionId,
          reason
        )
      ).rejects.toThrow(DatabaseError)

      await expect(
        purchaseLogger.cancelSubscription(
          userId,
          stripeSubscriptionId,
          reason
        )
      ).rejects.toThrow('Failed to log purchase')
    })
  })
})
