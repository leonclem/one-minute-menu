/**
 * Unit tests for JobProcessor
 * 
 * Tests the job processing lifecycle including:
 * - Successful job completion
 * - Error handling and retry logic
 * - Storage path setting before upload
 */

import { JobProcessor } from '../job-processor'
import { PuppeteerRenderer } from '../puppeteer-renderer'
import { StorageClient } from '../storage-client'
import type { ExportJob } from '../database-client'
import type { RenderSnapshot } from '@/types'

// Mock dependencies
jest.mock('../puppeteer-renderer')
jest.mock('../storage-client', () => ({
  StorageClient: jest.fn(),
  generateStoragePath: jest.fn((userId, exportType, jobId) => {
    const ext = exportType === 'pdf' ? 'pdf' : 'png'
    return `${userId}/exports/${exportType}/${jobId}.${ext}`
  }),
  getFileExtension: jest.fn((exportType) => {
    return exportType === 'pdf' ? 'pdf' : 'png'
  }),
}))
jest.mock('../database-client', () => ({
  updateJobToCompleted: jest.fn(),
  updateJobToFailed: jest.fn(),
  resetJobToPendingWithBackoff: jest.fn(),
  updateJobStatus: jest.fn(),
}))
jest.mock('../snapshot', () => ({
  getRenderSnapshot: jest.fn(),
}))
jest.mock('../output-validator', () => ({
  validateOutput: jest.fn(),
}))

import {
  updateJobToCompleted,
  updateJobToFailed,
  resetJobToPendingWithBackoff,
  updateJobStatus,
} from '../database-client'
import { getRenderSnapshot } from '../snapshot'
import { validateOutput } from '../output-validator'

