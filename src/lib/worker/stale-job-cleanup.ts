/**
 * Stale Job Cleanup Service
 * 
 * This module implements a background task that runs every 5 minutes to detect
 * and recover stale export jobs. A job is considered stale if it has been in
 * 'processing' status for more than 5 minutes, indicating the worker may have
 * crashed or become unresponsive.
 * 
 * Task 15.1: Implement stale job detection cron
 * Requirements: 6.3, 6.4, 6.6
 */

import { findStaleJobs, resetStaleJobs } from './database-client'

/**
 * Configuration for stale job cleanup
 */
export interface StaleJobCleanupConfig {
  /**
   * Interval in milliseconds between cleanup runs
   * Default: 5 minutes (300000ms)
   */
  intervalMs?: number

  /**
   * Whether to run cleanup immediately on start
   * Default: true
   */
  runImmediately?: boolean

  /**
   * Custom logger function
   */
  logger?: {
    info: (message: string, meta?: any) => void
    warn: (message: string, meta?: any) => void
    error: (message: string, meta?: any) => void
  }
}

/**
 * Stale Job Cleanup Service
 * 
 * Runs a periodic background task to detect and reset stale jobs.
 * Jobs in 'processing' status for more than 5 minutes are reset to 'pending'
 * with available_at = NOW() for immediate retry.
 */
export class StaleJobCleanup {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private config: Required<StaleJobCleanupConfig>

  constructor(config: StaleJobCleanupConfig = {}) {
    this.config = {
      intervalMs: config.intervalMs ?? 5 * 60 * 1000, // 5 minutes
      runImmediately: config.runImmediately ?? true,
      logger: config.logger ?? {
        info: (msg, meta) => console.log(`[StaleJobCleanup] ${msg}`, meta || ''),
        warn: (msg, meta) => console.warn(`[StaleJobCleanup] ${msg}`, meta || ''),
        error: (msg, meta) => console.error(`[StaleJobCleanup] ${msg}`, meta || ''),
      },
    }
  }

  /**
   * Start the stale job cleanup service
   * 
   * Begins periodic cleanup runs at the configured interval.
   * Optionally runs cleanup immediately on start.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.config.logger.warn('Stale job cleanup already running, ignoring start request')
      return
    }

    this.isRunning = true
    this.config.logger.info('Starting stale job cleanup service', {
      intervalMs: this.config.intervalMs,
      runImmediately: this.config.runImmediately,
    })

    // Run immediately if configured
    if (this.config.runImmediately) {
      await this.runCleanup()
    }

    // Schedule periodic cleanup
    this.intervalId = setInterval(async () => {
      await this.runCleanup()
    }, this.config.intervalMs)

    this.config.logger.info('Stale job cleanup service started successfully')
  }

  /**
   * Stop the stale job cleanup service
   * 
   * Stops the periodic cleanup task. Does not interrupt a cleanup run
   * that is already in progress.
   */
  stop(): void {
    if (!this.isRunning) {
      this.config.logger.warn('Stale job cleanup not running, ignoring stop request')
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    this.config.logger.info('Stale job cleanup service stopped')
  }

  /**
   * Check if the cleanup service is currently running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Run a single cleanup cycle
   * 
   * This method:
   * 1. Queries for jobs in 'processing' status > 5 minutes old
   * 2. Resets them to 'pending' status with available_at = NOW()
   * 3. Clears worker_id and started_at
   * 4. Logs recovery events
   * 
   * Requirements:
   * - 6.3: Detect stale jobs (processing > 5 minutes)
   * - 6.4: Reset them to pending status
   * - 6.6: Clear worker_id to allow re-processing
   */
  private async runCleanup(): Promise<void> {
    const startTime = Date.now()

    try {
      this.config.logger.info('Starting stale job cleanup cycle')

      // Find stale jobs first for logging
      const staleJobIds = await findStaleJobs()

      if (staleJobIds.length === 0) {
        this.config.logger.info('No stale jobs found')
        return
      }

      this.config.logger.warn('Found stale jobs, initiating recovery', {
        count: staleJobIds.length,
        jobIds: staleJobIds,
      })

      // Reset stale jobs to pending
      const resetCount = await resetStaleJobs()

      const duration = Date.now() - startTime

      this.config.logger.info('Stale job cleanup completed', {
        staleJobsFound: staleJobIds.length,
        jobsReset: resetCount,
        durationMs: duration,
      })

      // Log individual job recoveries for audit trail
      for (const jobId of staleJobIds) {
        this.config.logger.info('Stale job recovered', {
          jobId,
          action: 'reset_to_pending',
          reason: 'processing_timeout_exceeded',
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime

      this.config.logger.error('Stale job cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: duration,
      })

      // Don't throw - we want the service to continue running
      // The next cleanup cycle will try again
    }
  }

  /**
   * Manually trigger a cleanup cycle
   * 
   * Useful for testing or manual intervention.
   * Returns the number of jobs reset.
   */
  async triggerCleanup(): Promise<number> {
    this.config.logger.info('Manual cleanup triggered')

    try {
      const staleJobIds = await findStaleJobs()
      
      if (staleJobIds.length === 0) {
        return 0
      }

      const resetCount = await resetStaleJobs()

      this.config.logger.info('Manual cleanup completed', {
        jobsReset: resetCount,
      })

      return resetCount
    } catch (error) {
      this.config.logger.error('Manual cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

/**
 * Create and start a stale job cleanup service with default configuration
 * 
 * This is a convenience function for Railway workers to quickly set up
 * stale job cleanup with sensible defaults.
 * 
 * @param config - Optional configuration overrides
 * @returns StaleJobCleanup instance
 */
export function createStaleJobCleanup(
  config?: StaleJobCleanupConfig
): StaleJobCleanup {
  const cleanup = new StaleJobCleanup(config)
  return cleanup
}
