/**
 * Unit tests for JobPoller
 * 
 * Tests:
 * - Start/stop polling loop
 * - Job claiming and processing
 * - Adaptive polling intervals
 * - Error handling
 */

import { JobPoller } from '../job-poller'
import { JobProcessor } from '../job-processor'
import * as databaseClient from '../database-client'
import type { ExportJob } from '../database-client'

// Mock dependencies
jest.mock('../database-client')
jest.mock('../job-processor')

describe('JobPoller', () => {
  let poller: JobPoller
  let mockProcessor: jest.Mocked<JobProcessor>
  const workerId = 'test-worker-1'

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Create mock processor
    mockProcessor = {
      process: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as any

    // Create poller with short intervals for testing
    poller = new JobPoller({
      processor: mockProcessor,
      workerId,
      pollingIntervalBusyMs: 100,
      pollingIntervalIdleMs: 200,
    })
  })

  afterEach(async () => {
    await poller.stop()
    jest.useRealTimers()
  })

  describe('start()', () => {
    it('should start polling loop', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0)

      await poller.start()

      // Should have called claimJob once immediately
      expect(mockClaimJob).toHaveBeenCalledWith(workerId)
      expect(mockClaimJob).toHaveBeenCalledTimes(1)
    })

    it('should not start if already running', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0)

      await poller.start()
      const firstCallCount = mockClaimJob.mock.calls.length

      await poller.start()
      const secondCallCount = mockClaimJob.mock.calls.length

      // Should not have made additional calls
      expect(secondCallCount).toBe(firstCallCount)
    })
  })

  describe('stop()', () => {
    it('should stop polling loop', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0)

      await poller.start()
      await poller.stop()

      // Advance timers to trigger next poll
      jest.advanceTimersByTime(300)

      // Should not have made additional calls after stop
      expect(mockClaimJob).toHaveBeenCalledTimes(1)
    })

    it('should not error if not running', async () => {
      await expect(poller.stop()).resolves.not.toThrow()
    })
  })

  describe('job claiming and processing', () => {
    it('should claim and process a job', async () => {
      const mockJob: ExportJob = {
        id: 'job-1',
        user_id: 'user-1',
        menu_id: 'menu-1',
        export_type: 'pdf',
        status: 'processing',
        priority: 100,
        retry_count: 0,
        metadata: {},
        worker_id: workerId,
        created_at: new Date(),
        updated_at: new Date(),
        started_at: new Date(),
        available_at: new Date(),
      }

      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValueOnce(mockJob).mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0)

      await poller.start()

      // Wait for processing
      await jest.runOnlyPendingTimersAsync()

      // Should have claimed the job
      expect(mockClaimJob).toHaveBeenCalledWith(workerId)

      // Should have processed the job
      expect(mockProcessor.process).toHaveBeenCalledWith(mockJob)
    })

    it('should continue polling if no job available', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0)

      await poller.start()

      // Advance timers to trigger multiple polls
      await jest.runOnlyPendingTimersAsync()
      await jest.runOnlyPendingTimersAsync()

      // Should have called claimJob multiple times
      expect(mockClaimJob.mock.calls.length).toBeGreaterThan(1)
    })

    it('should handle job processing errors gracefully', async () => {
      const mockJob: ExportJob = {
        id: 'job-1',
        user_id: 'user-1',
        menu_id: 'menu-1',
        export_type: 'pdf',
        status: 'processing',
        priority: 100,
        retry_count: 0,
        metadata: {},
        worker_id: workerId,
        created_at: new Date(),
        updated_at: new Date(),
        started_at: new Date(),
        available_at: new Date(),
      }

      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValueOnce(mockJob).mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0)

      // Make processor throw error
      mockProcessor.process.mockRejectedValueOnce(
        new Error('Processing failed')
      )

      await poller.start()

      // Wait for processing
      await jest.runOnlyPendingTimersAsync()

      // Should have attempted to process
      expect(mockProcessor.process).toHaveBeenCalledWith(mockJob)

      // Should continue polling after error
      await jest.runOnlyPendingTimersAsync()
      expect(mockClaimJob.mock.calls.length).toBeGreaterThan(1)
    })

    it('should handle claim errors gracefully', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0)

      await poller.start()

      // Wait for processing
      await jest.runOnlyPendingTimersAsync()

      // Should not have processed anything
      expect(mockProcessor.process).not.toHaveBeenCalled()

      // Should continue polling after error
      await jest.runOnlyPendingTimersAsync()
      expect(mockClaimJob.mock.calls.length).toBeGreaterThan(1)
    })
  })

  describe('adaptive polling intervals', () => {
    it('should use busy interval when jobs are pending', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(5) // Jobs pending

      await poller.start()

      // Wait for first poll
      await jest.runOnlyPendingTimersAsync()

      // Advance by busy interval
      jest.advanceTimersByTime(100)
      await jest.runOnlyPendingTimersAsync()

      // Should have polled again (busy interval)
      expect(mockClaimJob.mock.calls.length).toBeGreaterThan(1)
    })

    it('should use idle interval when queue is empty', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(0) // Queue empty

      await poller.start()

      // Wait for first poll to complete
      await jest.runOnlyPendingTimersAsync()
      const firstCallCount = mockClaimJob.mock.calls.length

      // Advance by busy interval (should not trigger because idle interval is 200ms)
      jest.advanceTimersByTime(100)
      await Promise.resolve() // Let any microtasks run
      expect(mockClaimJob).toHaveBeenCalledTimes(firstCallCount)

      // Advance by remaining idle interval (should trigger)
      jest.advanceTimersByTime(100)
      await jest.runOnlyPendingTimersAsync()

      expect(mockClaimJob.mock.calls.length).toBeGreaterThan(firstCallCount)
    })

    it('should default to idle interval on queue depth error', async () => {
      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob.mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockRejectedValue(new Error('Database error'))

      await poller.start()

      // Wait for first poll to complete
      await jest.runOnlyPendingTimersAsync()
      const firstCallCount = mockClaimJob.mock.calls.length

      // Advance by busy interval (should not trigger because idle interval is 200ms)
      jest.advanceTimersByTime(100)
      await Promise.resolve() // Let any microtasks run
      expect(mockClaimJob).toHaveBeenCalledTimes(firstCallCount)

      // Advance by remaining idle interval (should trigger)
      jest.advanceTimersByTime(100)
      await jest.runOnlyPendingTimersAsync()

      expect(mockClaimJob.mock.calls.length).toBeGreaterThan(firstCallCount)
    })
  })

  describe('polling loop behavior', () => {
    it('should process multiple jobs sequentially', async () => {
      const mockJob1: ExportJob = {
        id: 'job-1',
        user_id: 'user-1',
        menu_id: 'menu-1',
        export_type: 'pdf',
        status: 'processing',
        priority: 100,
        retry_count: 0,
        metadata: {},
        worker_id: workerId,
        created_at: new Date(),
        updated_at: new Date(),
        started_at: new Date(),
        available_at: new Date(),
      }

      const mockJob2: ExportJob = {
        ...mockJob1,
        id: 'job-2',
      }

      const mockClaimJob = jest.spyOn(databaseClient, 'claimJob')
      mockClaimJob
        .mockResolvedValueOnce(mockJob1)
        .mockResolvedValueOnce(mockJob2)
        .mockResolvedValue(null)

      const mockGetQueueDepth = jest.spyOn(databaseClient, 'getQueueDepth')
      mockGetQueueDepth.mockResolvedValue(2)

      await poller.start()

      // Process first job
      await jest.runOnlyPendingTimersAsync()
      expect(mockProcessor.process).toHaveBeenCalledWith(mockJob1)

      // Process second job
      await jest.runOnlyPendingTimersAsync()
      expect(mockProcessor.process).toHaveBeenCalledWith(mockJob2)

      // Should have processed both jobs
      expect(mockProcessor.process).toHaveBeenCalledTimes(2)
    })
  })
})
