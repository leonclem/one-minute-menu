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