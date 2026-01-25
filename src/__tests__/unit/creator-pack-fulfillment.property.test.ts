/**
 * Property-Based Tests for Creator Pack Fulfillment
 * Feature: stripe-payment-integration, Property 15: Creator Pack Fulfillment Creates User Pack
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import * as fc from 'fast-check'
import { purchaseLogger } from '@/lib/purchase-logger'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Mock the Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
  createAdminSupabaseClient: jest.fn()
}))

describe('Property 15: Creator Pack Fulfillment Creates User Pack', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
  })

  it('should create user_packs record with pack_type=creator_pack, expires_at=24 months, edit_window_end=1 week for any Creator Pack purchase', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        fc.integer({ min: 100, max: 100000 }),
        fc.boolean(),
        
        async (userId, transactionId, amountCents, isFree) => {
          // Create fresh mock for each test iteration
          const mockInsert = jest.fn()
          const mockPackInsert = jest.fn().mockResolvedValue({ error: null })
          const mockAuditInsert = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'audit-id' }, error: null })
            })
          })
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
          const mockEq1 = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
          const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 })
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
          
          // Execute: Fulfill Creator Pack
          await purchaseLogger.fulfillCreatorPack(
            userId,
            transactionId,
            amountCents,
            isFree
          )
          
          // Verify: Insert was called on user_packs table
          expect(mockFrom).toHaveBeenCalledWith('user_packs')
          
          // Verify: Insert was called with correct pack data
          const packInsertCall = mockPackInsert.mock.calls[0][0]
          expect(packInsertCall.user_id).toBe(userId)
          expect(packInsertCall.pack_type).toBe('creator_pack')
          expect(packInsertCall.is_free_trial).toBe(isFree)
          
          // Verify: expires_at is set to 24 months from now
          const expiresAt = new Date(packInsertCall.expires_at)
          const now = new Date()
          const expectedExpiry = new Date(now.getTime() + 24 * 30 * 24 * 60 * 60 * 1000)
          const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime())
          expect(timeDiff).toBeLessThan(5000) // Within 5 seconds
          
          // Verify: edit_window_end is set to 1 week from now
          const editWindowEnd = new Date(packInsertCall.edit_window_end)
          const expectedEditWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          const editTimeDiff = Math.abs(editWindowEnd.getTime() - expectedEditWindow.getTime())
          expect(editTimeDiff).toBeLessThan(5000) // Within 5 seconds
          
          // Verify: metadata includes transaction_id and is_free
          expect(packInsertCall.metadata).toEqual(expect.objectContaining({
            transaction_id: transactionId,
            is_free: isFree
          }))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should not create user pack if transaction already processed (idempotency)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 10, maxLength: 50 }).map(s => `pi_${s}`),
        fc.integer({ min: 100, max: 100000 }),
        fc.boolean(),
        
        async (userId, transactionId, amountCents, isFree) => {
          // Create fresh mock for each test iteration
          const mockPackInsert = jest.fn()
          const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'existing-audit-id' }, error: null })
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
          
          // Execute: Fulfill Creator Pack
          await purchaseLogger.fulfillCreatorPack(
            userId,
            transactionId,
            amountCents,
            isFree
          )
          
          // Verify: Insert was NOT called (because transaction already processed)
          expect(mockPackInsert).not.toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
