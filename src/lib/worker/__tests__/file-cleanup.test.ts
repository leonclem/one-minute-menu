/**
 * Unit Tests: File Cleanup Service
 * 
 * Tests the FileCleanup service class functionality including:
 * - Service lifecycle (start/stop)
 * - Manual cleanup triggering
 * - Configuration handling
 */

import { FileCleanup } from '../file-cleanup'
import { StorageClient } from '../storage-client'
import * as databaseClient from '../database-client'

// Mock the database client
jest.mock('../database-client')

describe('FileCleanup Service', () => {
  let mockStorageClient: jest.Mocked<StorageClient>
  let mockLogger: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock storage client
    mockStorageClient = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as any

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }
  })

  describe('Service lifecycle', () => {
    it('should start and stop the service', async () => {
      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
        runImmediately: false,
      })

      await cleanup.start()
      expect(cleanup.isActive()).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting file cleanup service',
        expect.any(Object)
      )

      cleanup.stop()
      expect(cleanup.isActive()).toBe(false)
      expect(mockLogger.info).toHaveBeenCalledWith('File cleanup service stopped')
    })

    it('should not start if already running', async () => {
      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
        runImmediately: false,
      })

      await cleanup.start()
      await cleanup.start() // Try to start again

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'File cleanup already running, ignoring start request'
      )
    })

    it('should not stop if not running', () => {
      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
      })

      cleanup.stop()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'File cleanup not running, ignoring stop request'
      )
    })
  })

  describe('Configuration', () => {
    it('should use default configuration values', async () => {
      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        runImmediately: false,
      })

      await cleanup.start()

      // Default interval is 24 hours
      // Default retention is 30 days
      expect(cleanup.isActive()).toBe(true)

      cleanup.stop()
    })

    it('should use custom configuration values', async () => {
      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        intervalMs: 60000, // 1 minute
        retentionDays: 7, // 7 days
        runImmediately: false,
        logger: mockLogger,
      })

      await cleanup.start()
      expect(cleanup.isActive()).toBe(true)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting file cleanup service',
        expect.objectContaining({
          intervalMs: 60000,
          retentionDays: 7,
        })
      )

      cleanup.stop()
    })
  })

  describe('Manual cleanup', () => {
    it('should trigger cleanup manually and return statistics', async () => {
      // Mock database functions
      const mockOldJobs = [
        { id: 'job-1', storage_path: 'user1/exports/pdf/job-1.pdf' },
        { id: 'job-2', storage_path: 'user1/exports/pdf/job-2.pdf' },
        { id: 'job-3', storage_path: null },
      ]

      jest
        .spyOn(databaseClient, 'findOldCompletedJobs')
        .mockResolvedValue(mockOldJobs)
      jest.spyOn(databaseClient, 'deleteOldCompletedJobs').mockResolvedValue(3)

      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
      })

      const result = await cleanup.triggerCleanup()

      expect(result).toEqual({
        oldJobsFound: 3,
        filesDeleted: 2, // Only 2 had storage_path
        jobsDeleted: 3,
      })

      expect(mockStorageClient.deleteFile).toHaveBeenCalledTimes(2)
      expect(mockStorageClient.deleteFile).toHaveBeenCalledWith(
        'user1/exports/pdf/job-1.pdf'
      )
      expect(mockStorageClient.deleteFile).toHaveBeenCalledWith(
        'user1/exports/pdf/job-2.pdf'
      )
    })

    it('should handle empty result when no old jobs exist', async () => {
      jest.spyOn(databaseClient, 'findOldCompletedJobs').mockResolvedValue([])

      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
      })

      const result = await cleanup.triggerCleanup()

      expect(result).toEqual({
        oldJobsFound: 0,
        filesDeleted: 0,
        jobsDeleted: 0,
      })

      expect(mockStorageClient.deleteFile).not.toHaveBeenCalled()
    })

    it('should continue cleanup even if some file deletions fail', async () => {
      const mockOldJobs = [
        { id: 'job-1', storage_path: 'user1/exports/pdf/job-1.pdf' },
        { id: 'job-2', storage_path: 'user1/exports/pdf/job-2.pdf' },
        { id: 'job-3', storage_path: 'user1/exports/pdf/job-3.pdf' },
      ]

      jest
        .spyOn(databaseClient, 'findOldCompletedJobs')
        .mockResolvedValue(mockOldJobs)
      jest.spyOn(databaseClient, 'deleteOldCompletedJobs').mockResolvedValue(3)

      // Make the second file deletion fail
      mockStorageClient.deleteFile
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Storage error'))
        .mockResolvedValueOnce(undefined)

      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
      })

      const result = await cleanup.triggerCleanup()

      expect(result).toEqual({
        oldJobsFound: 3,
        filesDeleted: 2, // 2 succeeded, 1 failed
        jobsDeleted: 3, // Database deletion still happens
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to delete file',
        expect.objectContaining({
          jobId: 'job-2',
          storagePath: 'user1/exports/pdf/job-2.pdf',
        })
      )
    })

    it('should throw error if manual cleanup fails', async () => {
      jest
        .spyOn(databaseClient, 'findOldCompletedJobs')
        .mockRejectedValue(new Error('Database error'))

      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
      })

      await expect(cleanup.triggerCleanup()).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Manual cleanup failed',
        expect.any(Object)
      )
    })
  })

  describe('Automatic cleanup', () => {
    it('should run cleanup immediately if configured', async () => {
      const mockOldJobs = [
        { id: 'job-1', storage_path: 'user1/exports/pdf/job-1.pdf' },
      ]

      jest
        .spyOn(databaseClient, 'findOldCompletedJobs')
        .mockResolvedValue(mockOldJobs)
      jest.spyOn(databaseClient, 'deleteOldCompletedJobs').mockResolvedValue(1)

      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
        runImmediately: true,
      })

      await cleanup.start()

      // Wait a bit for the cleanup to run
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting file cleanup cycle',
        expect.any(Object)
      )

      cleanup.stop()
    })

    it('should not crash service if cleanup fails', async () => {
      jest
        .spyOn(databaseClient, 'findOldCompletedJobs')
        .mockRejectedValue(new Error('Database error'))

      const cleanup = new FileCleanup({
        storageClient: mockStorageClient,
        logger: mockLogger,
        runImmediately: true,
      })

      await cleanup.start()

      // Wait a bit for the cleanup to run
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockLogger.error).toHaveBeenCalledWith(
        'File cleanup failed',
        expect.any(Object)
      )

      // Service should still be running
      expect(cleanup.isActive()).toBe(true)

      cleanup.stop()
    })
  })
})
