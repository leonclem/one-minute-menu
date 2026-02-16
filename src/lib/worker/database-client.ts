// @ts-nocheck - export_jobs table not yet in generated Database types
/**
 * Database client for Railway workers
 * 
 * This module provides a Supabase client configured with service role access
 * for Railway workers to process export jobs. It includes connection pooling,
 * error handling, and retry logic.
 * 
 * SECURITY: This client bypasses RLS and should only be used in secure
 * worker environments, never exposed to client-side code.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import fs from 'node:fs'

/**
 * Configuration for database client
 */
export interface DatabaseClientConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  maxRetries?: number
  retryDelayMs?: number
  connectionTimeout?: number
}

/**
 * Database client singleton for Railway workers
 */
class DatabaseClient {
  private client: SupabaseClient<Database> | null = null
  private config: DatabaseClientConfig | null = null
  private isInitialized = false

  /**
   * Initialize the database client with service role access
   * 
   * @param config - Database client configuration
   * @throws Error if required environment variables are missing
   */
  initialize(config: DatabaseClientConfig): void {
    if (this.isInitialized) {
      console.warn('[DatabaseClient] Client already initialized, skipping')
      return
    }

    // Validate required configuration
    if (!config.supabaseUrl) {
      throw new Error('Missing required config: supabaseUrl')
    }

    if (!config.supabaseServiceRoleKey) {
      throw new Error('Missing required config: supabaseServiceRoleKey')
    }

    // Set defaults for optional configuration
    const finalConfig: Required<DatabaseClientConfig> = {
      supabaseUrl: config.supabaseUrl,
      supabaseServiceRoleKey: config.supabaseServiceRoleKey,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      connectionTimeout: config.connectionTimeout ?? 10000,
    }

    this.config = finalConfig

    try {
      // Create Supabase client with service role key
      // This bypasses RLS and provides full database access
      this.client = createClient<Database>(
        finalConfig.supabaseUrl,
        finalConfig.supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          db: {
            schema: 'public',
          },
          global: {
            headers: {
              'x-worker-client': 'railway-export-worker',
            },
          },
        }
      )

      this.isInitialized = true
      console.log('[DatabaseClient] Successfully initialized with service role access')
    } catch (error) {
      console.error('[DatabaseClient] Failed to initialize:', error)
      throw new Error(`Failed to initialize database client: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get the Supabase client instance
   * 
   * @returns Supabase client with service role access
   * @throws Error if client is not initialized
   */
  getClient(): SupabaseClient<Database> {
    if (!this.client || !this.isInitialized) {
      throw new Error('Database client not initialized. Call initialize() first.')
    }

    return this.client
  }

  /**
   * Execute a database query with automatic retry logic
   * 
   * @param operation - Async function that performs the database operation
   * @param operationName - Name of the operation for logging
   * @returns Result of the operation
   * @throws Error if all retries are exhausted
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'database operation'
  ): Promise<T> {
    if (!this.config) {
      throw new Error('Database client not initialized')
    }

    const maxRetries = this.config.maxRetries ?? 3
    const retryDelayMs = this.config.retryDelayMs ?? 1000
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError)
        
        if (!isRetryable || attempt === maxRetries) {
          console.error(
            `[DatabaseClient] ${operationName} failed after ${attempt + 1} attempts:`,
            lastError.message
          )
          throw lastError
        }

        // Calculate exponential backoff delay
        const delay = retryDelayMs * Math.pow(2, attempt)
        console.warn(
          `[DatabaseClient] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
          lastError.message
        )

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Unknown error during retry')
  }

