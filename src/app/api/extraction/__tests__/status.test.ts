/**
 * Tests for GET /api/extraction/status/[jobId] endpoint
 * @jest-environment node
 */

import { GET } from '../status/[jobId]/route'
import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { JobQueueManager } from '@/lib/extraction/job-queue'

// Mock dependencies
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/extraction/job-queue')

const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>
const mockJobQueueManager = JobQueueManager as jest.MockedClass<typeof JobQueueManager>

describe('GET /api/extraction/status/[jobId]', () => {
  let mockSupabase: any
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

    // Mock queue manager
    mockQueueManager = {
      getJobStatus: jest.fn()
    }
    mockJobQueueManager.mockImplementation(() => mockQueueManager)
  })

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('Parameter Validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('should return 400 if jobId is missing', async () => {
      const request = new NextRequest('http://localhost/api/extraction/status/')
      const response = await GET(request, { params: { jobId: '' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('jobId parameter is required')
    })
  })

  describe('Authorization', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('should return 404 if job does not exist', async () => {
      mockQueueManager.getJobStatus.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Job not found')
    })

    it('should return 403 if user does not own the job', async () => {
      mockQueueManager.getJobStatus.mockResolvedValue({
        id: 'job-123',
        userId: 'other-user',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        status: 'completed',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        createdAt: new Date()
      })

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })
  })

  describe('Successful Status Check', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('should return job status for queued job', async () => {
      const createdAt = new Date()
      mockQueueManager.getJobStatus.mockResolvedValue({
        id: 'job-123',
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        status: 'queued',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        createdAt
      })

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe('job-123')
      expect(data.data.status).toBe('queued')
      expect(data.data.schemaVersion).toBe('stage1')
      expect(data.data.promptVersion).toBe('v1.0')
      expect(data.data.createdAt).toBe(createdAt.toISOString())
    })

    it('should return job status for processing job', async () => {
      const createdAt = new Date()
      mockQueueManager.getJobStatus.mockResolvedValue({
        id: 'job-123',
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        status: 'processing',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        createdAt
      })

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('processing')
    })

    it('should return job status with results for completed job', async () => {
      const createdAt = new Date()
      const completedAt = new Date(Date.now() + 10000)
      const mockResult = {
        menu: {
          categories: [
            {
              name: 'Appetizers',
              items: [
                {
                  name: 'Spring Rolls',
                  price: 8.99,
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            }
          ]
        },
        uncertainItems: [],
        superfluousText: [],
        currency: 'USD',
        detectedLanguage: 'en'
      }

      mockQueueManager.getJobStatus.mockResolvedValue({
        id: 'job-123',
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        status: 'completed',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        result: mockResult,
        createdAt,
        completedAt,
        processingTime: 10000,
        tokenUsage: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCost: 0.025
        },
        confidence: 0.95,
        uncertainItems: [],
        superfluousText: []
      })

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('completed')
      expect(data.data.result).toEqual(mockResult)
      expect(data.data.completedAt).toBe(completedAt.toISOString())
      expect(data.data.processingTime).toBe(10000)
      expect(data.data.tokenUsage).toBeDefined()
      expect(data.data.confidence).toBe(0.95)
    })

    it('should return job status with error for failed job', async () => {
      const createdAt = new Date()
      const completedAt = new Date(Date.now() + 5000)

      mockQueueManager.getJobStatus.mockResolvedValue({
        id: 'job-123',
        userId: 'user-123',
        imageUrl: 'https://example.com/image.jpg',
        imageHash: 'hash123',
        status: 'failed',
        schemaVersion: 'stage1',
        promptVersion: 'v1.0',
        error: 'API rate limit exceeded',
        createdAt,
        completedAt
      })

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('failed')
      expect(data.data.error).toBe('API rate limit exceeded')
      expect(data.data.completedAt).toBe(completedAt.toISOString())
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('should return 500 if queue manager throws error', async () => {
      mockQueueManager.getJobStatus.mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest('http://localhost/api/extraction/status/job-123')
      const response = await GET(request, { params: { jobId: 'job-123' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Database connection failed')
      expect(data.code).toBe('STATUS_CHECK_FAILED')
    })
  })
})
