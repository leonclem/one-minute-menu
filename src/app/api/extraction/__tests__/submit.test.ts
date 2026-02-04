/**
 * Tests for POST /api/extraction/submit endpoint
 * @jest-environment node
 */

import { POST } from '../submit/route'
import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'
import { createMenuExtractionService } from '@/lib/extraction/menu-extraction-service'
import { JobQueueManager } from '@/lib/extraction/job-queue'


// Mock dependencies
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/database')
jest.mock('@/lib/extraction/menu-extraction-service')
jest.mock('@/lib/extraction/job-queue')
jest.mock('@/lib/extraction/metrics-collector', () => ({
  createMetricsCollector: jest.fn(() => ({
    trackExtraction: jest.fn(),
    trackCost: jest.fn(),
  }))
}))
// Mock cost monitor - will be configured per test
let mockCostMonitor: any

jest.mock('@/lib/extraction/cost-monitor', () => ({
  createCostMonitor: jest.fn(() => mockCostMonitor)
}))

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const mockUserOperations = userOperations as jest.Mocked<typeof userOperations>
const mockCreateMenuExtractionService = createMenuExtractionService as jest.MockedFunction<typeof createMenuExtractionService>
const mockJobQueueManager = JobQueueManager as jest.MockedClass<typeof JobQueueManager>