  /**
   * Check if an error is retryable (transient network/connection issues)
   * 
   * @param error - Error to check
   * @returns True if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    // Also check cause - Node fetch often wraps ECONNREFUSED/ETIMEDOUT in "fetch failed"
    const causeMessage = error.cause && typeof (error.cause as Error).message === 'string'
      ? ((error.cause as Error).message as string).toLowerCase()
      : ''

    // Network and connection errors that are typically transient
    const retryablePatterns = [
      'econnrefused',
      'etimedout',
      'enotfound',
      'connection pool exhausted',
      'connection timeout',
      'network error',
      'socket hang up',
      'econnreset',
      'fetch failed', // Node fetch surfaces many network errors with this generic message
    ]

    const toCheck = `${message} ${causeMessage}`
    return retryablePatterns.some(pattern => toCheck.includes(pattern))
  }

  /**
   * Test database connectivity
   * 
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient()
      const { error } = await client.from('export_jobs').select('id').limit(1)
      
      if (error) {
        console.error('[DatabaseClient] Connection test failed:', error.message)
        return false
      }

      console.log('[DatabaseClient] Connection test successful')
      return true
    } catch (error) {
      console.error('[DatabaseClient] Connection test error:', error)
      return false
    }
  }

  /**
   * Gracefully close the database connection
   */
  async close(): Promise<void> {
    if (this.client) {
      // Supabase client doesn't have an explicit close method
      // but we can clear our reference
      this.client = null
      this.isInitialized = false
      console.log('[DatabaseClient] Connection closed')
    }
  }

  /**
   * Check if client is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null
  }
}

// Export singleton instance
export const databaseClient = new DatabaseClient()

/**
 * Initialize database client from environment variables
 * 
 * This is a convenience function for Railway workers to initialize
 * the client using standard environment variables.
 * 
 * @throws Error if required environment variables are missing
 */
export function initializeDatabaseClient(): void {
  // IMPORTANT:
  // - In Docker, `localhost` points to the container so we must use a gateway/internal URL.
  // - Allow a dedicated worker/internal URL env var to avoid breaking the host app.
  const supabaseUrl = resolveSupabaseUrlForWorker()
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY')
  }

  databaseClient.initialize({
    supabaseUrl,
    supabaseServiceRoleKey,
    maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.DB_RETRY_DELAY_MS || '1000', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  })
}

function resolveSupabaseUrlForWorker(): string | undefined {
  const isDocker = isRunningInDocker()

  const internal =
    process.env.SUPABASE_INTERNAL_URL ||
    process.env.WORKER_SUPABASE_URL

  const fallback =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const selected = (internal || fallback) || undefined
  if (!selected) return undefined

  if (isDocker) {
    return rewriteLocalhostToGateway(selected)
  }

  return selected
}

function rewriteLocalhostToGateway(inputUrl: string): string {
  try {
    const url = new URL(inputUrl)
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return inputUrl
    }
    url.hostname = process.env.WORKER_HOST_GATEWAY || 'host.docker.internal'
    return url.toString()
  } catch {
    return inputUrl
  }
}

function isRunningInDocker(): boolean {
  if (process.env.RUNNING_IN_DOCKER === 'true') return true
  try {
    if (fs.existsSync('/.dockerenv')) return true
  } catch {
    // ignore
  }
  try {
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
    return /docker|containerd|kubepods/i.test(cgroup)
  } catch {
    return false
  }
}

/**
 * Export job type from database
 */
export interface ExportJob {
  id: string
  user_id: string
  menu_id: string
  export_type: 'pdf' | 'image'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  retry_count: number
  error_message: string | null
  file_url: string | null
  storage_path: string | null
  available_at: string
  metadata: Record<string, any>
  worker_id: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

/**
 * Queue statistics interface
 */
export interface QueueStats {
  pending_count: number
  processing_count: number
  completed_count_24h: number
  failed_count_24h: number
  average_processing_time_seconds: number
  oldest_pending_job_age_seconds: number
}

/**
 * Job status update data
 */
export interface StatusUpdateData {
  completed_at?: string
  storage_path?: string
  file_url?: string
  error_message?: string
}

/**
 * Task 3.2: Atomic job claiming with backoff support
 * 
 * Claims one pending job atomically using SELECT FOR UPDATE SKIP LOCKED.
 * Respects available_at timestamp for retry backoff.
 * 
 * @param workerId - Unique identifier for the worker claiming the job
 * @returns Claimed job or null if no jobs available
 */
export async function claimJob(workerId: string): Promise<ExportJob | null> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    // Use RPC to execute atomic claim in a single transaction
    // @ts-ignore - RPC function not in generated types yet
    const { data, error } = await client.rpc('claim_export_job', {
      p_worker_id: workerId
    }) as { data: ExportJob[] | null; error: any }

    if (error) {
      throw new Error(`Failed to claim job: ${error.message}`)
    }

    // RPC returns array, get first result or null
    return data && data.length > 0 ? data[0] : null
  }, 'claimJob')
}

