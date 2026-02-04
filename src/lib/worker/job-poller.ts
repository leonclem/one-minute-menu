/**
 * JobPoller - Polls database for pending jobs and dispatches to JobProcessor
 * 
 * Responsibilities:
 * - Start/stop polling loop
 * - Query for pending jobs where available_at <= NOW()
 * - Atomically claim one job
 * - Dispatch claimed job to JobProcessor
 * - Implement adaptive polling (2s busy, 5s idle)
 * 
 * Requirements: 2.1, 2.3, 12.7, 12.8
 */

import { claimJob, claimExtractionJob, getQueueDepth } from './database-client'
import { JobProcessor } from './job-processor'
import type { ExportJob, ExtractionJob } from './database-client'
import { logJobEvent, logInfo, logWarning, logError } from './logger'
import {
  updateQueueDepth,
  incrementProcessingJobs,
  decrementProcessingJobs,
} from './metrics'

export interface JobPollerConfig {
  processor: JobProcessor
  workerId: string
  pollingIntervalBusyMs?: number
  pollingIntervalIdleMs?: number
  onJobStart?: (jobPromise: Promise<void>) => void
  onJobComplete?: () => void
}

export class JobPoller {
  private processor: JobProcessor
  private workerId: string
  private pollingIntervalBusyMs: number
  private pollingIntervalIdleMs: number
  private isRunning: boolean = false
  private pollingTimeout: NodeJS.Timeout | null = null
  private onJobStart?: (jobPromise: Promise<void>) => void
  private onJobComplete?: () => void

  constructor(config: JobPollerConfig) {
    this.processor = config.processor
    this.workerId = config.workerId
    this.pollingIntervalBusyMs = config.pollingIntervalBusyMs ?? 2000
    this.pollingIntervalIdleMs = config.pollingIntervalIdleMs ?? 5000
    this.onJobStart = config.onJobStart
    this.onJobComplete = config.onJobComplete
  }

  /**
   * Start the polling loop
   * 
   * Begins polling the database for pending jobs and processing them.
   * Uses adaptive polling intervals based on queue depth.
   * 
   * Requirements: 2.1
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logWarning('JobPoller already running, ignoring start request', {
        worker_id: this.workerId,
      })
      return
    }

    this.isRunning = true
    logInfo('JobPoller starting', {
      worker_id: this.workerId,
      busy_interval_ms: this.pollingIntervalBusyMs,
      idle_interval_ms: this.pollingIntervalIdleMs,
    })

    // Start the polling loop
    await this.poll()
  }

  /**
   * Stop the polling loop gracefully
   * 
   * Stops polling for new jobs. Does not interrupt currently processing job.
   * 
   * Requirements: 2.1
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logWarning('JobPoller not running, ignoring stop request', {
        worker_id: this.workerId,
      })
      return
    }

    logInfo('JobPoller stopping', { worker_id: this.workerId })
    this.isRunning = false

    // Clear any pending timeout
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout)
      this.pollingTimeout = null
    }

    logInfo('JobPoller stopped', { worker_id: this.workerId })
  }

  /**
   * Poll for pending jobs and process them
   * 
   * This is the main polling loop. It:
   * 1. Attempts to claim a job
   * 2. If job claimed, processes it
   * 3. Determines next polling interval based on queue depth
   * 4. Schedules next poll
   * 
   * Requirements: 2.1, 2.3, 12.7, 12.8
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      // 1. Attempt to claim an extraction job (higher priority for UX)
      const extractionJob = await this.claimExtractionJob()
      if (extractionJob) {
        logInfo('Claimed extraction job', { job_id: extractionJob.id })
        
        incrementProcessingJobs(this.workerId)
        const jobPromise = this.processor.processExtraction(extractionJob)
        
        if (this.onJobStart) {
          this.onJobStart(jobPromise)
        }

        await jobPromise
        decrementProcessingJobs(this.workerId)

        if (this.onJobComplete) {
          this.onJobComplete()
        }
        
        // After processing a job, immediately check for more work
        if (this.isRunning) {
          this.poll()
          return
        }
      }

      // 2. Attempt to claim an export job
      const exportJob = await this.claimExportJob()

      if (exportJob) {
        logJobEvent.claimed(
          exportJob.id,
          exportJob.export_type,
          exportJob.priority,
          exportJob.retry_count
        )
        
        // Increment processing jobs metric
        incrementProcessingJobs(this.workerId)

        // Process the job and track it for graceful shutdown
        const jobPromise = this.processor.process(exportJob)
        
        // Notify graceful shutdown handler that we're processing a job
        if (this.onJobStart) {
          this.onJobStart(jobPromise)
        }

        // Wait for job to complete
        await jobPromise
        
        // Decrement processing jobs metric
        decrementProcessingJobs(this.workerId)

        // Notify graceful shutdown handler that job is complete
        if (this.onJobComplete) {
          this.onJobComplete()
        }
        
        // After processing a job, immediately check for more work
        if (this.isRunning) {
          this.poll()
          return
        }
      }
    } catch (error) {
      logError('Error during polling', error as Error, {
        worker_id: this.workerId,
      })
      
      // Decrement processing jobs metric on error
      decrementProcessingJobs(this.workerId)
      
      // Clear job tracking on error
      if (this.onJobComplete) {
        this.onJobComplete()
      }
      // Continue polling even if there's an error
    }

    // Schedule next poll with adaptive interval
    if (this.isRunning) {
      const interval = await this.getPollingInterval()

      this.pollingTimeout = setTimeout(() => {
        this.poll()
      }, interval)
    }
  }

  /**
   * Atomically claim one export job from the queue
   */
  private async claimExportJob(): Promise<ExportJob | null> {
    try {
      return await claimJob(this.workerId)
    } catch (error) {
      logError('Error claiming export job', error as Error, {
        worker_id: this.workerId,
      })
      return null
    }
  }

  /**
   * Atomically claim one extraction job from the queue
   */
  private async claimExtractionJob(): Promise<ExtractionJob | null> {
    try {
      return await claimExtractionJob(this.workerId)
    } catch (error) {
      logError('Error claiming extraction job', error as Error, {
        worker_id: this.workerId,
      })
      return null
    }
  }

  /**
   * Get adaptive polling interval based on queue depth
   * 
   * Returns 2 seconds if jobs are pending (busy), 5 seconds if queue is empty (idle).
   * This reduces database load when there's no work to do.
   * 
   * @returns Polling interval in milliseconds
   * 
   * Requirements: 12.7, 12.8
   */
  private async getPollingInterval(): Promise<number> {
    try {
      const queueDepth = await getQueueDepth()
      
      // Update queue depth metric
      updateQueueDepth(queueDepth)

      if (queueDepth > 0) {
        // Jobs pending - use busy interval
        return this.pollingIntervalBusyMs
      } else {
        // Queue empty - use idle interval
        return this.pollingIntervalIdleMs
      }
    } catch (error) {
      logError('Error getting queue depth', error as Error, {
        worker_id: this.workerId,
      })
      // Default to idle interval on error
      return this.pollingIntervalIdleMs
    }
  }
}
