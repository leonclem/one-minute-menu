/**
 * Error Scenario Tests for Stage 1 Extraction
 * 
 * Tests various error conditions:
 * - Poor image quality
 * - API failures (rate limiting, service unavailable)
 * - Quota exceeded
 * - Invalid responses
 * - Network errors
 */

import { MenuExtractionService } from '../menu-extraction-service'
import { JobQueueManager, JobQueueError } from '../job-queue'
import { ExtractionErrorHandler, ExtractionError } from '../error-handler'
import { HttpError } from '@/lib/retry'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { describe } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock OpenAI
const mockCreate = jest.fn()
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  }
})

// Mock retry module
jest.mock('@/lib/retry', () => ({
  withRetry: jest.fn((fn) => fn()),
  HttpError: class HttpError extends Error {
    constructor(message: string, public status: number, public body?: any) {
      super(message)
      this.name = 'HttpError'
    }
  }
}))

describe('Error Scenario Tests', () => {
  let service: MenuExtractionService
  let queueManager: JobQueueManager
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreate.mockReset()

    // Mock Supabase client
    const chain: any = {}
    chain.from = jest.fn().mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.insert = jest.fn().mockReturnValue(chain)
    chain.update = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.gte = jest.fn().mockReturnValue(chain)
    chain.order = jest.fn().mockReturnValue(chain)
    chain.limit = jest.fn().mockReturnValue(chain)
    chain.single = jest.fn()
    chain.maybeSingle = jest.fn()

    mockSupabase = chain

    service = new MenuExtractionService('test-api-key', mockSupabase)
    queueManager = new JobQueueManager(mockSupabase)
  })

  describe('API Error Scenarios', () => {
    it('should handle rate limiting (429) error', async () => {
      const error = new HttpError('Rate limit exceeded', 429, {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error'
        }
      })

      const response = await ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.retryable).toBe(true)
      expect(response.retryAfter).toBeGreaterThan(0)
      expect(response.message).toContain('rate limit')
    })

    it('should handle service unavailable (503) error', async () => {
      const error = new HttpError('Service unavailable', 503)

      const response = await ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.retryable).toBe(true)
      expect(response.message).toContain('temporarily unavailable')
    })

    it('should handle token limit exceeded (400) error', async () => {
      const error = new HttpError('Token limit exceeded', 400, {
        error: {
          message: 'This model\'s maximum context length is exceeded',
          type: 'invalid_request_error'
        }
      })

      const response = await ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.retryable).toBe(false)
      expect(response.fallbackMode).toBe('manual_entry')
      expect(response.guidance).toBeDefined()
    })

    it('should handle authentication error (401)', async () => {
      const error = new HttpError('Invalid API key', 401)

      const response = await ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.retryable).toBe(false)
    })

    it('should handle generic API error', async () => {
      const error = new HttpError('Unknown error', 500)

      const response = await ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.retryable).toBe(true) // 500 errors are retryable
    })
  })

  describe('Poor Image Quality Scenarios', () => {
    it('should reject very low confidence extraction', () => {
      const assessment = {
        quality: 'unacceptable' as const,
        overallConfidence: 0.25,
        issues: ['Text is too blurry', 'Poor lighting'],
        recommendations: [
          'Ensure good lighting',
          'Hold camera steady',
          'Avoid glare and shadows'
        ]
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response).not.toBeNull()
      expect(response?.success).toBe(false)
      expect(response?.retryable).toBe(false)
      expect(response?.fallbackMode).toBe('manual_entry')
      expect(response?.guidance).toBeDefined()
      expect(Array.isArray(response?.guidance)).toBe(true)
    })

    it('should warn about low confidence extraction', () => {
      const assessment = {
        quality: 'fair' as const,
        overallConfidence: 0.55,
        issues: ['Some text unclear'],
        recommendations: ['Review extracted items carefully']
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response).not.toBeNull()
      expect(response?.success).toBe(true)
      expect(response?.partial).toBe(true)
      expect(response?.requiresReview).toBe(true)
      expect(response?.message).toContain('fair quality')
    })

    it('should accept high confidence extraction', () => {
      const assessment = {
        quality: 'excellent' as const,
        overallConfidence: 0.90,
        issues: [],
        recommendations: []
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response).toBeNull() // No error for excellent quality
    })

    it('should provide helpful guidance for poor image quality', () => {
      const assessment = {
        quality: 'poor' as const,
        overallConfidence: 0.20,
        issues: ['Poor lighting', 'Blurry text'],
        recommendations: [
          'Ensure good lighting',
          'Hold camera steady',
          'Avoid glare and shadows',
          'Try photographing menu sections separately'
        ]
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response?.guidance).toBeDefined()
      const guidance = Array.isArray(response?.guidance) ? response?.guidance : [response?.guidance]
      
      expect(guidance.some(g => g.includes('lighting'))).toBe(true)
      expect(guidance.some(g => g.includes('steady'))).toBe(true)
    })
  })

  describe('Validation Error Scenarios', () => {
    it('should handle invalid JSON response', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'This is not valid JSON'
          }
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 100,
          total_tokens: 1100
        }
      })

      await expect(
        service.processWithVisionLLM(mockImageUrl, mockPromptPackage)
      ).rejects.toThrow('Failed to parse extraction result as JSON')
    })

    it('should handle schema validation failure', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      // Return invalid schema (empty categories)
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              menu: {
                categories: []
              },
              currency: 'USD',
              uncertainItems: [],
              superfluousText: []
            })
          }
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 100,
          total_tokens: 1100
        }
      })

      await expect(
        service.processWithVisionLLM(mockImageUrl, mockPromptPackage)
      ).rejects.toThrow('Extraction result validation failed')
    })

    it('should salvage partial data from invalid response', () => {
      const partiallyInvalidData = {
        menu: {
          categories: [
            {
              name: 'Valid Category',
              items: [
                {
                  name: 'Valid Item',
                  price: 10,
                  confidence: 1.0
                },
                {
                  name: 'Invalid Item',
                  price: -5, // Invalid price
                  confidence: 1.0
                }
              ],
              confidence: 1.0
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      const validationResult = {
        valid: false,
        errors: [
          { path: 'menu.categories[0].items[1].price', message: 'Price cannot be negative' }
        ],
        warnings: []
      }

      const salvageAttempt = {
        salvaged: {
          menu: {
            categories: [
              {
                name: 'Valid Category',
                items: [
                  {
                    name: 'Valid Item',
                    price: 10,
                    confidence: 1.0
                  }
                ],
                confidence: 1.0
              }
            ]
          },
          currency: 'SGD',
          uncertainItems: [],
          superfluousText: []
        },
        itemsRecovered: 1,
        categoriesRecovered: 1
      }

      const response = ExtractionErrorHandler.handleValidationError(
        validationResult,
        partiallyInvalidData,
        salvageAttempt
      )

      expect(response.success).toBe(true)
      expect(response.partial).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.warnings).toBeDefined()
    })

    it('should fail if no salvageable data', () => {
      const completelyInvalidData = {
        menu: {
          categories: [
            {
              name: '',
              items: [
                {
                  name: '',
                  price: -10,
                  confidence: 2.0
                }
              ],
              confidence: -1
            }
          ]
        },
        currency: '',
        uncertainItems: [],
        superfluousText: []
      }

      const validationResult = {
        valid: false,
        errors: [
          { path: 'menu.categories[0].name', message: 'Name cannot be empty' },
          { path: 'menu.categories[0].items[0].price', message: 'Price cannot be negative' }
        ],
        warnings: []
      }

      const response = ExtractionErrorHandler.handleValidationError(
        validationResult,
        completelyInvalidData
        // No salvage attempt - complete failure
      )

      expect(response.success).toBe(false)
      expect(response.retryable).toBe(true)
      expect(response.fallbackMode).toBe('retry')
    })
  })

  describe('Quota Exceeded Scenarios', () => {
    it('should reject job when monthly quota exceeded', async () => {
      const mockUserId = 'user-123'

      // Mock user profile with free plan
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          plan: 'free',
          plan_limits: { ocr_jobs: 5 }
        },
        error: null
      })

      // Mock count showing quota exceeded
      mockSupabase.gte.mockResolvedValueOnce({
        count: 5,
        error: null
      })

      const result = await queueManager.checkQuota(mockUserId)

      expect(result.allowed).toBe(false)
      expect(result.current).toBe(5)
      expect(result.limit).toBe(5)
      expect(result.reason).toContain('Monthly extraction limit reached')
    })

    it('should reject job when rate limit exceeded', async () => {
      const mockUserId = 'user-123'

      // Mock count showing rate limit exceeded
      mockSupabase.gte.mockResolvedValueOnce({
        count: 10,
        error: null
      })

      const result = await queueManager.checkRateLimit(mockUserId, 10)

      expect(result.allowed).toBe(false)
      expect(result.current).toBe(10)
      expect(result.limit).toBe(10)
      expect(result.resetAt).toBeInstanceOf(Date)
    })

    it('should allow job when under quota', async () => {
      const mockUserId = 'user-123'

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: mockUserId,
          plan: 'premium',
          plan_limits: { ocr_jobs: 50 }
        },
        error: null
      })

      mockSupabase.gte.mockResolvedValueOnce({
        count: 10,
        error: null
      })

      const result = await queueManager.checkQuota(mockUserId)

      expect(result.allowed).toBe(true)
      expect(result.current).toBe(10)
      expect(result.limit).toBe(50)
    })
  })

  describe('Network Error Scenarios', () => {
    it('should handle image fetch failure', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'

      // Mock image fetch failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      await expect(
        service.submitExtractionJob(mockImageUrl, mockUserId)
      ).rejects.toThrow()
    })

    it('should handle image fetch with non-OK status', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }) as any

      await expect(
        service.submitExtractionJob(mockImageUrl, mockUserId)
      ).rejects.toThrow()
    })
  })

  describe('Database Error Scenarios', () => {
    it('should handle job creation failure', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      // Mock no existing job
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Mock insert failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' }
      })

      await expect(
        queueManager.submitJob(mockUserId, mockImageUrl, 'test-hash')
      ).rejects.toThrow(JobQueueError)
    })

    it('should handle job status retrieval failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' }
      })

      await expect(
        queueManager.getJobStatus('job-123', 'user-123')
      ).rejects.toThrow(JobQueueError)
    })
  })

  describe('Retry Scenarios', () => {
    it('should allow retry for failed job', async () => {
      const failedJob = {
        id: 'job-123',
        user_id: 'user-456',
        image_url: 'https://example.com/image.jpg',
        image_hash: 'abc123',
        status: 'failed',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        retry_count: 1,
        error_message: 'API rate limit exceeded',
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

      // Mock getJobStatus call
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: failedJob,
                error: null
              })
            })
          })
        })
      })

      // Mock insert for retry
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: newJob,
              error: null
            })
          })
        })
      })

      const job = await queueManager.retryJob('job-123', 'user-456')

      expect(job.id).toBe('job-456')
      expect(job.status).toBe('queued')
      expect(job.retryCount).toBe(2)
    })

    it('should reject retry when max retries exceeded', async () => {
      const failedJob = {
        id: 'job-123',
        user_id: 'user-456',
        status: 'failed',
        retry_count: 3, // Max retries
        created_at: new Date().toISOString()
      }

      // Mock the getJobStatus call within retryJob
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: failedJob,
                error: null
              })
            })
          })
        })
      })

      await expect(
        queueManager.retryJob('job-123', 'user-456')
      ).rejects.toThrow('Maximum retry attempts')
    })

    it('should reject retry for non-failed job', async () => {
      const completedJob = {
        id: 'job-123',
        user_id: 'user-456',
        status: 'completed',
        retry_count: 0,
        created_at: new Date().toISOString()
      }

      // Mock the getJobStatus call within retryJob
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: completedJob,
                error: null
              })
            })
          })
        })
      })

      await expect(
        queueManager.retryJob('job-123', 'user-456')
      ).rejects.toThrow('Can only retry failed jobs')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty API response', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      mockCreate.mockResolvedValue({
        choices: [],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 0,
          total_tokens: 1000
        }
      })

      await expect(
        service.processWithVisionLLM(mockImageUrl, mockPromptPackage)
      ).rejects.toThrow()
    })

    it('should handle missing usage data in API response', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              menu: {
                categories: [{
                  name: 'Test',
                  items: [{ name: 'Item', price: 10, confidence: 0.9 }],
                  confidence: 0.9
                }]
              },
              currency: 'USD',
              uncertainItems: [],
              superfluousText: []
            })
          }
        }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          total_tokens: 1500
        }
      })

      // Should not throw - usage is provided
      const result = await service.processWithVisionLLM(mockImageUrl, mockPromptPackage)
      expect(result).toBeDefined()
      expect(result.usage).toBeDefined()
    })

    it('should handle extremely large menu extraction', async () => {
      // Test with a menu that has many categories and items
      const largeMenu = {
        menu: {
          categories: Array.from({ length: 50 }, (_, i) => ({
            name: `Category ${i + 1}`,
            items: Array.from({ length: 20 }, (_, j) => ({
              name: `Item ${j + 1}`,
              price: 10 + j,
              confidence: 0.9
            })),
            confidence: 0.9
          }))
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const mockImageUrl = 'https://example.com/large-menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(largeMenu)
          }
        }],
        usage: {
          prompt_tokens: 5000,
          completion_tokens: 10000,
          total_tokens: 15000
        }
      })

      const result = await service.processWithVisionLLM(mockImageUrl, mockPromptPackage)

      expect(result.extractionResult.menu.categories).toHaveLength(50)
      expect(result.usage).toBeDefined()
      expect(result.usage.total_tokens).toBe(15000)
    })
  })
})
