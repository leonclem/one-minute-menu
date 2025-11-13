import { quotaOperations } from '@/lib/quota-management'
import { PLAN_CONFIGS } from '@/types'

// Mock userOperations.getProfile to simulate missing profile (PGRST116 handled upstream)
jest.mock('@/lib/database', () => {
  const actual = jest.requireActual('@/lib/database')
  return {
    ...actual,
    userOperations: {
      ...actual.userOperations,
      getProfile: jest.fn().mockResolvedValue(null),
    },
  }
})

// Provide a minimal Supabase client mock for generation_quotas flows
jest.mock('@/lib/supabase-server', () => {
  const mockNow = new Date()
  const nextResetDate = new Date(mockNow.getFullYear(), mockNow.getMonth() + 1, 1)

  const generationQuotasApi = {
    // select('*').eq('user_id', userId).single() -> simulate not found
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows' },
    }),
    // insert({...}).select().single() -> return created row
    insert: jest.fn((_rows: any) => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'quota-1',
            user_id: 'user-123',
            plan: 'free',
            monthly_limit: PLAN_CONFIGS.free.aiImageGenerations,
            current_usage: 0,
            reset_date: nextResetDate.toISOString().split('T')[0],
            last_generation_at: null,
            created_at: mockNow.toISOString(),
            updated_at: mockNow.toISOString(),
          },
          error: null,
        }),
      })),
    })),
    update: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
  }

  const mockClient = {
    from: jest.fn((table: string) => {
      if (table === 'generation_quotas') return generationQuotasApi
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows' },
        }),
      }
    }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
    },
  }

  return {
    createServerSupabaseClient: jest.fn(() => mockClient),
  }
})

describe('QuotaManagementService.checkQuota', () => {
  it('defaults to free plan when profile is missing and creates quota record', async () => {
    const userId = 'user-123'
    const quota = await quotaOperations.checkQuota(userId)

    expect(quota.userId).toBe(userId)
    expect(quota.plan).toBe('free')
    expect(quota.used).toBe(0)
    expect(quota.limit).toBe(PLAN_CONFIGS.free.aiImageGenerations)
    expect(quota.remaining).toBe(quota.limit)
    expect(quota.resetDate).toBeInstanceOf(Date)
  })
})

import { QuotaManagementService } from '@/lib/quota-management'
import type { ImageGenerationRequest } from '@/types'
// Jest provides `describe`, `it`, and lifecycle hooks as globals

describe('QuotaManagementService', () => {
  let quotaService: QuotaManagementService
  
  beforeEach(() => {
    quotaService = new QuotaManagementService()
  })

  // Note: These tests focus on the business logic rather than database integration
  // Database integration tests would be in a separate integration test suite

  describe('estimateCost', () => {
    it('should estimate cost for single image', async () => {
      const request: ImageGenerationRequest = {
        userId: 'user-1',
        menuItemId: 'item-1',
        itemName: 'Test Dish',
        styleParams: {}
      }

      const result = await quotaService.estimateCost(request)

      expect(result.perImage).toBe(0.02)
      expect(result.totalImages).toBe(1)
      expect(result.estimatedTotal).toBe(0.02)
      expect(result.currency).toBe('USD')
    })

    it('should estimate cost for multiple variations', async () => {
      const request: ImageGenerationRequest = {
        userId: 'user-1',
        menuItemId: 'item-1',
        itemName: 'Test Dish',
        styleParams: {},
        numberOfVariations: 4
      }

      const result = await quotaService.estimateCost(request)

      expect(result.perImage).toBe(0.02)
      expect(result.totalImages).toBe(4)
      expect(result.estimatedTotal).toBe(0.08)
    })
  })

  describe('checkWarningThreshold', () => {
    it('should return true when user is at warning threshold', async () => {
      const userId = 'user-1'
      
      const mockQuotaStatus = {
        userId,
        plan: 'free' as const,
        limit: 10,
        used: 8, // At 80% threshold
        remaining: 2,
        resetDate: new Date('2025-02-01'),
        warningThreshold: 8,
        needsUpgrade: false
      }

      jest.spyOn(quotaService, 'checkQuota').mockResolvedValueOnce(mockQuotaStatus)

      const result = await quotaService.checkWarningThreshold(userId)

      expect(result).toBe(true)
    })

    it('should return false when user is below warning threshold', async () => {
      const userId = 'user-1'
      
      const mockQuotaStatus = {
        userId,
        plan: 'free' as const,
        limit: 10,
        used: 5, // Below 80% threshold
        remaining: 5,
        resetDate: new Date('2025-02-01'),
        warningThreshold: 8,
        needsUpgrade: false
      }

      jest.spyOn(quotaService, 'checkQuota').mockResolvedValueOnce(mockQuotaStatus)

      const result = await quotaService.checkWarningThreshold(userId)

      expect(result).toBe(false)
    })
  })
})