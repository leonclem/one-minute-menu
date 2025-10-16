/**
 * Job Queue Integration for Menu Extraction
 * 
 * This module handles job submission, status polling, LISTEN/NOTIFY for job completion,
 * retry mechanisms, and quota enforcement for the menu extraction system.
 * 
 * Requirements: 15.2, 15.8, 12.2, 12.3
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractionJob, ExtractionOptions } from './menu-extraction-service'

export class JobQueueError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'JobQueueError'
  }
}

export interface JobSubmissionResult {
  job: ExtractionJob
  cached: boolean
}

export interface QuotaCheckResult {
  allowed: boolean
  current: number
  limit: number
  reason?: string
}

export interface RateLimitCheckResult {
  allowed: boolean
  current: number
  limit: number
  resetAt?: Date
}

/**
 * Job Queue Manager for menu extraction jobs
 */
export class JobQueueManager {
  private supabase: SupabaseClient

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createServerSupabaseClient()
  }

  /**
   * Submit a new extraction job to the queue
   * Checks for existing jobs with same image hash for idempotency
   */
  async submitJob(
    userId: string,
    imageUrl: string,
    imageHash: string,
    options: ExtractionOptions = {}
  ): Promise<JobSubmissionResult> {
    // Check for existing job with same hash (idempotency)
    if (!options.force) {
      const existingJob = await this.findExistingJob(userId, imageHash)
      if (existingJob && existingJob.status === 'completed' && existingJob.result) {
        // Check if result has the new vision-LLM format (menu.categories)
        const hasNewFormat = existingJob.result?.menu?.categories
        if (hasNewFormat) {
          console.log('Returning cached result for image hash:', imageHash)
          return {
            job: existingJob,
            cached: true
          }
        } else {
          console.warn('Found completed job with old format result, will re-process. Job ID:', existingJob.id)
          // Fall through to create new job
        }
      } else if (existingJob && existingJob.status === 'completed' && !existingJob.result) {
        console.warn('Found completed job without result, will re-process. Job ID:', existingJob.id)
        // Fall through to create new job
      }
    }

    // Create new job
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .insert({
        user_id: userId,
        image_url: imageUrl,
        image_hash: imageHash,
        status: 'queued',
        schema_version: options.schemaVersion || 'stage1',
        prompt_version: options.promptVersion || 'v1.0',
        retry_count: 0
      })
      .select('*')
      .single()

    if (error) {
      throw new JobQueueError(`Failed to submit extraction job: ${error.message}`, error.code)
    }

    return {
      job: this.transformJob(data),
      cached: false
    }
  }

  /**
   * Get job status by job ID
   */
  async getJobStatus(jobId: string, userId?: string): Promise<ExtractionJob | null> {
    let query = this.supabase
      .from('menu_extraction_jobs')
      .select('*')
      .eq('id', jobId)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new JobQueueError(`Failed to get job status: ${error.message}`, error.code)
    }

    return this.transformJob(data)
  }

  /**
   * Find existing job by image hash
   */
  async findExistingJob(userId: string, imageHash: string): Promise<ExtractionJob | null> {
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('image_hash', imageHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new JobQueueError(`Failed to find existing job: ${error.message}`, error.code)
    }

    return data ? this.transformJob(data) : null
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: ExtractionJob['status'],
    userId?: string
  ): Promise<void> {
    let query = this.supabase
      .from('menu_extraction_jobs')
      .update({ status })
      .eq('id', jobId)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { error } = await query

    if (error) {
      throw new JobQueueError(`Failed to update job status: ${error.message}`, error.code)
    }
  }

  /**
   * Mark job as completed with results
   */
  async markJobCompleted(
    jobId: string,
    result: any,
    processingTime: number,
    tokenUsage?: { inputTokens: number; outputTokens: number; estimatedCost: number },
    confidence?: number,
    uncertainItems?: any[],
    superfluousText?: any[]
  ): Promise<ExtractionJob> {
    // Ensure result has expected structure before marking completed
    const hasCategories = !!result?.menu?.categories && Array.isArray(result.menu.categories)
    const statusToSet = hasCategories ? 'completed' : 'processing'

    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .update({
        status: statusToSet,
        result,
        processing_time: processingTime,
        token_usage: tokenUsage,
        confidence,
        uncertain_items: uncertainItems,
        superfluous_text: superfluousText,
        completed_at: hasCategories ? new Date().toISOString() : null
      })
      .eq('id', jobId)
      .select('*')
      .single()

    if (error) {
      throw new JobQueueError(`Failed to mark job as completed: ${error.message}`, error.code)
    }

    return this.transformJob(data)
  }

  /**
   * Mark job as failed with error message
   */
  async markJobFailed(
    jobId: string,
    errorMessage: string,
    incrementRetry: boolean = false
  ): Promise<ExtractionJob> {
    const updateData: any = {
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    }

    if (incrementRetry) {
      // Increment retry count
      const job = await this.getJobStatus(jobId)
      if (job) {
        updateData.retry_count = (job.retryCount || 0) + 1
      }
    }

    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select('*')
      .single()

    if (error) {
      throw new JobQueueError(`Failed to mark job as failed: ${error.message}`, error.code)
    }

    return this.transformJob(data)
  }

  /**
   * Retry a failed job
   * Creates a new job with incremented retry count
   */
  async retryJob(jobId: string, userId: string): Promise<ExtractionJob> {
    const job = await this.getJobStatus(jobId, userId)
    if (!job) {
      throw new JobQueueError('Job not found', 'JOB_NOT_FOUND')
    }

    if (job.status !== 'failed') {
      throw new JobQueueError('Can only retry failed jobs', 'INVALID_STATUS')
    }

    const maxRetries = 3
    if ((job.retryCount || 0) >= maxRetries) {
      throw new JobQueueError(`Maximum retry attempts (${maxRetries}) reached`, 'MAX_RETRIES_EXCEEDED')
    }

    // Create new job with incremented retry count
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .insert({
        user_id: userId,
        image_url: job.imageUrl,
        image_hash: job.imageHash,
        status: 'queued',
        schema_version: job.schemaVersion,
        prompt_version: job.promptVersion,
        retry_count: (job.retryCount || 0) + 1
      })
      .select('*')
      .single()

    if (error) {
      throw new JobQueueError(`Failed to retry job: ${error.message}`, error.code)
    }

    return this.transformJob(data)
  }

  /**
   * Check user's monthly extraction quota
   */
  async checkQuota(userId: string): Promise<QuotaCheckResult> {
    // Get user profile to check plan limits
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('plan, plan_limits')
      .eq('id', userId)
      .single()

    if (profileError) {
      throw new JobQueueError(`Failed to get user profile: ${profileError.message}`, profileError.code)
    }

    const plan = profile.plan || 'free'
    const planLimits = profile.plan_limits || {}
    
    // Default limits: free=5, premium=50, enterprise=unlimited(-1)
    const defaultLimits: Record<string, number> = {
      free: 5,
      premium: 50,
      enterprise: -1
    }
    
    const limit = planLimits.ocr_jobs ?? defaultLimits[plan] ?? 5

    // Unlimited quota
    if (limit < 0) {
      return {
        allowed: true,
        current: 0,
        limit: -1
      }
    }

    // Count jobs this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count, error: countError } = await this.supabase
      .from('menu_extraction_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())

    if (countError) {
      throw new JobQueueError(`Failed to check quota: ${countError.message}`, countError.code)
    }

    const current = count || 0
    const allowed = current < limit

    return {
      allowed,
      current,
      limit,
      reason: allowed ? undefined : `Monthly extraction limit reached (${current}/${limit})`
    }
  }

  /**
   * Check rate limit (uploads per hour)
   */
  async checkRateLimit(userId: string, limitPerHour: number = 10): Promise<RateLimitCheckResult> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const { count, error } = await this.supabase
      .from('menu_extraction_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString())

    if (error) {
      throw new JobQueueError(`Failed to check rate limit: ${error.message}`, error.code)
    }

    const current = count || 0
    const allowed = current < limitPerHour
    const resetAt = new Date(Date.now() + 60 * 60 * 1000)

    return {
      allowed,
      current,
      limit: limitPerHour,
      resetAt: allowed ? undefined : resetAt
    }
  }

  /**
   * List recent jobs for a user
   */
  async listUserJobs(userId: string, limit: number = 20): Promise<ExtractionJob[]> {
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new JobQueueError(`Failed to list user jobs: ${error.message}`, error.code)
    }

    return (data || []).map(job => this.transformJob(job))
  }

  /**
   * Transform database row to ExtractionJob type
   */
  private transformJob(row: any): ExtractionJob {
    return {
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      imageHash: row.image_hash,
      status: row.status,
      schemaVersion: row.schema_version || 'stage1',
      promptVersion: row.prompt_version || 'v1.0',
      result: row.result || undefined,
      error: row.error_message || undefined,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      processingTime: row.processing_time || undefined,
      retryCount: row.retry_count || 0,
      tokenUsage: row.token_usage || undefined,
      confidence: row.confidence || undefined,
      uncertainItems: row.uncertain_items || undefined,
      superfluousText: row.superfluous_text || undefined
    }
  }
}

