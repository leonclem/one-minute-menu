/**
 * Integration Tests for Full Extraction Flow
 * 
 * Tests the complete extraction pipeline from image upload to result retrieval
 */

import { MenuExtractionService } from '@/lib/extraction/menu-extraction-service'
import { JobQueueManager } from '@/lib/extraction/job-queue'
import { SchemaValidator } from '@/lib/extraction/schema-validator'
import { getPromptPackage } from '@/lib/extraction/prompt-stage1'

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

describe('Full Extraction Flow Integration Tests', () => {
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

  describe('End-to-end extraction flow', () => {
    it('should complete full extraction flow successfully', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'

      // Mock image fetch for hash calculation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      // Step 1: Check quota
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

      // Step 2: Check for existing job (none found)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Step 3: Create new job
      const mockJob = {
        id: 'job-123',
        user_id: mockUserId,
        image_url: mockImageUrl,
        image_hash: 'test-hash',
        status: 'queued',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        retry_count: 0,
        created_at: new Date().toISOString()
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: mockJob,
        error: null
      })

      // Step 4: Process with vision-LLM
      const mockExtractionResult = {
        menu: {
          categories: [
            {
              name: 'APPETIZERS',
              items: [
                {
                  name: 'Spring Rolls',
                  price: 5.99,
                  description: 'Crispy vegetable rolls',
                  confidence: 0.95
                },
                {
                  name: 'Garlic Bread',
                  price: 4.50,
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            },
            {
              name: 'MAIN DISHES',
              items: [
                {
                  name: 'Grilled Chicken',
                  price: 12.99,
                  description: 'With seasonal vegetables',
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockExtractionResult)
          }
        }],
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 800,
          total_tokens: 2300
        }
      })

      // Step 5: Update job status to processing
      mockSupabase.eq.mockResolvedValueOnce({ error: null })

      // Step 6: Complete job with results
      const completedJob = {
        ...mockJob,
        status: 'completed',
        result: mockExtractionResult,
        processing_time: 3500,
        token_usage: {
          inputTokens: 1500,
          outputTokens: 800,
          totalTokens: 2300,
          estimatedCost: 0.025
        },
        confidence: 0.95,
        completed_at: new Date().toISOString()
      }

      mockSupabase.update.mockImplementation(() => {
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: completedJob,
          error: null
        })
        return updateChain
      })

      // Execute full flow
      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      // Verify results
      expect(job).toBeDefined()
      expect(job.status).toBe('completed')
      expect(job.result).toBeDefined()
      expect(job.result?.menu.categories).toHaveLength(2)
      expect(job.result?.currency).toBe('USD')
      expect(job.processingTime).toBeGreaterThan(0)
      expect(job.tokenUsage).toBeDefined()
      expect(job.tokenUsage?.estimatedCost).toBeGreaterThan(0)

      // Verify OpenAI was called with correct parameters
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0,
          response_format: { type: 'json_object' }
        })
      )
    })

    it('should handle extraction with uncertain items', async () => {
      const mockImageUrl = 'https://example.com/unclear-menu.jpg'
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

      // Mock job creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'job-123',
          user_id: mockUserId,
          image_url: mockImageUrl,
          image_hash: 'test-hash',
          status: 'queued',
          schema_version: 'stage1',
          prompt_version: 'v1.0',
          created_at: new Date().toISOString()
        },
        error: null
      })

      // Mock status update
      mockSupabase.eq.mockResolvedValue({ error: null })

      // Mock extraction with uncertainties
      const mockExtractionResult = {
        menu: {
          categories: [
            {
              name: 'SPECIALS',
              items: [
                {
                  name: 'Chef Special',
                  price: 18.00,
                  confidence: 0.75
                }
              ],
              confidence: 0.75
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [
          {
            text: 'Seasonal Soup',
            reason: 'Price not clearly visible',
            confidence: 0.45,
            suggestedCategory: 'SPECIALS',
            suggestedPrice: 8.00
          }
        ],
        superfluousText: [
          {
            text: 'Follow us @restaurant',
            context: 'Bottom of menu',
            confidence: 0.95
          }
        ]
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockExtractionResult)
          }
        }],
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 600,
          total_tokens: 1800
        }
      })

      // Mock job completion
      mockSupabase.update.mockImplementation(() => {
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: {
            id: 'job-123',
            status: 'completed',
            result: mockExtractionResult,
            uncertain_items: mockExtractionResult.uncertainItems,
            superfluous_text: mockExtractionResult.superfluousText,
            confidence: 0.75
          },
          error: null
        })
        return updateChain
      })

      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      expect(job.status).toBe('completed')
      expect(job.result?.uncertainItems).toHaveLength(1)
      expect(job.result?.superfluousText).toHaveLength(1)
      expect(job.result?.uncertainItems[0].reason).toContain('Price not clearly visible')
    })

    it('should handle hierarchical categories correctly', async () => {
      const mockImageUrl = 'https://example.com/hierarchical-menu.jpg'
      const mockUserId = 'user-123'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'job-123',
          user_id: mockUserId,
          image_url: mockImageUrl,
          image_hash: 'test-hash',
          status: 'queued',
          schema_version: 'stage1',
          prompt_version: 'v1.0',
          created_at: new Date().toISOString()
        },
        error: null
      })

      mockSupabase.eq.mockResolvedValue({ error: null })

      const mockExtractionResult = {
        menu: {
          categories: [
            {
              name: 'PREMIUM STEAKS',
              items: [],
              subcategories: [
                {
                  name: 'BIG CUTS',
                  items: [
                    {
                      name: 'Ribeye 500g',
                      price: 45.00,
                      confidence: 0.90
                    }
                  ],
                  confidence: 0.90
                },
                {
                  name: 'PREMIUM CUTS',
                  items: [
                    {
                      name: 'Wagyu Sirloin 300g',
                      price: 68.00,
                      confidence: 0.90
                    }
                  ],
                  confidence: 0.90
                }
              ],
              confidence: 0.90
            }
          ]
        },
        currency: 'SGD',
        uncertainItems: [],
        superfluousText: []
      }

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockExtractionResult)
          }
        }],
        usage: {
          prompt_tokens: 1800,
          completion_tokens: 900,
          total_tokens: 2700
        }
      })

      mockSupabase.update.mockImplementation(() => {
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: {
            id: 'job-123',
            status: 'completed',
            result: mockExtractionResult,
            confidence: 0.90
          },
          error: null
        })
        return updateChain
      })

      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      expect(job.status).toBe('completed')
      expect(job.result?.menu.categories).toHaveLength(1)
      expect(job.result?.menu.categories[0].subcategories).toHaveLength(2)
      expect(job.result?.menu.categories[0].subcategories?.[0].name).toBe('BIG CUTS')
      expect(job.result?.menu.categories[0].subcategories?.[1].name).toBe('PREMIUM CUTS')
    })
  })

  describe('Idempotency', () => {
    it('should return cached result for duplicate image', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      const existingJob = {
        id: 'job-existing',
        user_id: mockUserId,
        image_url: mockImageUrl,
        image_hash: 'test-hash',
        status: 'completed',
        schema_version: 'stage1',
        prompt_version: 'v1.0',
        result: {
          menu: { categories: [] },
          currency: 'USD',
          uncertainItems: [],
          superfluousText: []
        },
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      }

      mockSupabase.maybeSingle.mockResolvedValue({
        data: existingJob,
        error: null
      })

      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      expect(job.id).toBe('job-existing')
      expect(job.status).toBe('completed')
      // Should not call OpenAI for cached result
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('Cost tracking', () => {
    it('should track token usage and cost accurately', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'job-123',
          user_id: mockUserId,
          image_url: mockImageUrl,
          image_hash: 'test-hash',
          status: 'queued',
          schema_version: 'stage1',
          prompt_version: 'v1.0',
          created_at: new Date().toISOString()
        },
        error: null
      })

      mockSupabase.eq.mockResolvedValue({ error: null })

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
          prompt_tokens: 2000,
          completion_tokens: 1000,
          total_tokens: 3000
        }
      })

      let capturedTokenUsage: any
      mockSupabase.update.mockImplementation((data: any) => {
        if (data.token_usage) {
          capturedTokenUsage = data.token_usage
        }
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: {
            id: 'job-123',
            status: 'completed',
            token_usage: data.token_usage
          },
          error: null
        })
        return updateChain
      })

      await service.submitExtractionJob(mockImageUrl, mockUserId)

      expect(capturedTokenUsage).toBeDefined()
      expect(capturedTokenUsage.inputTokens).toBe(2000)
      expect(capturedTokenUsage.outputTokens).toBe(1000)
      expect(capturedTokenUsage.totalTokens).toBe(3000)
      expect(capturedTokenUsage.estimatedCost).toBeGreaterThan(0)
      expect(capturedTokenUsage.estimatedCost).toBeLessThan(0.05) // Should be under 5 cents
    })
  })

  describe('Schema validation', () => {
    it('should validate extraction result against schema', async () => {
      const validator = new SchemaValidator()

      const validResult = {
        menu: {
          categories: [
            {
              name: 'Test Category',
              items: [
                {
                  name: 'Test Item',
                  price: 10.00,
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(validResult)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should reject invalid extraction result', async () => {
      const validator = new SchemaValidator()

      const invalidResult = {
        menu: {
          categories: [] // Empty categories - invalid
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const validation = validator.validateExtractionResult(invalidResult)

      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })
})
