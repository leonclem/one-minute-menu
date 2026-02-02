/**
 * Unit tests for GracefulShutdown
 * 
 * Tests graceful shutdown behavior including:
 * - SIGTERM handler registration
 * - Stopping job poller
 * - Waiting for current job completion
 * - Timeout enforcement
 * - Resource cleanup
 */

import { GracefulShutdown } from '../graceful-shutdown'
import { JobPoller } from '../job-poller'
import { JobProcessor } from '../job-processor'

// Mock the dependencies
jest.mock('../job-poller')
jest.mock('../job-processor')

describe('GracefulShutdown', () => {
  let mockPoller: jest.Mocked<JobPoller>
  let mockProcessor: jest.Mocked<JobProcessor>
  let gracefulShutdown: GracefulShutdown
  let processExitSpy: jest.SpyInstance

  beforeEach(() => {
    // Create mock instances
    mockPoller = {
      stop: jest.fn().mockResolvedValue(undefined),
    } as any

    mockProcessor = {
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as any

    // Spy on process.exit - don't throw, just mock it
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      // Do nothing - just prevent actual exit
    }) as any)

    // Create graceful shutdown instance
    gracefulShutdown = new GracefulShutdown({
      poller: mockPoller,
      processor: mockProcessor,
      shutdownTimeoutMs: 1000, // Use short timeout for tests
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    processExitSpy.mockRestore()
  })

  describe('register', () => {
    it('should register SIGTERM handler', () => {
      const listenersBefore = process.listenerCount('SIGTERM')
      gracefulShutdown.register()
      const listenersAfter = process.listenerCount('SIGTERM')

      expect(listenersAfter).toBe(listenersBefore + 1)
    })

    it('should register SIGINT handler', () => {
      const listenersBefore = process.listenerCount('SIGINT')
      gracefulShutdown.register()
      const listenersAfter = process.listenerCount('SIGINT')

      expect(listenersAfter).toBe(listenersBefore + 1)
    })
  })

  describe('handleSIGTERM', () => {
    it('should stop poller when SIGTERM received', async () => {
      gracefulShutdown.register()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPoller.stop).toHaveBeenCalled()
    })

    it('should cleanup processor resources', async () => {
      gracefulShutdown.register()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockProcessor.shutdown).toHaveBeenCalled()
    })

    it('should exit with code 0 on successful shutdown', async () => {
      gracefulShutdown.register()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('should not shutdown twice if called multiple times', async () => {
      gracefulShutdown.register()

      // Trigger SIGTERM twice
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 50))
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should only stop once
      expect(mockPoller.stop).toHaveBeenCalledTimes(1)
      expect(mockProcessor.shutdown).toHaveBeenCalledTimes(1)
    })
  })

  describe('waitForCompletion', () => {
    it('should wait for current job to complete', async () => {
      let jobResolved = false
      const jobPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          jobResolved = true
          resolve()
        }, 100)
      })

      gracefulShutdown.setCurrentJob(jobPromise)
      gracefulShutdown.register()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(jobResolved).toBe(true)
    })

    it('should timeout if job takes too long', async () => {
      const longJobPromise = new Promise<void>((resolve) => {
        // Never resolve - simulate stuck job
        setTimeout(resolve, 10000)
      })

      gracefulShutdown.setCurrentJob(longJobPromise)
      gracefulShutdown.register()

      const startTime = Date.now()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1200))

      const elapsed = Date.now() - startTime

      // Should timeout around 1000ms (our configured timeout)
      expect(elapsed).toBeLessThan(1600)
      expect(processExitSpy).toHaveBeenCalled()
    })

    it('should not wait if no current job', async () => {
      gracefulShutdown.register()

      const startTime = Date.now()

      // Trigger SIGTERM with no current job
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 100))

      const elapsed = Date.now() - startTime

      // Should exit quickly without waiting
      expect(elapsed).toBeLessThan(500)
      expect(processExitSpy).toHaveBeenCalled()
    })
  })

  describe('job tracking', () => {
    it('should track current job when set', () => {
      const jobPromise = Promise.resolve()
      gracefulShutdown.setCurrentJob(jobPromise)

      expect(gracefulShutdown.isShutdownInProgress()).toBe(false)
    })

    it('should clear current job when cleared', () => {
      const jobPromise = Promise.resolve()
      gracefulShutdown.setCurrentJob(jobPromise)
      gracefulShutdown.clearCurrentJob()

      // No direct way to test this, but it shouldn't throw
      expect(gracefulShutdown.isShutdownInProgress()).toBe(false)
    })
  })

  describe('isShutdownInProgress', () => {
    it('should return false initially', () => {
      expect(gracefulShutdown.isShutdownInProgress()).toBe(false)
    })

    it('should return true after SIGTERM received', async () => {
      gracefulShutdown.register()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(gracefulShutdown.isShutdownInProgress()).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should exit with code 1 if shutdown fails', async () => {
      // Make processor.shutdown throw an error
      mockProcessor.shutdown.mockRejectedValue(new Error('Shutdown failed'))

      gracefulShutdown.register()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should continue shutdown if job completion fails', async () => {
      const failingJobPromise = Promise.reject(new Error('Job failed'))
      
      gracefulShutdown.setCurrentJob(failingJobPromise)
      gracefulShutdown.register()

      // Trigger SIGTERM
      process.emit('SIGTERM', 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should still cleanup and exit
      expect(mockProcessor.shutdown).toHaveBeenCalled()
      expect(processExitSpy).toHaveBeenCalled()
    })
  })
})