/**
 * Setup LISTEN/NOTIFY for job completion events
 * This allows real-time updates when jobs complete
 */
export class JobNotificationListener {
  private supabase: SupabaseClient
  private channel: any

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase || createServerSupabaseClient()
  }

  /**
   * Subscribe to job completion events for a specific user
   */
  async subscribe(
    userId: string,
    onJobUpdate: (job: ExtractionJob) => void
  ): Promise<() => void> {
    // Subscribe to realtime changes on menu_extraction_jobs table
    this.channel = this.supabase
      .channel('menu_extraction_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_extraction_jobs',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.new) {
            const job = this.transformJob(payload.new)
            onJobUpdate(job)
          }
        }
      )
      .subscribe()

    // Return unsubscribe function
    return () => {
      if (this.channel) {
        this.supabase.removeChannel(this.channel)
      }
    }
  }

  /**
   * Unsubscribe from job notifications
   */
  async unsubscribe(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel)
      this.channel = null
    }
  }

  private transformJob(row: any): ExtractionJob {
    return {
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      imageHash: row.image_hash,
      status: row.status,
      schemaVersion: row.schema_version || 'stage1',
      promptVersion: row.prompt_version || 'v1.0',
      result: row.result || undefined,
      error: row.error_message || undefined,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      processingTime: row.processing_time || undefined,
      retryCount: row.retry_count || 0,
      tokenUsage: row.token_usage || undefined,
      confidence: row.confidence || undefined,
      uncertainItems: row.uncertain_items || undefined,
      superfluousText: row.superfluous_text || undefined
    }
  }
}

/**
 * Poll for job completion (alternative to LISTEN/NOTIFY for client-side)
 */
export async function pollJobStatus(
  jobId: string,
  userId: string,
  options: {
    maxAttempts?: number
    intervalMs?: number
    onUpdate?: (job: ExtractionJob) => void
  } = {}
): Promise<ExtractionJob> {
  const maxAttempts = options.maxAttempts || 60 // 60 attempts = 5 minutes at 5s intervals
  const intervalMs = options.intervalMs || 5000 // 5 seconds

  const queueManager = new JobQueueManager()

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const job = await queueManager.getJobStatus(jobId, userId)
    
    if (!job) {
      throw new JobQueueError('Job not found', 'JOB_NOT_FOUND')
    }

    if (options.onUpdate) {
      options.onUpdate(job)
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return job
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new JobQueueError('Job polling timeout', 'POLLING_TIMEOUT')
}
