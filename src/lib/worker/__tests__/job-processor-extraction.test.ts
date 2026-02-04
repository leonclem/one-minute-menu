/**
 * Unit tests for JobProcessor extraction logic
 */

import { JobProcessor } from '../job-processor'
import { PuppeteerRenderer } from '../puppeteer-renderer'
import { StorageClient } from '../storage-client'
import type { ExtractionJob } from '../database-client'
import { createMenuExtractionService } from '@/lib/extraction/menu-extraction-service'

// Mock dependencies
jest.mock('../puppeteer-renderer')
jest.mock('../storage-client')
jest.mock('../database-client', () => ({
  updateExtractionJobToCompleted: jest.fn(),
  updateExtractionJobToFailed: jest.fn(),
  updateJobToCompleted: jest.fn(),
  updateJobToFailed: jest.fn(),
  resetJobToPendingWithBackoff: jest.fn(),
  updateJobStatus: jest.fn(),
}))
jest.mock('@/lib/extraction/menu-extraction-service')
jest.mock('@/lib/supabase-worker', () => ({
  createWorkerSupabaseClient: jest.fn(() => ({})),
}))

import {
  updateExtractionJobToCompleted,
  updateExtractionJobToFailed,
} from '../database-client'

describe('JobProcessor Extraction', () => {
  let processor: JobProcessor
  let mockRenderer: jest.Mocked<PuppeteerRenderer>
  let mockStorageClient: jest.Mocked<StorageClient>
  let mockExtractionService: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockRenderer = {} as any
    mockStorageClient = {} as any
    
    mockExtractionService = {
      processWithVisionLLM: jest.fn(),
      getPromptPackageV2: jest.fn().mockReturnValue({ version: 'v2' }),
      calculateTokenUsage: jest.fn().mockReturnValue({ totalTokens: 100 }),
    }
    ;(createMenuExtractionService as jest.Mock).mockReturnValue(mockExtractionService)

    processor = new JobProcessor({
      renderer: mockRenderer,
      storageClient: mockStorageClient,
    })

    process.env.OPENAI_API_KEY = 'test-key'
  })

  describe('processExtraction()', () => {
    it('should successfully process an extraction job', async () => {
      // Arrange
      const job: ExtractionJob = {
        id: 'job-123',
        user_id: 'user-456',
        menu_id: 'menu-789',
        image_url: 'https://example.com/image.jpg',
        image_hash: 'hash123',
        status: 'queued',
        schema_version: 'stage2',
        prompt_version: 'v2.0',
        retry_count: 0,
        priority: 0,
        worker_id: null,
        available_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
      }

      const mockResult = {
        extractionResult: { menu: { categories: [] } },
        usage: { total_tokens: 100 },
        confidence: 0.95,
        uncertainItems: [],
        superfluousText: []
      }

      mockExtractionService.processWithVisionLLM.mockResolvedValue(mockResult)

      // Act
      await processor.processExtraction(job)

      // Assert
      expect(mockExtractionService.processWithVisionLLM).toHaveBeenCalledWith(
        job.image_url,
        expect.any(Object),
        expect.objectContaining({
          schemaVersion: job.schema_version,
          menuId: job.menu_id
        })
      )
      
      expect(updateExtractionJobToCompleted).toHaveBeenCalledWith(
        job.id,
        mockResult.extractionResult,
        expect.any(Number),
        expect.any(Object),
        mockResult.confidence,
        mockResult.uncertainItems,
        mockResult.superfluousText
      )
    })

    it('should handle extraction errors and fail job', async () => {
      // Arrange
      const job: ExtractionJob = {
        id: 'job-123',
        user_id: 'user-456',
        menu_id: null,
        image_url: 'https://example.com/image.jpg',
        image_hash: 'hash123',
        status: 'queued',
        schema_version: 'stage2',
        prompt_version: 'v2.0',
        retry_count: 0,
        priority: 0,
        worker_id: null,
        available_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
      }

      mockExtractionService.processWithVisionLLM.mockRejectedValue(new Error('AI Error'))

      // Act
      await processor.processExtraction(job)

      // Assert
      expect(updateExtractionJobToFailed).toHaveBeenCalledWith(
        job.id,
        'AI Error'
      )
    })

    it('should fail if OPENAI_API_KEY is missing', async () => {
      // Arrange
      delete process.env.OPENAI_API_KEY
      const job: any = { id: 'job-123' }

      // Act
      await processor.processExtraction(job)

      // Assert
      expect(updateExtractionJobToFailed).toHaveBeenCalledWith(
        job.id,
        expect.stringContaining('OPENAI_API_KEY not configured')
      )
    })
  })
})