describe('POST /api/extraction/submit', () => {
  let mockSupabase: any
  let mockExtractionService: any
  let mockQueueManager: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      }
    }
    mockCreateServerSupabaseClient.mockReturnValue(mockSupabase)

    // Mock extraction service
    mockExtractionService = {
      // The submit route uses this for idempotency hashing
      calculateImageHash: jest.fn().mockResolvedValue('hash123'),
      // Kept for backwards compatibility; route currently queues via JobQueueManager
      submitExtractionJob: jest.fn(),
    }
    mockCreateMenuExtractionService.mockReturnValue(mockExtractionService)

    // Mock queue manager
    mockQueueManager = {
      checkRateLimit: jest.fn(),
      submitJob: jest.fn(),
    }
    mockJobQueueManager.mockImplementation(() => mockQueueManager)
    mockQueueManager.submitJob.mockResolvedValue({
      job: { id: 'job-123', status: 'queued' },
      cached: false,
    })

    // Mock cost monitor with default allowed state
    mockCostMonitor = {
      canPerformExtraction: jest.fn().mockResolvedValue({
        allowed: true,
        alerts: [],
        currentSpending: 0,
        remainingBudget: 999,
      }),
      processAlerts: jest.fn(),
      updateSpendingCaps: jest.fn(),
    }

    // Set environment variable
    process.env.OPENAI_API_KEY = 'test-api-key'
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Request Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('should return 400 if imageUrl is missing', async () => {
      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('imageUrl is required')
    })

    it('should return 400 if imageUrl is invalid', async () => {
      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'not-a-valid-url' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid imageUrl format')
    })

    it('should return 400 if JSON is invalid', async () => {
      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid JSON in request body')
    })
  })

  describe('Quota Enforcement', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockUserOperations.getProfile.mockResolvedValue({
        id: 'user-123',
        plan: 'free'
      })

      mockQueueManager.checkRateLimit.mockResolvedValue({
        allowed: true,
        current: 5,
        limit: 10
      })

      // Mock successful image validation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'image/jpeg'
            if (key === 'content-length') return '1000000'
            return null
          }
        }
      }) as any
    })

    it('should return 403 if monthly quota is exceeded', async () => {
      mockCostMonitor.canPerformExtraction.mockResolvedValue({
        allowed: false,
        reason: 'Monthly extraction limit reached',
        currentSpending: 100,
        remainingBudget: 0,
        alerts: []
      })

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Monthly extraction limit reached')
      expect(data.code).toBe('COST_BUDGET_EXCEEDED')
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockUserOperations.getProfile.mockResolvedValue({
        id: 'user-123',
        plan: 'free'
      })

      mockCostMonitor.canPerformExtraction.mockResolvedValue({
        allowed: true,
        alerts: [],
        currentSpending: 0,
        remainingBudget: 999,
      })

      // Mock successful image validation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'image/jpeg'
            if (key === 'content-length') return '1000000'
            return null
          }
        }
      }) as any
    })

    it('should return 429 if rate limit is exceeded', async () => {
      const resetAt = new Date(Date.now() + 3600000)
      mockQueueManager.checkRateLimit.mockResolvedValue({
        allowed: false,
        current: 10,
        limit: 10,
        resetAt
      })

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('Rate limit exceeded')
      expect(data.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(data.resetAt).toBe(resetAt.toISOString())
    })

    it('should use plan-specific rate limits', async () => {
      mockUserOperations.getProfile.mockResolvedValue({
        id: 'user-123',
        plan: 'premium'
      })

      mockQueueManager.checkRateLimit.mockResolvedValue({
        allowed: true,
        current: 5,
        limit: 50
      })

      mockExtractionService.submitExtractionJob.mockResolvedValue({
        id: 'job-123',
        status: 'queued',
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        createdAt: new Date()
      })

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg' })
      })

      await POST(request)

      expect(mockQueueManager.checkRateLimit).toHaveBeenCalledWith('user-123', expect.any(Number))
    })
  })

  describe('Successful Submission', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockUserOperations.getProfile.mockResolvedValue({
        id: 'user-123',
        plan: 'free'
      })

      mockQueueManager.checkRateLimit.mockResolvedValue({
        allowed: true,
        current: 5,
        limit: 10
      })

      mockCostMonitor.canPerformExtraction.mockResolvedValue({
        allowed: true,
        alerts: [],
        currentSpending: 0,
        remainingBudget: 999,
      })

      // Mock successful image validation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'image/jpeg'
            if (key === 'content-length') return '1000000'
            return null
          }
        }
      }) as any
    })

    it('should successfully submit extraction job', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'queued' as const,
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        schemaVersion: 'stage1' as const,
        promptVersion: 'v1.0',
        createdAt: new Date()
      }

      mockQueueManager.submitJob.mockResolvedValue({ job: mockJob, cached: false })

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.jobId).toBe('job-123')
      expect(data.data.status).toBe('queued')
      expect(data.data.estimatedCompletionTime).toBeDefined()
      // Note: quotaRemaining is not returned in the current implementation
    })

    it('should pass extraction options to service', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'queued' as const,
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        schemaVersion: 'stage2' as const,
        promptVersion: 'v2.0',
        createdAt: new Date(),
      }
      mockQueueManager.submitJob.mockResolvedValue({ job: mockJob, cached: false })

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: 'https://example.com/image.jpg',
          schemaVersion: 'stage2',
          promptVersion: 'v2.0',
          currency: 'USD',
          language: 'en'
        })
      })

      await POST(request)

      expect(mockExtractionService.calculateImageHash).toHaveBeenCalledWith('https://example.com/image.jpg')
      expect(mockQueueManager.submitJob).toHaveBeenCalledWith(
        'user-123',
        'https://example.com/image.jpg',
        'hash123',
        {
          schemaVersion: 'stage2',
          promptVersion: 'v2.0',
          currency: 'USD',
          language: 'en',
          menuId: undefined,
        }
      )
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockUserOperations.getProfile.mockResolvedValue({
        id: 'user-123',
        plan: 'free'
      })

      mockQueueManager.checkRateLimit.mockResolvedValue({
        allowed: true,
        current: 5,
        limit: 10
      })

      mockCostMonitor.canPerformExtraction.mockResolvedValue({
        allowed: true,
        alerts: [],
        currentSpending: 0,
        remainingBudget: 999,
      })

      // Mock successful image validation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (key: string) => {
            if (key === 'content-type') return 'image/jpeg'
            if (key === 'content-length') return '1000000'
            return null
          }
        }
      }) as any
    })

    it('should return 500 if OPENAI_API_KEY is not configured', async () => {
      delete process.env.OPENAI_API_KEY

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Extraction service not configured')
    })

    it('should return 500 if extraction service throws error', async () => {
      mockQueueManager.submitJob.mockRejectedValue(new Error('Extraction failed'))

      const request = new NextRequest('http://localhost/api/extraction/submit', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/image.jpg' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Extraction failed')
      expect(data.code).toBe('EXTRACTION_FAILED')
    })
  })
})
