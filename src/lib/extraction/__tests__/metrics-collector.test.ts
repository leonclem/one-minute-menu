/**
 * Tests for Metrics Collector
 * 
 * Requirements: 8.1, 8.2, 8.4
 */

import { MetricsCollector } from '../metrics-collector'
import type { ExtractionJob } from '../menu-extraction-service'
import type { ExtractionResult } from '../schema-stage1'

describe('MetricsCollector', () => {
  let mockSupabase: any
  let metricsCollector: MetricsCollector

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn(() => mockSupabase),
      select: jest.fn(() => mockSupabase),
      eq: jest.fn(() => mockSupabase),
      gte: jest.fn(() => mockSupabase),
      lte: jest.fn(() => mockSupabase),
      order: jest.fn(() => mockSupabase),
      limit: jest.fn(() => mockSupabase),
      single: jest.fn(() => ({ data: null, error: null })),
      rpc: jest.fn(() => ({ data: null, error: null })),
      auth: {
        admin: {
          listUsers: jest.fn(() => ({ data: { users: [] }, error: null }))
        }
      }
    }

    metricsCollector = new MetricsCollector(mockSupabase)
  })

  describe('trackExtraction', () => {
    it('should track extraction metrics', async () => {
      const job: ExtractionJob = {
        id: 'job-1',
        userId: 'user-1',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        status: 'completed',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        createdAt: new Date(),
        processingTime: 5000,
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.025
        }
      }

      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Appetizers',
              items: [],
              confidence: 0.95
            },
            {
              name: 'Main Course',
              items: [],
              confidence: 0.90
            }
          ]
        },
        uncertainItems: [],
        superfluousText: [],
        confidence: 0.925,
        currency: 'USD',
        detectedLanguage: 'en',
        processingTime: 5000,
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 500,
          estimatedCost: 0.025
        },
        schemaVersion: 'stage1',
        promptVersion: 'v1.0'
      }

      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

      await metricsCollector.trackExtraction(job, result)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_extraction_metrics', {
        p_prompt_version: 'v1.0',
        p_schema_version: 'stage1',
        p_date: expect.any(String),
        p_confidence: 0.925,
        p_processing_time: 5000,
        p_token_usage: 1500,
        p_cost: 0.025
      })
    })

    it('should handle errors gracefully', async () => {
      const job: ExtractionJob = {
        id: 'job-1',
        userId: 'user-1',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        status: 'completed',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        createdAt: new Date()
      }

      const result: ExtractionResult = {
        menu: { categories: [] },
        uncertainItems: [],
        superfluousText: [],
        confidence: 0.9,
        currency: 'USD',
        detectedLanguage: 'en',
        processingTime: 5000,
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 500,
          estimatedCost: 0.025
        },
        schemaVersion: 'stage1',
        promptVersion: 'v1.0'
      }

      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: null, 
        error: new Error('Database error') 
      })

      // Should not throw
      await expect(
        metricsCollector.trackExtraction(job, result)
      ).resolves.toBeUndefined()
    })
  })

  describe('getUserSpending', () => {
    it('should calculate user spending correctly', async () => {
      const today = new Date().toISOString().split('T')[0]
      
      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockResolvedValueOnce({
        data: [
          { token_usage: { estimatedCost: 0.02 }, created_at: today },
          { token_usage: { estimatedCost: 0.03 }, created_at: today }
        ],
        error: null
      })

      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockResolvedValueOnce({
        data: [
          { token_usage: { estimatedCost: 0.02 }, created_at: today },
          { token_usage: { estimatedCost: 0.03 }, created_at: today },
          { token_usage: { estimatedCost: 0.01 }, created_at: '2024-01-01' }
        ],
        error: null
      })

      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.eq.mockReturnValueOnce(mockSupabase)
      mockSupabase.order.mockReturnValueOnce(mockSupabase)
      mockSupabase.limit.mockReturnValueOnce(mockSupabase)
      mockSupabase.single.mockResolvedValueOnce({
        data: { created_at: today },
        error: null
      })

      const spending = await metricsCollector.getUserSpending('user-1')

      expect(spending.dailySpending).toBeCloseTo(0.05, 2)
      expect(spending.monthlySpending).toBeCloseTo(0.06, 2)
      expect(spending.totalExtractions).toBe(3)
    })
  })

  describe('getOverallMetrics', () => {
    it('should calculate overall metrics correctly', async () => {
      const jobs = [
        {
          id: '1',
          status: 'completed',
          processing_time: 5000,
          confidence: 0.9,
          token_usage: { totalTokens: 1500, estimatedCost: 0.025 },
          uncertain_items: []
        },
        {
          id: '2',
          status: 'completed',
          processing_time: 6000,
          confidence: 0.85,
          token_usage: { totalTokens: 1600, estimatedCost: 0.027 },
          uncertain_items: [{ text: 'unclear' }]
        },
        {
          id: '3',
          status: 'failed'
        }
      ]

      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockReturnValueOnce(mockSupabase)
      mockSupabase.lte.mockResolvedValueOnce({
        data: jobs,
        error: null
      })

      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockReturnValueOnce(mockSupabase)
      mockSupabase.lte.mockResolvedValueOnce({
        data: [],
        error: null
      })

      const metrics = await metricsCollector.getOverallMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      )

      expect(metrics.totalExtractions).toBe(2)
      expect(metrics.totalCost).toBe(0.052)
      expect(metrics.averageCostPerExtraction).toBe(0.026)
      expect(metrics.failureRate).toBe(0.33)
      expect(metrics.uncertainItemRate).toBe(0.5)
    })

    it('should return empty metrics when no jobs exist', async () => {
      mockSupabase.select.mockReturnValueOnce(mockSupabase)
      mockSupabase.gte.mockReturnValueOnce(mockSupabase)
      mockSupabase.lte.mockResolvedValueOnce({
        data: [],
        error: null
      })

      const metrics = await metricsCollector.getOverallMetrics(
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      )

      expect(metrics.totalExtractions).toBe(0)
      expect(metrics.totalCost).toBe(0)
      expect(metrics.averageCostPerExtraction).toBe(0)
    })
  })

  describe('alertOnThreshold', () => {
    it('should log warning when threshold exceeded', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      await metricsCollector.alertOnThreshold('cost', 100, 50, 'warning')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[WARNING] Metric threshold exceeded:',
        expect.objectContaining({
          metric: 'cost',
          value: 100,
          threshold: 50
        })
      )

      consoleSpy.mockRestore()
    })

    it('should not log when threshold not exceeded', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      await metricsCollector.alertOnThreshold('cost', 30, 50, 'warning')

      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