/**
 * Extraction job type from database
 */
export interface ExtractionJob {
  id: string
  user_id: string
  menu_id: string | null
  image_url: string
  image_hash: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  schema_version: 'stage1' | 'stage2'
  prompt_version: string
  retry_count: number
  priority: number
  worker_id: string | null
  available_at: string
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  result?: any
  token_usage?: any
  confidence?: number
  uncertain_items?: any[]
  superfluous_text?: any[]
  error_message?: string
}

/**
 * Atomic extraction job claiming
 * 
 * @param workerId - Unique identifier for the worker claiming the job
 * @returns Claimed extraction job or null if no jobs available
 */
export async function claimExtractionJob(workerId: string): Promise<ExtractionJob | null> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    // Use RPC to execute atomic claim in a single transaction
    // @ts-ignore - RPC function not in generated types yet
    const { data, error } = await client.rpc('claim_menu_extraction_job', {
      p_worker_id: workerId
    }) as { data: ExtractionJob[] | null; error: any }

    if (error) {
      throw new Error(`Failed to claim extraction job: ${error.message}`)
    }

    // RPC returns array, get first result or null
    return data && data.length > 0 ? data[0] : null
  }, 'claimExtractionJob')
}

/**
 * Update extraction job status to completed
 */
export async function updateExtractionJobToCompleted(
  jobId: string,
  result: any,
  processingTime: number,
  tokenUsage?: any,
  confidence?: number,
  uncertainItems?: any[],
  superfluousText?: any[]
): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const { error } = await client
      .from('menu_extraction_jobs')
      .update({
        status: 'completed' as const,
        result,
        processing_time: processingTime,
        token_usage: tokenUsage,
        confidence,
        uncertain_items: uncertainItems,
        superfluous_text: superfluousText,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to update extraction job to completed: ${error.message}`)
    }
  }, 'updateExtractionJobToCompleted')
}

/**
 * Update extraction job status to failed
 */
export async function updateExtractionJobToFailed(
  jobId: string,
  errorMessage: string
): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const { error } = await client
      .from('menu_extraction_jobs')
      .update({
        status: 'failed' as const,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to update extraction job to failed: ${error.message}`)
    }
  }, 'updateExtractionJobToFailed')
}

/**
 * Task 3.3: Update job status to processing
 * 
 * @param jobId - Job ID to update
 * @param workerId - Worker ID processing the job
 */
export async function updateJobToProcessing(
  jobId: string,
  workerId: string
): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    // @ts-ignore - export_jobs table not in generated types yet
    const { error } = await client
      .from('export_jobs')
      .update({
        status: 'processing' as const,
        worker_id: workerId,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to update job to processing: ${error.message}`)
    }
  }, 'updateJobToProcessing')
}

/**
 * Task 3.3: Update job status to completed
 * 
 * @param jobId - Job ID to update
 * @param storagePath - Path to file in storage
 * @param fileUrl - Signed URL for file download
 */
export async function updateJobToCompleted(
  jobId: string,
  storagePath: string,
  fileUrl: string
): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const { error } = await client
      .from('export_jobs')
      .update({
        status: 'completed' as const,
        storage_path: storagePath,
        file_url: fileUrl,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to update job to completed: ${error.message}`)
    }
  }, 'updateJobToCompleted')
}

/**
 * Task 3.3: Update job status to failed
 * 
 * @param jobId - Job ID to update
 * @param errorMessage - Error message to record
 */
export async function updateJobToFailed(
  jobId: string,
  errorMessage: string
): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const { error } = await client
      .from('export_jobs')
      .update({
        status: 'failed' as const,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to update job to failed: ${error.message}`)
    }
  }, 'updateJobToFailed')
}

/**
 * Task 3.3: Reset job to pending with exponential backoff
 * 
 * Used for retry logic with increasing delays between attempts.
 * 
 * @param jobId - Job ID to reset
 * @param retryDelaySeconds - Delay in seconds before job becomes available again
 * @param errorMessage - Error message to record
 */
export async function resetJobToPendingWithBackoff(
  jobId: string,
  retryDelaySeconds: number,
  errorMessage: string
): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    // First get current retry_count
    const { data: currentJob, error: fetchError } = await client
      .from('export_jobs')
      .select('retry_count')
      .eq('id', jobId)
      .single() as { data: { retry_count: number } | null; error: any }

    if (fetchError) {
      throw new Error(`Failed to fetch job for retry: ${fetchError.message}`)
    }

    // Calculate available_at timestamp
    const availableAt = new Date(Date.now() + retryDelaySeconds * 1000).toISOString()
    
    const { error } = await client
      .from('export_jobs')
      .update({
        status: 'pending' as const,
        retry_count: (currentJob?.retry_count || 0) + 1,
        available_at: availableAt,
        error_message: errorMessage,
        worker_id: null,
        started_at: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to reset job with backoff: ${error.message}`)
    }
  }, 'resetJobToPendingWithBackoff')
}