describe('JobProcessor', () => {
  let processor: JobProcessor
  let mockRenderer: jest.Mocked<PuppeteerRenderer>
  let mockStorageClient: jest.Mocked<StorageClient>

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create mock instances
    mockRenderer = {
      renderPDF: jest.fn(),
      renderImage: jest.fn(),
      shutdown: jest.fn(),
    } as any

    mockStorageClient = {
      upload: jest.fn(),
      generateSignedUrl: jest.fn(),
    } as any

    // Create processor instance
    processor = new JobProcessor({
      renderer: mockRenderer,
      storageClient: mockStorageClient,
      jobTimeoutSeconds: 60,
    })
  })

  describe('process()', () => {
    it('should successfully process a PDF export job', async () => {
      // Arrange
      const job: ExportJob = {
        id: 'job-123',
        user_id: 'user-456',
        menu_id: 'menu-789',
        export_type: 'pdf',
        status: 'processing',
        priority: 100,
        retry_count: 0,
        error_message: null,
        file_url: null,
        storage_path: null,
        available_at: new Date().toISOString(),
        metadata: {
          render_snapshot: {
            template_id: 'elegant-dark',
            template_version: '1.0',
            template_name: 'Elegant Dark',
            menu_data: {
              id: 'menu-789',
              name: 'Test Menu',
              description: 'A test menu',
              items: [
                {
                  id: 'item-1',
                  name: 'Test Item',
                  description: 'A test item',
                  price: 10.99,
                  currency: 'USD',
                  category: 'Main',
                  display_order: 0,
                },
              ],
            },
            export_options: {
              format: 'A4',
              orientation: 'portrait',
              include_images: true,
              include_prices: true,
            },
            snapshot_created_at: new Date().toISOString(),
            snapshot_version: '1.0',
          },
        },
        worker_id: 'worker-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
      }

      const mockPDFBuffer = Buffer.from('%PDF-1.4 test content')
      const mockPublicUrl = 'https://storage.supabase.co/bucket/file.pdf'
      const mockSignedUrl = 'https://storage.supabase.co/bucket/file.pdf?token=abc'

      // Mock implementations
      ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
      mockRenderer.renderPDF.mockResolvedValue(mockPDFBuffer)
      ;(validateOutput as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        file_size: mockPDFBuffer.length,
        format_verified: true,
      })
      mockStorageClient.upload.mockResolvedValue(mockPublicUrl)
      mockStorageClient.generateSignedUrl.mockResolvedValue(mockSignedUrl)

      // Act
      await processor.process(job)

      // Assert
      expect(getRenderSnapshot).toHaveBeenCalledWith(job.metadata)
      expect(mockRenderer.renderPDF).toHaveBeenCalled()
      expect(validateOutput).toHaveBeenCalledWith(mockPDFBuffer, 'pdf', undefined)
      
      // Verify storage_path is set BEFORE upload
      expect(updateJobStatus).toHaveBeenCalledWith(
        job.id,
        'processing',
        expect.objectContaining({
          storage_path: expect.stringContaining('user-456/exports/pdf/job-123.pdf'),
        })
      )
      
      expect(mockStorageClient.upload).toHaveBeenCalledWith(
        mockPDFBuffer,
        expect.stringContaining('user-456/exports/pdf/job-123.pdf'),
        'application/pdf'
      )
      
      expect(mockStorageClient.generateSignedUrl).toHaveBeenCalled()
      
      expect(updateJobToCompleted).toHaveBeenCalledWith(
        job.id,
        expect.stringContaining('user-456/exports/pdf/job-123.pdf'),
        mockSignedUrl
      )
    })

    it('should successfully process an image export job', async () => {
      // Arrange
      const job: ExportJob = {
        id: 'job-123',
        user_id: 'user-456',
        menu_id: 'menu-789',
        export_type: 'image',
        status: 'processing',
        priority: 10,
        retry_count: 0,
        error_message: null,
        file_url: null,
        storage_path: null,
        available_at: new Date().toISOString(),
        metadata: {
          render_snapshot: {
            template_id: 'elegant-dark',
            template_version: '1.0',
            template_name: 'Elegant Dark',
            menu_data: {
              id: 'menu-789',
              name: 'Test Menu',
              items: [],
            },
            export_options: {
              format: 'A4',
              orientation: 'portrait',
            },
            snapshot_created_at: new Date().toISOString(),
            snapshot_version: '1.0',
          },
        },
        worker_id: 'worker-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
      }

      const mockImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      const mockPublicUrl = 'https://storage.supabase.co/bucket/file.png'
      const mockSignedUrl = 'https://storage.supabase.co/bucket/file.png?token=abc'

      // Mock implementations
      ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
      mockRenderer.renderImage.mockResolvedValue(mockImageBuffer)
      ;(validateOutput as jest.Mock).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        file_size: mockImageBuffer.length,
        format_verified: true,
      })
      mockStorageClient.upload.mockResolvedValue(mockPublicUrl)
      mockStorageClient.generateSignedUrl.mockResolvedValue(mockSignedUrl)

      // Act
      await processor.process(job)

      // Assert
      expect(mockRenderer.renderImage).toHaveBeenCalled()
      expect(validateOutput).toHaveBeenCalledWith(mockImageBuffer, 'image', 'png')
      expect(mockStorageClient.upload).toHaveBeenCalledWith(
        mockImageBuffer,
        expect.stringContaining('user-456/exports/image/job-123.png'),
        'image/png'
      )
      expect(updateJobToCompleted).toHaveBeenCalled()
    })

    it('should handle validation errors and fail job permanently', async () => {
      // Arrange
      const job: ExportJob = {
        id: 'job-123',
        user_id: 'user-456',
        menu_id: 'menu-789',
        export_type: 'pdf',
        status: 'processing',
        priority: 100,
        retry_count: 0,
        error_message: null,
        file_url: null,
        storage_path: null,
        available_at: new Date().toISOString(),
        metadata: {
          render_snapshot: {
            template_id: 'elegant-dark',
            template_version: '1.0',
            template_name: 'Elegant Dark',
            menu_data: {
              id: 'menu-789',
              name: 'Test Menu',
              items: [],
            },
            export_options: {},
            snapshot_created_at: new Date().toISOString(),
            snapshot_version: '1.0',
          },
        },
        worker_id: 'worker-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
      }

      const mockPDFBuffer = Buffer.from('invalid pdf')

      // Mock implementations
      ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
      mockRenderer.renderPDF.mockResolvedValue(mockPDFBuffer)
      ;(validateOutput as jest.Mock).mockReturnValue({
        valid: false,
        errors: ['Invalid PDF signature'],
        warnings: [],
        file_size: mockPDFBuffer.length,
        format_verified: false,
      })

      // Act
      await processor.process(job)

      // Assert
      expect(updateJobToFailed).toHaveBeenCalledWith(
        job.id,
        expect.stringContaining('Export generated invalid output')
      )
      expect(mockStorageClient.upload).not.toHaveBeenCalled()
    })

    it('should retry transient errors with exponential backoff', async () => {
      // Arrange
      const job: ExportJob = {
        id: 'job-123',
        user_id: 'user-456',
        menu_id: 'menu-789',
        export_type: 'pdf',
        status: 'processing',
        priority: 100,
        retry_count: 1,
        error_message: null,
        file_url: null,
        storage_path: null,
        available_at: new Date().toISOString(),
        metadata: {
          render_snapshot: {
            template_id: 'elegant-dark',
            template_version: '1.0',
            template_name: 'Elegant Dark',
            menu_data: {
              id: 'menu-789',
              name: 'Test Menu',
              items: [],
            },
            export_options: {},
            snapshot_created_at: new Date().toISOString(),
            snapshot_version: '1.0',
          },
        },
        worker_id: 'worker-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
      }

      // Mock implementations - simulate network error
      ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
      mockRenderer.renderPDF.mockRejectedValue(new Error('ETIMEDOUT'))

      // Act
      await processor.process(job)

      // Assert
      expect(resetJobToPendingWithBackoff).toHaveBeenCalledWith(
        job.id,
        expect.any(Number), // retry delay
        expect.stringContaining('ETIMEDOUT')
      )
      expect(updateJobToFailed).not.toHaveBeenCalled()
    })

    it('should fail permanently after max retries', async () => {
      // Arrange
      const job: ExportJob = {
        id: 'job-123',
        user_id: 'user-456',
        menu_id: 'menu-789',
        export_type: 'pdf',
        status: 'processing',
        priority: 100,
        retry_count: 3, // Max retries reached
        error_message: null,
        file_url: null,
        storage_path: null,
        available_at: new Date().toISOString(),
        metadata: {
          render_snapshot: {
            template_id: 'elegant-dark',
            template_version: '1.0',
            template_name: 'Elegant Dark',
            menu_data: {
              id: 'menu-789',
              name: 'Test Menu',
              items: [],
            },
            export_options: {},
            snapshot_created_at: new Date().toISOString(),
            snapshot_version: '1.0',
          },
        },
        worker_id: 'worker-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
      }

      // Mock implementations - simulate network error
      ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
      mockRenderer.renderPDF.mockRejectedValue(new Error('ETIMEDOUT'))

      // Act
      await processor.process(job)

      // Assert
      expect(updateJobToFailed).toHaveBeenCalledWith(
        job.id,
        expect.any(String)
      )
      expect(resetJobToPendingWithBackoff).not.toHaveBeenCalled()
    })
  })

  describe('shutdown()', () => {
    it('should shutdown renderer on processor shutdown', async () => {
      // Act
      await processor.shutdown()

      // Assert
      expect(mockRenderer.shutdown).toHaveBeenCalled()
    })
  })
})
