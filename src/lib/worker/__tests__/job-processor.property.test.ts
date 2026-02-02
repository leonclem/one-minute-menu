/**
 * Property-Based Tests for JobProcessor
 * 
 * Tests universal properties that should hold across all job processing scenarios.
 */

import fc from 'fast-check'
import { JobProcessor } from '../job-processor'
import { PuppeteerRenderer } from '../puppeteer-renderer'
import { StorageClient } from '../storage-client'
import type { ExportJob } from '../database-client'

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
import { notificationService } from '@/lib/notification-service'

// Mock notification service
jest.mock('@/lib/notification-service', () => ({
  notificationService: {
    sendExportCompletionEmail: jest.fn(),
    sendExportFailureEmail: jest.fn(),
  },
}))

describe('JobProcessor Property-Based Tests', () => {
  // Helper function to create fresh mocks and processor for each property test iteration
  const createTestContext = () => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create mock instances
    const mockRenderer = {
      renderPDF: jest.fn(),
      renderImage: jest.fn(),
      shutdown: jest.fn(),
    } as any

    const mockStorageClient = {
      upload: jest.fn(),
      generateSignedUrl: jest.fn(),
    } as any

    // Create processor instance
    const processor = new JobProcessor({
      renderer: mockRenderer,
      storageClient: mockStorageClient,
      jobTimeoutSeconds: 60,
    })

    return { processor, mockRenderer, mockStorageClient }
  }

  // Feature: railway-workers, Property 6: Status Transition Completeness
  // Validates: Requirements 2.8
  describe('Property 6: Status Transition Completeness', () => {
    it('should ensure completed jobs have all required fields set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
            priority: fc.constantFrom(10, 100),
            retry_count: fc.integer({ min: 0, max: 2 }),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer, mockStorageClient } = createTestContext()
            // Arrange: Create a job
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: input.priority,
              retry_count: input.retry_count,
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
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

            // Mock successful rendering
            const mockOutput = input.export_type === 'pdf'
              ? Buffer.from('%PDF-1.4 test content')
              : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

            const mockPublicUrl = `https://storage.supabase.co/bucket/${input.job_id}.${input.export_type === 'pdf' ? 'pdf' : 'png'}`
            const mockSignedUrl = `${mockPublicUrl}?token=abc123`

            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockResolvedValue(mockOutput)
            } else {
              mockRenderer.renderImage.mockResolvedValue(mockOutput)
            }

            ;(validateOutput as jest.Mock).mockReturnValue({
              valid: true,
              errors: [],
              warnings: [],
              file_size: mockOutput.length,
              format_verified: true,
            })

            mockStorageClient.upload.mockResolvedValue(mockPublicUrl)
            mockStorageClient.generateSignedUrl.mockResolvedValue(mockSignedUrl)

            // Act: Process the job
            await processor.process(job)

            // Assert: Verify status transition completeness
            // Property: For any job that completes successfully, the final state should have:
            // 1. status='completed'
            // 2. completed_at timestamp set
            // 3. file_url populated with a valid storage URL

            expect(updateJobToCompleted).toHaveBeenCalledTimes(1)
            expect(updateJobToCompleted).toHaveBeenCalledWith(
              input.job_id,
              expect.stringMatching(new RegExp(`${input.user_id}/exports/${input.export_type}/${input.job_id}`)),
              mockSignedUrl
            )

            // Verify the call includes all required fields
            const [jobId, storagePath, fileUrl] = (updateJobToCompleted as jest.Mock).mock.calls[0]
            
            // 1. Job ID must be present
            expect(jobId).toBe(input.job_id)
            
            // 2. Storage path must be set (this implies completed_at will be set by the DB function)
            expect(storagePath).toBeTruthy()
            expect(storagePath).toMatch(new RegExp(`${input.user_id}/exports/${input.export_type}/${input.job_id}`))
            
            // 3. File URL must be a valid storage URL
            expect(fileUrl).toBeTruthy()
            expect(fileUrl).toContain('storage.supabase.co')
            expect(fileUrl).toContain(input.job_id)
            expect(fileUrl).toContain('token=') // Signed URL
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not mark job as completed if any required field is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer } = createTestContext()
            // Arrange: Create a job
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: 0,
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
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

            // Mock rendering that produces invalid output
            const mockOutput = Buffer.from('invalid output')

            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockResolvedValue(mockOutput)
            } else {
              mockRenderer.renderImage.mockResolvedValue(mockOutput)
            }

            ;(validateOutput as jest.Mock).mockReturnValue({
              valid: false,
              errors: ['Invalid format signature'],
              warnings: [],
              file_size: mockOutput.length,
              format_verified: false,
            })

            // Act: Process the job
            await processor.process(job)

            // Assert: Job should NOT be marked as completed
            // Property: If validation fails, job should not reach completed state
            expect(updateJobToCompleted).not.toHaveBeenCalled()
            
            // Instead, it should be marked as failed
            expect(updateJobToFailed).toHaveBeenCalledTimes(1)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 39: Storage-Then-Complete Ordering
  // Validates: storage_path must be set before status='completed'
  describe('Property 39: Storage-Then-Complete Ordering', () => {
    it('should set storage_path before marking job as completed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer, mockStorageClient } = createTestContext()
            // Arrange: Create a job
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: 0,
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
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

            // Mock successful rendering
            const mockOutput = input.export_type === 'pdf'
              ? Buffer.from('%PDF-1.4 test content')
              : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

            const mockPublicUrl = `https://storage.supabase.co/bucket/${input.job_id}.${input.export_type === 'pdf' ? 'pdf' : 'png'}`
            const mockSignedUrl = `${mockPublicUrl}?token=abc123`

            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockResolvedValue(mockOutput)
            } else {
              mockRenderer.renderImage.mockResolvedValue(mockOutput)
            }

            ;(validateOutput as jest.Mock).mockReturnValue({
              valid: true,
              errors: [],
              warnings: [],
              file_size: mockOutput.length,
              format_verified: true,
            })

            mockStorageClient.upload.mockResolvedValue(mockPublicUrl)
            mockStorageClient.generateSignedUrl.mockResolvedValue(mockSignedUrl)

            // Act: Process the job
            await processor.process(job)

            // Assert: Verify ordering of operations
            // Property: storage_path must be set BEFORE status='completed'
            
            // Get call order
            const updateStatusCalls = (updateJobStatus as jest.Mock).mock.calls
            const updateCompletedCalls = (updateJobToCompleted as jest.Mock).mock.calls
            const uploadCalls = mockStorageClient.upload.mock.calls

            // 1. updateJobStatus should be called to set storage_path
            expect(updateStatusCalls.length).toBeGreaterThan(0)
            const storagePathCall = updateStatusCalls.find(call => 
              call[2] && call[2].storage_path
            )
            expect(storagePathCall).toBeDefined()
            expect(storagePathCall[0]).toBe(input.job_id)
            expect(storagePathCall[1]).toBe('processing')
            expect(storagePathCall[2].storage_path).toMatch(
              new RegExp(`${input.user_id}/exports/${input.export_type}/${input.job_id}`)
            )

            // 2. Upload should happen after storage_path is set
            expect(uploadCalls.length).toBe(1)

            // 3. updateJobToCompleted should be called last
            expect(updateCompletedCalls.length).toBe(1)

            // Verify the order by checking invocation order
            const updateStatusInvocationOrder = (updateJobStatus as jest.Mock).mock.invocationCallOrder[0]
            const uploadInvocationOrder = mockStorageClient.upload.mock.invocationCallOrder[0]
            const updateCompletedInvocationOrder = (updateJobToCompleted as jest.Mock).mock.invocationCallOrder[0]

            // storage_path update must come before upload
            expect(updateStatusInvocationOrder).toBeLessThan(uploadInvocationOrder)
            
            // upload must come before completed status
            expect(uploadInvocationOrder).toBeLessThan(updateCompletedInvocationOrder)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not mark job as completed if upload fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
            error_message: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer, mockStorageClient } = createTestContext()
            // Arrange: Create a job
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: 0,
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
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

            // Mock successful rendering but failed upload
            const mockOutput = input.export_type === 'pdf'
              ? Buffer.from('%PDF-1.4 test content')
              : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockResolvedValue(mockOutput)
            } else {
              mockRenderer.renderImage.mockResolvedValue(mockOutput)
            }

            ;(validateOutput as jest.Mock).mockReturnValue({
              valid: true,
              errors: [],
              warnings: [],
              file_size: mockOutput.length,
              format_verified: true,
            })

            // Mock upload failure
            mockStorageClient.upload.mockRejectedValue(new Error(`upload failed: ${input.error_message}`))

            // Act: Process the job
            await processor.process(job)

            // Assert: Job should NOT be marked as completed
            // Property: Failed uploads should not leave jobs in completed state
            expect(updateJobToCompleted).not.toHaveBeenCalled()
            
            // storage_path should have been set
            const updateStatusCalls = (updateJobStatus as jest.Mock).mock.calls
            const storagePathCall = updateStatusCalls.find(call => 
              call[2] && call[2].storage_path
            )
            expect(storagePathCall).toBeDefined()
            
            // But job should be queued for retry (transient error) or failed
            const retryCall = (resetJobToPendingWithBackoff as jest.Mock).mock.calls[0]
            const failCall = (updateJobToFailed as jest.Mock).mock.calls[0]
            
            // Either retry or fail should be called, but not completed
            expect(retryCall || failCall).toBeTruthy()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 33: Transient Failure Suppression
  // Validates: Requirements 4.5, 5.5
  describe('Property 33: Transient Failure Suppression', () => {
    it('should NOT send notifications for transient failures during retry', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
            retry_count: fc.integer({ min: 0, max: 2 }), // Below max retries
            menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer } = createTestContext()
            
            // Clear notification service mocks
            jest.clearAllMocks()
            
            // Arrange: Create a job that will fail transiently
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: input.retry_count,
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                menu_name: input.menu_name,
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
                    name: input.menu_name,
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

            // Mock transient error (network timeout)
            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockRejectedValue(new Error('ETIMEDOUT'))
            } else {
              mockRenderer.renderImage.mockRejectedValue(new Error('ETIMEDOUT'))
            }

            // Act: Process the job (will fail transiently)
            await processor.process(job)

            // Assert: NO notifications should be sent for transient failures
            // Property: When retry_count < 3, no email or realtime notifications should be sent
            expect(notificationService.sendExportCompletionEmail).not.toHaveBeenCalled()
            expect(notificationService.sendExportFailureEmail).not.toHaveBeenCalled()
            
            // Job should be queued for retry
            expect(resetJobToPendingWithBackoff).toHaveBeenCalledTimes(1)
            expect(updateJobToFailed).not.toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should send failure notification only for terminal failures (retry_count >= 3)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
            menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer } = createTestContext()
            
            // Clear notification service mocks
            jest.clearAllMocks()
            
            // Arrange: Create a job that has exhausted retries
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: 3, // Max retries reached
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                menu_name: input.menu_name,
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
                    name: input.menu_name,
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

            // Mock error (any error will be terminal at retry_count=3)
            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockRejectedValue(new Error('ETIMEDOUT'))
            } else {
              mockRenderer.renderImage.mockRejectedValue(new Error('ETIMEDOUT'))
            }

            // Act: Process the job (will fail terminally)
            await processor.process(job)

            // Assert: Failure notification SHOULD be sent for terminal failures
            // Property: When retry_count >= 3, failure email should be sent
            expect(notificationService.sendExportFailureEmail).toHaveBeenCalledTimes(1)
            expect(notificationService.sendExportFailureEmail).toHaveBeenCalledWith(
              input.user_id,
              input.menu_name,
              input.export_type,
              expect.any(String) // error message
            )
            
            // Completion email should NOT be sent
            expect(notificationService.sendExportCompletionEmail).not.toHaveBeenCalled()
            
            // Job should be marked as failed
            expect(updateJobToFailed).toHaveBeenCalledTimes(1)
            expect(resetJobToPendingWithBackoff).not.toHaveBeenCalled()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should send completion notification only for successful completions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
            menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer, mockStorageClient } = createTestContext()
            
            // Clear notification service mocks
            jest.clearAllMocks()
            
            // Arrange: Create a job that will complete successfully
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: 0,
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                menu_name: input.menu_name,
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
                    name: input.menu_name,
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

            // Mock successful rendering
            const mockOutput = input.export_type === 'pdf'
              ? Buffer.from('%PDF-1.4 test content')
              : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

            const mockPublicUrl = `https://storage.supabase.co/bucket/${input.job_id}.${input.export_type === 'pdf' ? 'pdf' : 'png'}`
            const mockSignedUrl = `${mockPublicUrl}?token=abc123`

            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockResolvedValue(mockOutput)
            } else {
              mockRenderer.renderImage.mockResolvedValue(mockOutput)
            }

            ;(validateOutput as jest.Mock).mockReturnValue({
              valid: true,
              errors: [],
              warnings: [],
              file_size: mockOutput.length,
              format_verified: true,
            })

            mockStorageClient.upload.mockResolvedValue(mockPublicUrl)
            mockStorageClient.generateSignedUrl.mockResolvedValue(mockSignedUrl)

            // Act: Process the job (will complete successfully)
            await processor.process(job)

            // Assert: Completion notification SHOULD be sent
            // Property: When job completes successfully, completion email should be sent
            expect(notificationService.sendExportCompletionEmail).toHaveBeenCalledTimes(1)
            expect(notificationService.sendExportCompletionEmail).toHaveBeenCalledWith(
              input.user_id,
              mockSignedUrl,
              input.menu_name,
              input.export_type
            )
            
            // Failure email should NOT be sent
            expect(notificationService.sendExportFailureEmail).not.toHaveBeenCalled()
            
            // Job should be marked as completed
            expect(updateJobToCompleted).toHaveBeenCalledTimes(1)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 34: Email Subject Formatting
  // Validates: Requirements 5.3
  describe('Property 34: Email Subject Formatting', () => {
    it('should include menu name and export type in completion email subject', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
            menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer, mockStorageClient } = createTestContext()
            
            // Clear notification service mocks
            jest.clearAllMocks()
            
            // Arrange: Create a job that will complete successfully
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: 0,
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                menu_name: input.menu_name,
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
                    name: input.menu_name,
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

            // Mock successful rendering
            const mockOutput = input.export_type === 'pdf'
              ? Buffer.from('%PDF-1.4 test content')
              : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

            const mockPublicUrl = `https://storage.supabase.co/bucket/${input.job_id}.${input.export_type === 'pdf' ? 'pdf' : 'png'}`
            const mockSignedUrl = `${mockPublicUrl}?token=abc123`

            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockResolvedValue(mockOutput)
            } else {
              mockRenderer.renderImage.mockResolvedValue(mockOutput)
            }

            ;(validateOutput as jest.Mock).mockReturnValue({
              valid: true,
              errors: [],
              warnings: [],
              file_size: mockOutput.length,
              format_verified: true,
            })

            mockStorageClient.upload.mockResolvedValue(mockPublicUrl)
            mockStorageClient.generateSignedUrl.mockResolvedValue(mockSignedUrl)

            // Act: Process the job
            await processor.process(job)

            // Assert: Completion email should include menu name and export type
            // Property: Email subject should contain both menu name and export type
            expect(notificationService.sendExportCompletionEmail).toHaveBeenCalledWith(
              input.user_id,
              mockSignedUrl,
              input.menu_name, // Menu name must be passed
              input.export_type // Export type must be passed
            )
            
            // The notification service itself formats the subject as:
            // "Your {PDF|Image} export is ready: {menuName}"
            // We verify the correct parameters are passed
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should include menu name and export type in failure email subject', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            job_id: fc.uuid(),
            user_id: fc.uuid(),
            menu_id: fc.uuid(),
            export_type: fc.constantFrom('pdf' as const, 'image' as const),
            menu_name: fc.string({ minLength: 5, maxLength: 50 }),
          }),
          async (input) => {
            // Create fresh test context for this iteration
            const { processor, mockRenderer } = createTestContext()
            
            // Clear notification service mocks
            jest.clearAllMocks()
            
            // Arrange: Create a job that will fail terminally
            const job: ExportJob = {
              id: input.job_id,
              user_id: input.user_id,
              menu_id: input.menu_id,
              export_type: input.export_type,
              status: 'processing',
              priority: 100,
              retry_count: 3, // Max retries reached
              error_message: null,
              file_url: null,
              storage_path: null,
              available_at: new Date().toISOString(),
              metadata: {
                menu_name: input.menu_name,
                render_snapshot: {
                  template_id: 'test-template',
                  template_version: '1.0',
                  template_name: 'Test Template',
                  menu_data: {
                    id: input.menu_id,
                    name: input.menu_name,
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

            // Mock error
            ;(getRenderSnapshot as jest.Mock).mockReturnValue(job.metadata.render_snapshot)
            
            if (input.export_type === 'pdf') {
              mockRenderer.renderPDF.mockRejectedValue(new Error('Rendering failed'))
            } else {
              mockRenderer.renderImage.mockRejectedValue(new Error('Rendering failed'))
            }

            // Act: Process the job
            await processor.process(job)

            // Assert: Failure email should include menu name and export type
            // Property: Email subject should contain both menu name and export type
            expect(notificationService.sendExportFailureEmail).toHaveBeenCalledWith(
              input.user_id,
              input.menu_name, // Menu name must be passed
              input.export_type, // Export type must be passed
              expect.any(String) // error message
            )
            
            // The notification service itself formats the subject as:
            // "Export failed: {menuName} ({PDF|Image})"
            // We verify the correct parameters are passed
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