/**
 * Task 3.3: Reset job to pending immediately (no backoff)
 * 
 * Used for stale job recovery where we want immediate retry.
 * 
 * @param jobId - Job ID to reset
 */
export async function resetJobToPendingImmediate(jobId: string): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const { error } = await client
      .from('export_jobs')
      .update({
        status: 'pending' as const,
        available_at: new Date().toISOString(), // Available immediately
        worker_id: null,
        started_at: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to reset job immediately: ${error.message}`)
    }
  }, 'resetJobToPendingImmediate')
}

/**
 * Task 3.3: Generic job status update function
 * 
 * @param jobId - Job ID to update
 * @param status - New status
 * @param data - Additional data to update
 */
export async function updateJobStatus(
  jobId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  data?: StatusUpdateData
): Promise<void> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
      ...data,
    }

    const { error } = await client
      .from('export_jobs')
      .update(updateData as any)
      .eq('id', jobId)

    if (error) {
      throw new Error(`Failed to update job status: ${error.message}`)
    }
  }, 'updateJobStatus')
}

/**
 * Task 3.4: Check rate limit for user
 * 
 * Counts jobs created by user in the past hour.
 * 
 * @param userId - User ID to check
 * @returns Number of jobs created in past hour
 */
export async function checkRateLimit(userId: string): Promise<number> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { count, error } = await client
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo)

    if (error) {
      throw new Error(`Failed to check rate limit: ${error.message}`)
    }

    return count || 0
  }, 'checkRateLimit')
}

/**
 * Task 3.4: Check pending job limit for user
 * 
 * Counts jobs in pending or processing status for user.
 * 
 * @param userId - User ID to check
 * @returns Number of pending/processing jobs
 */
export async function checkPendingJobLimit(userId: string): Promise<number> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const { count, error } = await client
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])

    if (error) {
      throw new Error(`Failed to check pending job limit: ${error.message}`)
    }

    return count || 0
  }, 'checkPendingJobLimit')
}

/**
 * Task 3.5: Find stale jobs
 * 
 * Identifies jobs in processing status for more than 5 minutes.
 * 
 * @returns Array of stale job IDs
 */
export async function findStaleJobs(): Promise<string[]> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { data, error } = await client
      .from('export_jobs')
      .select('id')
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo) as { data: { id: string }[] | null; error: any }

    if (error) {
      throw new Error(`Failed to find stale jobs: ${error.message}`)
    }

    return data?.map(job => job.id) || []
  }, 'findStaleJobs')
}

/**
 * Task 3.5: Reset stale jobs to pending
 * 
 * Resets processing jobs that have been running too long.
 * Sets available_at to NOW() for immediate retry (no backoff).
 * 
 * @returns Number of jobs reset
 */
export async function resetStaleJobs(): Promise<number> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { data, error } = await client
      .from('export_jobs')
      .update({
        status: 'pending' as const,
        available_at: new Date().toISOString(), // Immediate retry
        worker_id: null,
        started_at: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo)
      .select('id') as { data: { id: string }[] | null; error: any }

    if (error) {
      throw new Error(`Failed to reset stale jobs: ${error.message}`)
    }

    return data?.length || 0
  }, 'resetStaleJobs')
}

/**
 * Task 3.6: Get queue depth
 * 
 * Counts pending jobs that are available for processing (available_at <= NOW).
 * 
 * @returns Number of pending jobs available for processing
 */
export async function getQueueDepth(): Promise<number> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const { count, error } = await client
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('available_at', new Date().toISOString())

    if (error) {
      throw new Error(`Failed to get queue depth: ${error.message}`)
    }

    return count || 0
  }, 'getQueueDepth')
}

/**
 * Task 3.6: Get job statistics by status
 * 
 * Returns counts of jobs in each status.
 * 
 * @returns Object with counts by status
 */
export async function getJobStatsByStatus(): Promise<Record<string, number>> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const statuses = ['pending', 'processing', 'completed', 'failed']
    const stats: Record<string, number> = {}
    
    for (const status of statuses) {
      const { count, error } = await client
        .from('export_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)

      if (error) {
        throw new Error(`Failed to get stats for status ${status}: ${error.message}`)
      }

      stats[status] = count || 0
    }

    return stats
  }, 'getJobStatsByStatus')
}

/**
 * Task 3.6: Get average processing time
 * 
 * Calculates average time from started_at to completed_at for completed jobs.
 * 
 * @returns Average processing time in seconds
 */
export async function getAverageProcessingTime(): Promise<number> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    // Get completed jobs from last 24 hours with timing data
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await client
      .from('export_jobs')
      .select('started_at, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', twentyFourHoursAgo)
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null) as { 
        data: { started_at: string; completed_at: string }[] | null; 
        error: any 
      }

    if (error) {
      throw new Error(`Failed to get average processing time: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return 0
    }

    // Calculate average processing time
    const totalSeconds = data.reduce((sum, job) => {
      const startTime = new Date(job.started_at!).getTime()
      const endTime = new Date(job.completed_at!).getTime()
      return sum + (endTime - startTime) / 1000
    }, 0)

    return totalSeconds / data.length
  }, 'getAverageProcessingTime')
}

