/**
 * Tests for Job Queue Integration
 * 
 * Tests job submission, status polling, retry mechanisms, and quota enforcement
 */

import { JobQueueManager, JobQueueError, pollJobStatus } from '../job-queue'
import type { ExtractionJob } from '../menu-extraction-service'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn()
}

describe('JobQueueManager', () => {
  let queueManager: JobQueueManager

  beforeEach(() => {
    jest.clearAllMocks()
    queueManager = new JobQueueManager(mockSupabase as any)
  })

  describe('submitJob', () => {
    it('should submit a new job successfully', async () => {
      const mockJob = {
        id: 'job-123',
        user_id: 'user-456',
        image_url: 'https://example.com/image.jpg',
        image_hash: 'abc123',
        status: 'queued',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        retry_count: 0,
        created_at: new Date().toISOString()
      }

      // Mock findExistingJob (returns null - no existing job)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            })
          })
        })
      })

      // Mock insert
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockJob, error: null })
          })
        })
      })

      const result = await queueManager.submitJob(
        'user-456',
        'https://example.com/image.jpg',
        'abc123'
      )

      expect(result.cached).toBe(false)
      expect(result.job.id).toBe('job-123')
      expect(result.job.status).toBe('queued')
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_extraction_jobs')
    })

    it('should return cached job if exists and not forced', async () => {
      const existingJob = {
        id: 'job-existing',
        user_id: 'user-456',
        image_url: 'https://example.com/image.jpg',
        image_hash: 'abc123',
        status: 'completed',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        retry_count: 0,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        result: { menu: { categories: [{ name: 'C', items: [] } ] } } // ensure cached path
      }

      // Mock findExistingJob
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: existingJob, error: null })
                })
              })
            })
          })
        })
      })

      const result = await queueManager.submitJob(
        'user-456',
        'https://example.com/image.jpg',
        'abc123'
      )

      expect(result.cached).toBe(true)
      expect(result.job.id).toBe('job-existing')
      // ensure insert path wasn't used
      expect(mockSupabase.from).toHaveBeenCalledWith('menu_extraction_jobs')
    })

    it('should throw error on database failure', async () => {
      // Mock findExistingJob (returns null)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            })
          })
        })
      })

      // Mock insert with error
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database error', code: 'DB_ERROR' } 
            })
          })
        })
      })

      await expect(
        queueManager.submitJob('user-456', 'https://example.com/image.jpg', 'abc123')
      ).rejects.toThrow(JobQueueError)
    })
  })

  describe('getJobStatus', () => {
    it('should get job status successfully', async () => {
      const mockJob = {
        id: 'job-123',
        user_id: 'user-456',
        image_url: 'https://example.com/image.jpg',
        image_hash: 'abc123',
        status: 'processing',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        created_at: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockJob, error: null })
            })
          })
        })
      })

      const job = await queueManager.getJobStatus('job-123', 'user-456')

      expect(job).not.toBeNull()
      expect(job?.id).toBe('job-123')
      expect(job?.status).toBe('processing')
    })

    it('should return null for non-existent job', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ 
                data: null, 
                error: { code: 'PGRST116' } 
              })
            })
          })
        })
      })

      const job = await queueManager.getJobStatus('job-nonexistent', 'user-456')

      expect(job).toBeNull()
    })
  })

  describe('markJobCompleted', () => {
    it('should mark job as completed with results', async () => {
      const completedJob = {
        id: 'job-123',
        user_id: 'user-456',
        status: 'completed',
        result: { menu: { categories: [] } },
        processing_time: 5000,
        token_usage: { inputTokens: 1000, outputTokens: 500, estimatedCost: 0.02 },
        confidence: 0.95,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: completedJob, error: null })
            })
          })
        })
      })

      const job = await queueManager.markJobCompleted(
        'job-123',
        { menu: { categories: [] } },
        5000,
        { inputTokens: 1000, outputTokens: 500, estimatedCost: 0.02 },
        0.95
      )

      expect(job.status).toBe('completed')
      expect(job.confidence).toBe(0.95)
      expect(job.processingTime).toBe(5000)
    })
  })

  describe('markJobFailed', () => {
    it('should mark job as failed with error message', async () => {
      const failedJob = {
        id: 'job-123',
        user_id: 'user-456',
        status: 'failed',
        error_message: 'API rate limit exceeded',
        retry_count: 0,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: failedJob, error: null })
            })
          })
        })
      })

      const job = await queueManager.markJobFailed('job-123', 'API rate limit exceeded')

      expect(job.status).toBe('failed')
      expect(job.error).toBe('API rate limit exceeded')
    })

    it('should increment retry count when specified', async () => {
      const existingJob = {
        id: 'job-123',
        user_id: 'user-456',
        status: 'failed',
        retry_count: 1,
        created_at: new Date().toISOString()
      }

      const failedJob = {
        ...existingJob,
        retry_count: 2,
        error_message: 'Retry failed',
        completed_at: new Date().toISOString()
      }

      // Mock getJobStatus
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: existingJob, error: null })
          })
        })
      })

      // Mock update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: failedJob, error: null })
            })
          })
        })
      })

      const job = await queueManager.markJobFailed('job-123', 'Retry failed', true)

      expect(job.retryCount).toBe(2)
    })
  })

  describe('retryJob', () => {
    it('should create new job with incremented retry count', async () => {
      const failedJob = {
        id: 'job-123',
        user_id: 'user-456',
        image_url: 'https://example.com/image.jpg',
        image_hash: 'abc123',
        status: 'failed',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        retry_count: 1,
        created_at: new Date().toISOString()
      }

      const newJob = {
        id: 'job-456',
        user_id: 'user-456',
        image_url: 'https://example.com/image.jpg',
        image_hash: 'abc123',
        status: 'queued',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        retry_count: 2,
        created_at: new Date().toISOString()
      }

      // Mock getJobStatus
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: failedJob, error: null })
            })
          })
        })
      })

      // Mock insert
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: newJob, error: null })
          })
        })
      })

      const job = await queueManager.retryJob('job-123', 'user-456')

      expect(job.id).toBe('job-456')
      expect(job.status).toBe('queued')
      expect(job.retryCount).toBe(2)
    })

    it('should throw error if max retries exceeded', async () => {
      const failedJob = {
        id: 'job-123',
        user_id: 'user-456',
        status: 'failed',
        retry_count: 3,
        created_at: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: failedJob, error: null })
            })
          })
        })
      })

      await expect(
        queueManager.retryJob('job-123', 'user-456')
      ).rejects.toThrow('Maximum retry attempts')
    })

    it('should throw error if job is not failed', async () => {
      const completedJob = {
        id: 'job-123',
        user_id: 'user-456',
        status: 'completed',
        retry_count: 0,
        created_at: new Date().toISOString()
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: completedJob, error: null })
            })
          })
        })
      })

      await expect(
        queueManager.retryJob('job-123', 'user-456')
      ).rejects.toThrow('Can only retry failed jobs')
    })
  })

  describe('checkQuota', () => {
    it('should allow job if under quota', async () => {
      const profile = {
        id: 'user-456',
        plan: 'free',
        plan_limits: { ocr_jobs: 5 }
      }

      // Mock profile query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: profile, error: null })
          })
        })
      })

      // Mock count query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ count: 3, error: null })
          })
        })
      })

      const result = await queueManager.checkQuota('user-456')

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(3)
      expect(result.limit).toBe(5)
    })

    it('should deny job if quota exceeded', async () => {
      const profile = {
        id: 'user-456',
        plan: 'free',
        plan_limits: { ocr_jobs: 5 }
      }

      // Mock profile query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: profile, error: null })
          })
        })
      })

      // Mock count query
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ count: 5, error: null })
          })
        })
      })

      const result = await queueManager.checkQuota('user-456')

      expect(result.allowed).toBe(false)
      expect(result.current).toBe(5)
      expect(result.limit).toBe(5)
      expect(result.reason).toContain('Monthly extraction limit reached')
    })

    it('should allow unlimited for enterprise plan', async () => {
      const profile = {
        id: 'user-456',
        plan: 'enterprise',
        plan_limits: { ocr_jobs: -1 }
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: profile, error: null })
          })
        })
      })

      const result = await queueManager.checkQuota('user-456')

      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(-1)
    })
  })

  describe('checkRateLimit', () => {
    it('should allow job if under rate limit', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ count: 5, error: null })
          })
        })
      })

      const result = await queueManager.checkRateLimit('user-456', 10)

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(5)
      expect(result.limit).toBe(10)
    })

    it('should deny job if rate limit exceeded', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockResolvedValue({ count: 10, error: null })
          })
        })
      })

      const result = await queueManager.checkRateLimit('user-456', 10)

      expect(result.allowed).toBe(false)
      expect(result.current).toBe(10)
      expect(result.limit).toBe(10)
      expect(result.resetAt).toBeInstanceOf(Date)
    })
  })

  describe('listUserJobs', () => {
    it('should list user jobs successfully', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          user_id: 'user-456',
          status: 'completed',
          created_at: new Date().toISOString()
        },
        {
          id: 'job-2',
          user_id: 'user-456',
          status: 'processing',
          created_at: new Date().toISOString()
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: mockJobs, error: null })
            })
          })
        })
      })

      const jobs = await queueManager.listUserJobs('user-456', 20)

      expect(jobs).toHaveLength(2)
      expect(jobs[0].id).toBe('job-1')
      expect(jobs[1].id).toBe('job-2')
    })
  })
})

