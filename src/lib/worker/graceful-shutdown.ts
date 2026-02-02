/**
 * GracefulShutdown - Handles SIGTERM signals for clean worker shutdown
 * 
 * Responsibilities:
 * - Register SIGTERM handler
 * - Stop polling for new jobs
 * - Wait for current job to complete (max 30 seconds)
 * - Cleanup resources (database connections, Puppeteer)
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */

import { JobPoller } from './job-poller'
import { JobProcessor } from './job-processor'
import { logWorkerEvent, logInfo, logWarning, logError } from './logger'

export interface GracefulShutdownConfig {
  poller: JobPoller
  processor: JobProcessor
  shutdownTimeoutMs?: number
}

export class GracefulShutdown {
  private poller: JobPoller
  private processor: JobProcessor
  private shutdownTimeoutMs: number
  private isShuttingDown: boolean = false
  private currentJobPromise: Promise<void> | null = null

  constructor(config: GracefulShutdownConfig) {
    this.poller = config.poller
    this.processor = config.processor
    this.shutdownTimeoutMs = config.shutdownTimeoutMs ?? 30000 // 30 seconds default
  }

  /**
   * Register SIGTERM handler for graceful shutdown
   * 
   * Sets up signal handlers to gracefully shut down the worker when
   * Railway sends SIGTERM during deployments or scaling events.
   * 
   * Requirements: 8.1
   */
  register(): void {
    logInfo('Registering SIGTERM handler', {
      shutdown_timeout_ms: this.shutdownTimeoutMs,
    })

    process.on('SIGTERM', () => {
      this.handleSIGTERM()
    })

    // Also handle SIGINT for local development (Ctrl+C)
    process.on('SIGINT', () => {
      logInfo('Received SIGINT')
      this.handleSIGTERM()
    })
  }

  /**
   * Handle SIGTERM signal
   * 
   * Orchestrates the graceful shutdown process:
   * 1. Stop polling for new jobs immediately
   * 2. Wait for current job to complete (with timeout)
   * 3. Cleanup resources
   * 4. Exit process
   * 
   * Requirements: 8.1, 8.2, 8.3
   */
  private async handleSIGTERM(): Promise<void> {
    if (this.isShuttingDown) {
      logWarning('Already shutting down, ignoring signal')
      return
    }

    this.isShuttingDown = true
    logWorkerEvent.shutdown('SIGTERM received')

    try {
      // Step 1: Stop polling for new jobs immediately
      // Requirement 8.1: Stop polling for new jobs immediately
      logInfo('Stopping job poller')
      await this.poller.stop()
      logInfo('Job poller stopped')

      // Step 2: Wait for current job to complete (with timeout)
      // Requirement 8.2: Wait up to 30 seconds for current job to complete
      logInfo('Waiting for current job to complete')
      await this.waitForCompletion(this.shutdownTimeoutMs)
      logInfo('Current job completed or timeout reached')

      // Step 3: Cleanup resources
      // Requirement 8.5: Release all database connections and Puppeteer resources
      logInfo('Cleaning up resources')
      await this.processor.shutdown()
      logInfo('Resources cleaned up')

      // Step 4: Exit cleanly
      logWorkerEvent.shutdownComplete()
      process.exit(0)
    } catch (error) {
      logError('Error during shutdown', error as Error)
      // Force exit on error
      // Requirement 8.3: Terminate forcefully if shutdown fails
      process.exit(1)
    }
  }

  /**
   * Wait for current job to complete with timeout
   * 
   * Waits for the current job processing to finish, but enforces a maximum
   * timeout. If the timeout is exceeded, the worker will exit anyway and
   * the stale job detection mechanism will recover the job.
   * 
   * @param timeoutMs - Maximum time to wait in milliseconds
   * 
   * Requirements: 8.2, 8.3, 8.4
   */
  private async waitForCompletion(timeoutMs: number): Promise<void> {
    if (!this.currentJobPromise) {
      logInfo('No current job to wait for')
      return
    }

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        // Requirement 8.3: Terminate forcefully if timeout exceeded
        logWorkerEvent.shutdownTimeout('unknown')
        logWarning('Shutdown timeout exceeded, forcing exit', {
          timeout_ms: timeoutMs,
        })
        resolve()
      }, timeoutMs)
    })

    try {
      // Race between job completion and timeout
      await Promise.race([this.currentJobPromise, timeoutPromise])
    } catch (error) {
      logError('Error waiting for job completion', error as Error)
      // Continue with shutdown even if job failed
    }
  }

  /**
   * Set the current job promise
   * 
   * This should be called by the JobPoller when it starts processing a job,
   * so the shutdown handler knows to wait for it.
   * 
   * @param jobPromise - Promise that resolves when job processing completes
   */
  setCurrentJob(jobPromise: Promise<void>): void {
    this.currentJobPromise = jobPromise
  }

  /**
   * Clear the current job promise
   * 
   * This should be called by the JobPoller when job processing completes,
   * so the shutdown handler knows there's no job to wait for.
   */
  clearCurrentJob(): void {
    this.currentJobPromise = null
  }

  /**
   * Check if shutdown is in progress
   * 
   * @returns True if shutdown has been initiated
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown
  }
}
