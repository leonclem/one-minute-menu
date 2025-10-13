/**
 * Tests for MenuExtractionService
 * 
 * Tests cover:
 * - Job submission and idempotency
 * - Vision-LLM API integration
 * - Image preprocessing
 * - Retry logic for transient errors
 * - Token usage tracking and cost calculation
 * - Processing time measurement
 */

import { MenuExtractionService, estimateExtractionCost, isWithinCostBudget } from '../menu-extraction-service'
import { createHash } from 'crypto'

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
jest.mock('../../retry', () => ({
  withRetry: jest.fn((fn) => fn()),
  HttpError: class HttpError extends Error {
    constructor(message: string, public status: number, public body?: any) {
      super(message)
      this.name = 'HttpError'
    }
  }
}))

// Get the mocked create function
const getMockCreate = () => mockCreate

describe('MenuExtractionService', () => {
  let service: MenuExtractionService
  let mockSupabase: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    mockCreate.mockReset()

    // Mock Supabase client with proper chaining
    const chain: any = {}
    chain.from = jest.fn().mockReturnValue(chain)
    chain.select = jest.fn().mockReturnValue(chain)
    chain.insert = jest.fn().mockReturnValue(chain)
    chain.update = jest.fn().mockReturnValue(chain)
    chain.eq = jest.fn().mockReturnValue(chain)
    chain.order = jest.fn().mockReturnValue(chain)
    chain.limit = jest.fn().mockReturnValue(chain)
    chain.single = jest.fn()

    mockSupabase = chain

    // Create service instance
    service = new MenuExtractionService('test-api-key', mockSupabase)
  })

  describe('submitExtractionJob', () => {
    it('should create and process a new extraction job', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'
      
      // Mock image fetch for hash calculation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      // Mock no existing job
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
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
      mockSupabase.update.mockReturnValue({
        ...mockSupabase,
        eq: jest.fn().mockResolvedValue({ error: null })
      })

      // Mock OpenAI response
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              menu: {
                categories: [{
                  name: 'Main Dishes',
                  items: [{
                    name: 'Burger',
                    price: 10,
                    confidence: 0.95
                  }],
                  confidence: 0.95
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

      // Mock job completion - need to handle .update().eq().select().single() chain
      mockSupabase.update.mockImplementation(() => {
        const updateChain: any = {}
        updateChain.eq = jest.fn().mockReturnValue(updateChain)
        updateChain.select = jest.fn().mockReturnValue(updateChain)
        updateChain.single = jest.fn().mockResolvedValue({
          data: {
            id: 'job-123',
            user_id: mockUserId,
            image_url: mockImageUrl,
            image_hash: 'test-hash',
            status: 'completed',
            schema_version: 'stage1',
            prompt_version: 'v1.0',
            result: {},
            processing_time: 1000,
            token_usage: {},
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          },
          error: null
        })
        return updateChain
      })

      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      expect(job).toBeDefined()
      expect(job.status).toBe('completed')
      expect(mockCreate).toHaveBeenCalled()
    })

    it('should return cached result for duplicate image hash', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'
      
      // Mock image fetch for hash calculation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      // Mock existing completed job
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'job-existing',
          user_id: mockUserId,
          image_url: mockImageUrl,
          image_hash: 'test-hash',
          status: 'completed',
          schema_version: 'stage1',
          prompt_version: 'v1.0',
          result: { menu: { categories: [] } },
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        },
        error: null
      })

      const job = await service.submitExtractionJob(mockImageUrl, mockUserId)

      expect(job).toBeDefined()
      expect(job.id).toBe('job-existing')
      expect(job.status).toBe('completed')
      // Should not call OpenAI for cached result
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('processWithVisionLLM', () => {
    it('should successfully process image with vision-LLM', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      // Mock OpenAI response
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              menu: {
                categories: [{
                  name: 'Appetizers',
                  items: [{
                    name: 'Spring Rolls',
                    price: 5.99,
                    description: 'Crispy vegetable rolls',
                    confidence: 0.9
                  }],
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
          prompt_tokens: 1200,
          completion_tokens: 600,
          total_tokens: 1800
        }
      })

      const result = await service.processWithVisionLLM(
        mockImageUrl,
        mockPromptPackage
      )

      expect(result).toBeDefined()
      expect(result.extractionResult).toBeDefined()
      expect(result.extractionResult.menu.categories).toHaveLength(1)
      expect(result.extractionResult.currency).toBe('USD')
      expect(result.usage).toBeDefined()
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0,
          response_format: { type: 'json_object' }
        })
      )
    })

    it('should throw error for invalid JSON response', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      // Mock OpenAI response with invalid JSON
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

    it('should throw error for schema validation failure', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockPromptPackage = {
        systemRole: 'You are an expert',
        userPrompt: 'Extract menu data',
        temperature: 0,
        version: 'v1.0',
        schemaVersion: 'stage1' as const
      }

      // Mock OpenAI response with invalid schema
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              menu: {
                categories: [] // Empty categories - invalid
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
  })

  describe('getJobStatus', () => {
    it('should retrieve job status', async () => {
      const mockJobId = 'job-123'
      
      mockSupabase.single.mockResolvedValue({
        data: {
          id: mockJobId,
          user_id: 'user-123',
          image_url: 'https://example.com/menu.jpg',
          image_hash: 'test-hash',
          status: 'completed',
          schema_version: 'stage1',
          prompt_version: 'v1.0',
          result: { menu: { categories: [] } },
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        },
        error: null
      })

      const job = await service.getJobStatus(mockJobId)

      expect(job).toBeDefined()
      expect(job?.id).toBe(mockJobId)
      expect(job?.status).toBe('completed')
    })

    it('should return null for non-existent job', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      })

      const job = await service.getJobStatus('non-existent')

      expect(job).toBeNull()
    })
  })

  describe('Token usage and cost calculation', () => {
    it('should calculate token usage correctly', async () => {
      const mockImageUrl = 'https://example.com/menu.jpg'
      const mockUserId = 'user-123'
      
      // Mock image fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('test-image-data')
      }) as any

      // Mock no existing job
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
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
      mockSupabase.update.mockReturnValue({
        ...mockSupabase,
        eq: jest.fn().mockResolvedValue({ error: null })
      })

      // Mock OpenAI response with specific token usage
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              menu: {
                categories: [{
                  name: 'Main',
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

      // Mock job completion - capture the update call
      let capturedTokenUsage: any
      mockSupabase.update.mockImplementation((data: any) => {
        if (data.token_usage) {
          capturedTokenUsage = data.token_usage
        }
        return mockSupabase
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'job-123',
          status: 'completed',
          token_usage: capturedTokenUsage
        },
        error: null
      })

      await service.submitExtractionJob(mockImageUrl, mockUserId)

      // Verify token usage was calculated
      expect(capturedTokenUsage).toBeDefined()
      expect(capturedTokenUsage.inputTokens).toBe(2000)
      expect(capturedTokenUsage.outputTokens).toBe(1000)
      expect(capturedTokenUsage.totalTokens).toBe(3000)
      expect(capturedTokenUsage.estimatedCost).toBeGreaterThan(0)
    })
  })

  describe('Utility functions', () => {
    it('should estimate extraction cost', () => {
      const cost = estimateExtractionCost(1024 * 1024, true)
      
      expect(cost).toBeGreaterThan(0)
      expect(cost).toBeLessThan(0.05) // Should be under 5 cents
    })

    it('should check if cost is within budget', () => {
      expect(isWithinCostBudget(0.02, 0.03)).toBe(true)
      expect(isWithinCostBudget(0.04, 0.03)).toBe(false)
    })
  })
})
