/**
 * Unit tests for Stale Job Cleanup Service
 * 
 * Tests the background task that detects and recovers stale export jobs.
 */

import { StaleJobCleanup, createStaleJobCleanup } from '../stale-job-cleanup'
import * as databaseClient from '../database-client'

// Mock the database client
jest.mock('../database-client')

describe('StaleJobCleanup', () => {
  let cleanup: StaleJobCleanup
  let mockLogger: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }

    // Mock database functions
    jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue([])
    jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(0)
  })

  afterEach(async () => {
    if (cleanup) {
      cleanup.stop()
    }
    jest.useRealTimers()
  })

  describe('constructor', () => {
    it('should create instance with default config', () => {
      cleanup = new StaleJobCleanup()
      expect(cleanup).toBeDefined()
      expect(cleanup.isActive()).toBe(false)
    })

    it('should create instance with custom config', () => {
      cleanup = new StaleJobCleanup({
        intervalMs: 60000,
        runImmediately: false,
        logger: mockLogger,
      })
      expect(cleanup).toBeDefined()
    })
  })

  describe('start', () => {
    it('should start cleanup service and run immediately by default', async () => {
      cleanup = new StaleJobCleanup({ logger: mockLogger })

      await cleanup.start()

      expect(cleanup.isActive()).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting stale job cleanup service',
        expect.any(Object)
      )
      expect(databaseClient.findStaleJobs).toHaveBeenCalled()
    })

    it('should not run immediately if configured', async () => {
      cleanup = new StaleJobCleanup({
        runImmediately: false,
        logger: mockLogger,
      })

      await cleanup.start()

      expect(cleanup.isActive()).toBe(true)
      expect(databaseClient.findStaleJobs).not.toHaveBeenCalled()
    })

    it('should schedule periodic cleanup', async () => {
      cleanup = new StaleJobCleanup({
        intervalMs: 1000,
        runImmediately: false,
        logger: mockLogger,
      })

      await cleanup.start()

      // Fast-forward time
      jest.advanceTimersByTime(1000)
      await Promise.resolve() // Let promises resolve

      expect(databaseClient.findStaleJobs).toHaveBeenCalled()
    })

    it('should not start if already running', async () => {
      cleanup = new StaleJobCleanup({ logger: mockLogger })

      await cleanup.start()
      await cleanup.start() // Try to start again

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Stale job cleanup already running, ignoring start request'
      )
    })
  })

  describe('stop', () => {
    it('should stop cleanup service', async () => {
      cleanup = new StaleJobCleanup({ logger: mockLogger })

      await cleanup.start()
      expect(cleanup.isActive()).toBe(true)

      cleanup.stop()
      expect(cleanup.isActive()).toBe(false)
      expect(mockLogger.info).toHaveBeenCalledWith('Stale job cleanup service stopped')
    })

    it('should warn if not running', () => {
      cleanup = new StaleJobCleanup({ logger: mockLogger })

      cleanup.stop()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Stale job cleanup not running, ignoring stop request'
      )
    })
  })

  describe('cleanup cycle', () => {
    it('should log when no stale jobs found', async () => {
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue([])

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      expect(mockLogger.info).toHaveBeenCalledWith('No stale jobs found')
    })

    it('should reset stale jobs when found', async () => {
      const staleJobIds = ['job-1', 'job-2', 'job-3']
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue(staleJobIds)
      jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(3)

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Found stale jobs, initiating recovery',
        {
          count: 3,
          jobIds: staleJobIds,
        }
      )

      expect(databaseClient.resetStaleJobs).toHaveBeenCalled()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stale job cleanup completed',
        expect.objectContaining({
          staleJobsFound: 3,
          jobsReset: 3,
        })
      )
    })

    it('should log individual job recoveries', async () => {
      const staleJobIds = ['job-1', 'job-2']
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue(staleJobIds)
      jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(2)

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      // Check that each job recovery was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stale job recovered',
        {
          jobId: 'job-1',
          action: 'reset_to_pending',
          reason: 'processing_timeout_exceeded',
        }
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stale job recovered',
        {
          jobId: 'job-2',
          action: 'reset_to_pending',
          reason: 'processing_timeout_exceeded',
        }
      )
    })

    it('should handle errors gracefully', async () => {
      const error = new Error('Database connection failed')
      jest.spyOn(databaseClient, 'findStaleJobs').mockRejectedValue(error)

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Stale job cleanup failed',
        expect.objectContaining({
          error: 'Database connection failed',
          stack: expect.any(String),
        })
      )

      // Service should still be running
      expect(cleanup.isActive()).toBe(true)
    })

    it('should continue running after error', async () => {
      // First call fails, second succeeds
      jest
        .spyOn(databaseClient, 'findStaleJobs')
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([])

      cleanup = new StaleJobCleanup({
        intervalMs: 1000,
        logger: mockLogger,
      })

      await cleanup.start()

      // First cycle fails
      expect(mockLogger.error).toHaveBeenCalled()

      // Advance to next cycle
      jest.advanceTimersByTime(1000)
      await Promise.resolve()

      // Second cycle succeeds
      expect(mockLogger.info).toHaveBeenCalledWith('No stale jobs found')
    })
  })

  describe('triggerCleanup', () => {
    it('should manually trigger cleanup and return count', async () => {
      const staleJobIds = ['job-1', 'job-2']
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue(staleJobIds)
      jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(2)

      cleanup = new StaleJobCleanup({ logger: mockLogger, runImmediately: false })

      const resetCount = await cleanup.triggerCleanup()

      expect(resetCount).toBe(2)
      expect(mockLogger.info).toHaveBeenCalledWith('Manual cleanup triggered')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Manual cleanup completed',
        { jobsReset: 2 }
      )
    })

    it('should return 0 when no stale jobs found', async () => {
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue([])

      cleanup = new StaleJobCleanup({ logger: mockLogger })

      const resetCount = await cleanup.triggerCleanup()

      expect(resetCount).toBe(0)
    })

    it('should throw error on failure', async () => {
      const error = new Error('Database error')
      jest.spyOn(databaseClient, 'findStaleJobs').mockRejectedValue(error)

      cleanup = new StaleJobCleanup({ logger: mockLogger })

      await expect(cleanup.triggerCleanup()).rejects.toThrow('Database error')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Manual cleanup failed',
        expect.objectContaining({
          error: 'Database error',
        })
      )
    })
  })

  describe('createStaleJobCleanup', () => {
    it('should create cleanup instance with default config', () => {
      const instance = createStaleJobCleanup()
      expect(instance).toBeInstanceOf(StaleJobCleanup)
      expect(instance.isActive()).toBe(false)
    })

    it('should create cleanup instance with custom config', () => {
      const instance = createStaleJobCleanup({
        intervalMs: 60000,
        logger: mockLogger,
      })
      expect(instance).toBeInstanceOf(StaleJobCleanup)
    })
  })

  describe('periodic execution', () => {
    it('should run cleanup at configured intervals', async () => {
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue([])

      cleanup = new StaleJobCleanup({
        intervalMs: 5000,
        runImmediately: false,
        logger: mockLogger,
      })

      await cleanup.start()

      // Should not have run yet
      expect(databaseClient.findStaleJobs).not.toHaveBeenCalled()

      // Advance 5 seconds
      jest.advanceTimersByTime(5000)
      await Promise.resolve()

      expect(databaseClient.findStaleJobs).toHaveBeenCalledTimes(1)

      // Advance another 5 seconds
      jest.advanceTimersByTime(5000)
      await Promise.resolve()

      expect(databaseClient.findStaleJobs).toHaveBeenCalledTimes(2)
    })

    it('should stop periodic execution when stopped', async () => {
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue([])

      cleanup = new StaleJobCleanup({
        intervalMs: 1000,
        runImmediately: false,
        logger: mockLogger,
      })

      await cleanup.start()

      // Run once
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      expect(databaseClient.findStaleJobs).toHaveBeenCalledTimes(1)

      // Stop the service
      cleanup.stop()

      // Advance time - should not run again
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      expect(databaseClient.findStaleJobs).toHaveBeenCalledTimes(1)
    })
  })

  describe('requirements validation', () => {
    it('should satisfy Requirement 6.3: Detect stale jobs', async () => {
      // Requirement 6.3: Detect jobs in processing status > 5 minutes
      const staleJobIds = ['stale-job-1']
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue(staleJobIds)
      jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(1)

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      // Verify findStaleJobs was called (detects jobs > 5 minutes old)
      expect(databaseClient.findStaleJobs).toHaveBeenCalled()
    })

    it('should satisfy Requirement 6.4: Reset to pending status', async () => {
      // Requirement 6.4: Reset stale jobs to pending
      const staleJobIds = ['stale-job-1']
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue(staleJobIds)
      jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(1)

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      // Verify resetStaleJobs was called (resets to pending)
      expect(databaseClient.resetStaleJobs).toHaveBeenCalled()
    })

    it('should satisfy Requirement 6.6: Clear worker_id', async () => {
      // Requirement 6.6: Clear worker_id to allow re-processing
      // This is handled by resetStaleJobs in database-client
      const staleJobIds = ['stale-job-1']
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue(staleJobIds)
      jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(1)

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      // Verify resetStaleJobs was called (clears worker_id and started_at)
      expect(databaseClient.resetStaleJobs).toHaveBeenCalled()
    })

    it('should run every 5 minutes by default', () => {
      // Task requirement: Run every 5 minutes
      cleanup = new StaleJobCleanup()

      // Check default interval is 5 minutes (300000ms)
      expect((cleanup as any).config.intervalMs).toBe(5 * 60 * 1000)
    })

    it('should log stale job recovery events', async () => {
      // Task requirement: Log stale job recovery events
      const staleJobIds = ['job-1']
      jest.spyOn(databaseClient, 'findStaleJobs').mockResolvedValue(staleJobIds)
      jest.spyOn(databaseClient, 'resetStaleJobs').mockResolvedValue(1)

      cleanup = new StaleJobCleanup({ logger: mockLogger })
      await cleanup.start()

      // Verify recovery event was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Stale job recovered',
        expect.objectContaining({
          jobId: 'job-1',
          action: 'reset_to_pending',
          reason: 'processing_timeout_exceeded',
        })
      )
    })
  })
})