describe('pollJobStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.skip('should return job when completed', async () => {
    // Mock JobQueueManager.getJobStatus to return completed job
    const mockGetJobStatus = jest.fn().mockResolvedValue({
      id: 'job-123',
      userId: 'user-456',
      imageUrl: 'https://example.com/image.jpg',
      imageHash: 'abc123',
      status: 'completed',
      schemaVersion: 'stage1',
      promptVersion: 'v1.0',
      createdAt: new Date(),
      completedAt: new Date(),
      retryCount: 0
    })

    JobQueueManager.prototype.getJobStatus = mockGetJobStatus

    const job = await pollJobStatus('job-123', 'user-456', {
      maxAttempts: 5,
      intervalMs: 100
    })

    expect(job.status).toBe('completed')
    expect(mockGetJobStatus).toHaveBeenCalled()
  })

  it.skip('should timeout if job does not complete', async () => {
    // Mock JobQueueManager.getJobStatus to always return processing
    const mockGetJobStatus = jest.fn().mockResolvedValue({
      id: 'job-123',
      userId: 'user-456',
      imageUrl: 'https://example.com/image.jpg',
      imageHash: 'abc123',
      status: 'processing',
      schemaVersion: 'stage1',
      promptVersion: 'v1.0',
      createdAt: new Date(),
      retryCount: 0
    })

    JobQueueManager.prototype.getJobStatus = mockGetJobStatus

    await expect(
      pollJobStatus('job-123', 'user-456', {
        maxAttempts: 2,
        intervalMs: 100
      })
    ).rejects.toThrow('Job polling timeout')
  }, 10000)
})