/**
 * Task 3.6: Get comprehensive queue statistics
 * 
 * @returns Queue statistics object
 */
export async function getQueueStats(): Promise<QueueStats> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    // Get counts by status
    const [pendingCount, processingCount, completedCount, failedCount] = await Promise.all([
      client.from('export_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('export_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      client.from('export_jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', twentyFourHoursAgo),
      client.from('export_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('updated_at', twentyFourHoursAgo),
    ])

    // Get average processing time
    const avgProcessingTime = await getAverageProcessingTime()

    // Get oldest pending job
    const { data: oldestJob } = await client
      .from('export_jobs')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single() as { data: { created_at: string } | null; error: any }

    const oldestPendingAge = oldestJob
      ? (Date.now() - new Date(oldestJob.created_at).getTime()) / 1000
      : 0

    return {
      pending_count: pendingCount.count || 0,
      processing_count: processingCount.count || 0,
      completed_count_24h: completedCount.count || 0,
      failed_count_24h: failedCount.count || 0,
      average_processing_time_seconds: avgProcessingTime,
      oldest_pending_job_age_seconds: oldestPendingAge,
    }
  }, 'getQueueStats')
}

/**
 * Task 21.1: Find old completed jobs
 * 
 * Identifies completed jobs older than the specified date.
 * 
 * @param olderThan - Date threshold for old jobs
 * @returns Array of old job IDs with their storage paths
 */
export async function findOldCompletedJobs(
  olderThan: Date
): Promise<Array<{ id: string; storage_path: string | null }>> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()

    const { data, error } = await client
      .from('export_jobs')
      .select('id, storage_path')
      .eq('status', 'completed')
      .lt('created_at', olderThan.toISOString())

    if (error) {
      throw new Error(`Failed to find old completed jobs: ${error.message}`)
    }

    return data || []
  }, 'findOldCompletedJobs')
}

/**
 * Task 21.1: Delete old completed jobs
 * 
 * Deletes completed job records older than the specified date.
 * 
 * @param olderThan - Date threshold for old jobs
 * @returns Number of jobs deleted
 */
export async function deleteOldCompletedJobs(olderThan: Date): Promise<number> {
  return databaseClient.withRetry(async () => {
    const client = databaseClient.getClient()

    const { data, error } = await client
      .from('export_jobs')
      .delete()
      .eq('status', 'completed')
      .lt('created_at', olderThan.toISOString())
      .select('id')

    if (error) {
      throw new Error(`Failed to delete old completed jobs: ${error.message}`)
    }

    return data?.length || 0
  }, 'deleteOldCompletedJobs')
}
