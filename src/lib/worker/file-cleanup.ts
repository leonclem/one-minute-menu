/**
 * File Cleanup Service
 * 
 * This module implements a background task that runs daily to delete old export
 * files and their associated database records. Files older than 30 days are
 * automatically removed to conserve storage space.
 * 
 * Task 21.1: Implement old file cleanup cron
 * Requirements: 9.4
 */

import { findOldCompletedJobs, deleteOldCompletedJobs } from './database-client'
import { StorageClient } from './storage-client'

/**
 * Configuration for file cleanup
 */
export interface FileCleanupConfig {
  /**
   * Interval in milliseconds between cleanup runs
   * Default: 24 hours (86400000ms)
   */
  intervalMs?: number

  /**
   * Age threshold in days for file deletion
   * Default: 30 days
   */
  retentionDays?: number

  /**
   * Whether to run cleanup immediately on start
   * Default: false (wait for first interval)
   */
  runImmediately?: boolean

  /**
   * Storage client instance
   */
  storageClient: StorageClient

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
 * File Cleanup Service
 * 
 * Runs a periodic background task to delete old export files and job records.
 * Completed jobs older than the retention period (default 30 days) are:
 * 1. Deleted from Supabase Storage
 * 2. Deleted from the export_jobs table
 */
export class FileCleanup {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private config: Required<Omit<FileCleanupConfig, 'storageClient'>> & {
    storageClient: StorageClient
  }

  constructor(config: FileCleanupConfig) {
    this.config = {
      intervalMs: config.intervalMs ?? 24 * 60 * 60 * 1000, // 24 hours
      retentionDays: config.retentionDays ?? 30,
      runImmediately: config.runImmediately ?? false,
      storageClient: config.storageClient,
      logger: config.logger ?? {
        info: (msg, meta) => console.log(`[FileCleanup] ${msg}`, meta || ''),
        warn: (msg, meta) => console.warn(`[FileCleanup] ${msg}`, meta || ''),
        error: (msg, meta) => console.error(`[FileCleanup] ${msg}`, meta || ''),
      },
    }
  }

  /**
   * Start the file cleanup service
   * 
   * Begins periodic cleanup runs at the configured interval.
   * Optionally runs cleanup immediately on start.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.config.logger.warn('File cleanup already running, ignoring start request')
      return
    }

    this.isRunning = true
    this.config.logger.info('Starting file cleanup service', {
      intervalMs: this.config.intervalMs,
      retentionDays: this.config.retentionDays,
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

    this.config.logger.info('File cleanup service started successfully')
  }

  /**
   * Stop the file cleanup service
   * 
   * Stops the periodic cleanup task. Does not interrupt a cleanup run
   * that is already in progress.
   */
  stop(): void {
    if (!this.isRunning) {
      this.config.logger.warn('File cleanup not running, ignoring stop request')
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    this.config.logger.info('File cleanup service stopped')
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
   * 1. Queries for completed jobs > retention period old
   * 2. Deletes files from Supabase Storage
   * 3. Deletes job records from database
   * 4. Logs cleanup statistics
   * 
   * Requirements:
   * - 9.4: Automatically delete files older than 30 days
   */
  private async runCleanup(): Promise<void> {
    const startTime = Date.now()

    try {
      this.config.logger.info('Starting file cleanup cycle', {
        retentionDays: this.config.retentionDays,
      })

      // Calculate cutoff date
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      // Find old completed jobs
      const oldJobs = await findOldCompletedJobs(cutoffDate)

      if (oldJobs.length === 0) {
        this.config.logger.info('No old files found to clean up')
        return
      }

      this.config.logger.info('Found old jobs to clean up', {
        count: oldJobs.length,
        cutoffDate: cutoffDate.toISOString(),
      })

      // Delete files from storage
      let filesDeleted = 0
      let fileDeleteErrors = 0

      for (const job of oldJobs) {
        if (job.storage_path) {
          try {
            // Delete individual file from storage
            await this.config.storageClient.deleteFile(job.storage_path)
            filesDeleted++
          } catch (error) {
            fileDeleteErrors++
            this.config.logger.warn('Failed to delete file from storage', {
              jobId: job.id,
              storagePath: job.storage_path,
              error: error instanceof Error ? error.message : String(error),
            })
            // Continue with other files even if one fails
          }
        }
      }

      // Delete job records from database
      const jobsDeleted = await deleteOldCompletedJobs(cutoffDate)

      const duration = Date.now() - startTime

      this.config.logger.info('File cleanup completed', {
        oldJobsFound: oldJobs.length,
        filesDeleted,
        fileDeleteErrors,
        jobsDeleted,
        durationMs: duration,
        cutoffDate: cutoffDate.toISOString(),
      })
    } catch (error) {
      const duration = Date.now() - startTime

      this.config.logger.error('File cleanup failed', {
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
   * Returns statistics about the cleanup operation.
   */
  async triggerCleanup(): Promise<{
    oldJobsFound: number
    filesDeleted: number
    jobsDeleted: number
  }> {
    this.config.logger.info('Manual cleanup triggered')

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      const oldJobs = await findOldCompletedJobs(cutoffDate)

      if (oldJobs.length === 0) {
        return {
          oldJobsFound: 0,
          filesDeleted: 0,
          jobsDeleted: 0,
        }
      }

      // Delete files from storage
      let filesDeleted = 0
      for (const job of oldJobs) {
        if (job.storage_path) {
          try {
            await this.config.storageClient.deleteFile(job.storage_path)
            filesDeleted++
          } catch (error) {
            // Log but continue
            this.config.logger.warn('Failed to delete file', {
              jobId: job.id,
              storagePath: job.storage_path,
            })
          }
        }
      }

      // Delete job records
      const jobsDeleted = await deleteOldCompletedJobs(cutoffDate)

      this.config.logger.info('Manual cleanup completed', {
        oldJobsFound: oldJobs.length,
        filesDeleted,
        jobsDeleted,
      })

      return {
        oldJobsFound: oldJobs.length,
        filesDeleted,
        jobsDeleted,
      }
    } catch (error) {
      this.config.logger.error('Manual cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

/**
 * Create and start a file cleanup service with default configuration
 * 
 * This is a convenience function for Railway workers to quickly set up
 * file cleanup with sensible defaults.
 * 
 * @param config - Configuration including storage client
 * @returns FileCleanup instance
 */
export function createFileCleanup(config: FileCleanupConfig): FileCleanup {
  const cleanup = new FileCleanup(config)
  return cleanup
}
