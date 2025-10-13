/**
 * Metrics Collector
 * 
 * Collects and aggregates extraction metrics for monitoring and analysis:
 * - Token usage and costs per job
 * - Processing time tracking
 * - Confidence scores and quality metrics
 * - Aggregation by prompt version and date
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 12.1, 12.5
 */

import type { ExtractionJob, TokenUsage } from './menu-extraction-service'
import type { ExtractionResult } from './schema-stage1'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ExtractionMetrics {
  // Performance metrics
  averageProcessingTime: number
  p50ProcessingTime: number
  p95ProcessingTime: number
  p99ProcessingTime: number
  
  // Quality metrics
  averageConfidence: number
  manualCorrectionRate: number
  uncertainItemRate: number
  
  // Cost metrics
  totalExtractions: number
  totalTokensUsed: number
  totalCost: number
  averageCostPerExtraction: number
  
  // Error metrics
  failureRate: number
  retryRate: number
  apiErrorRate: number
  validationErrorRate: number
  
  // User satisfaction
  feedbackCount: number
  positiveRating: number
  negativeRating: number
}

export interface PromptMetrics {
  promptVersion: string
  schemaVersion: string
  date: string
  totalExtractions: number
  averageConfidence: number
  averageProcessingTime: number
  averageTokenUsage: number
  averageCost: number
  manualCorrectionRate: number
}

export interface DailyMetrics {
  date: string
  totalExtractions: number
  totalCost: number
  averageCost: number
  averageConfidence: number
  failureRate: number
}

export interface UserSpending {
  userId: string
  dailySpending: number
  monthlySpending: number
  totalExtractions: number
  lastExtraction: Date
}

// ============================================================================
// Metrics Collector Class
// ============================================================================

export class MetricsCollector {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  /**
   * Track extraction job completion
   * Updates aggregated metrics for the prompt version and date
   */
  async trackExtraction(job: ExtractionJob, result: ExtractionResult): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0]
      
      // Calculate metrics from job and result
      const confidence = result.menu.categories.reduce(
        (sum, cat) => sum + cat.confidence,
        0
      ) / Math.max(result.menu.categories.length, 1)
      
      const tokenUsage = job.tokenUsage?.totalTokens || 0
      const cost = job.tokenUsage?.estimatedCost || 0
      const processingTime = job.processingTime || 0

      // Upsert metrics (increment if exists, insert if not)
      const { error } = await this.supabase.rpc('upsert_extraction_metrics', {
        p_prompt_version: job.promptVersion,
        p_schema_version: job.schemaVersion,
        p_date: date,
        p_confidence: confidence,
        p_processing_time: processingTime,
        p_token_usage: tokenUsage,
        p_cost: cost
      })

      if (error) {
        console.error('Error tracking extraction metrics:', error)
      }
    } catch (error) {
      console.error('Failed to track extraction:', error)
    }
  }

  /**
   * Get metrics for a specific prompt version
   */
  async getPromptMetrics(
    promptVersion: string,
    schemaVersion: string,
    startDate?: string,
    endDate?: string
  ): Promise<PromptMetrics[]> {
    let query = this.supabase
      .from('extraction_prompt_metrics')
      .select('*')
      .eq('prompt_version', promptVersion)
      .eq('schema_version', schemaVersion)
      .order('date', { ascending: false })

    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching prompt metrics:', error)
      return []
    }

    return data.map((row: any) => ({
      promptVersion: row.prompt_version,
      schemaVersion: row.schema_version,
      date: row.date,
      totalExtractions: row.total_extractions,
      averageConfidence: row.average_confidence,
      averageProcessingTime: row.average_processing_time,
      averageTokenUsage: row.average_token_usage,
      averageCost: row.average_cost,
      manualCorrectionRate: row.manual_correction_rate || 0
    }))
  }

  /**
   * Get daily metrics across all prompt versions
   */
  async getDailyMetrics(startDate: string, endDate: string): Promise<DailyMetrics[]> {
    const { data, error } = await this.supabase
      .from('extraction_prompt_metrics')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching daily metrics:', error)
      return []
    }

    // Aggregate by date
    const metricsMap = new Map<string, DailyMetrics>()
    
    for (const row of data) {
      const existing = metricsMap.get(row.date) || {
        date: row.date,
        totalExtractions: 0,
        totalCost: 0,
        averageCost: 0,
        averageConfidence: 0,
        failureRate: 0
      }

      existing.totalExtractions += row.total_extractions
      existing.totalCost += row.average_cost * row.total_extractions
      
      metricsMap.set(row.date, existing)
    }

    // Calculate averages
    const metrics = Array.from(metricsMap.values()).map(m => ({
      ...m,
      averageCost: m.totalCost / Math.max(m.totalExtractions, 1)
    }))

    return metrics
  }

  /**
   * Get user spending for cost tracking
   */
  async getUserSpending(userId: string): Promise<UserSpending> {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    // Get daily spending
    const { data: dailyJobs } = await this.supabase
      .from('menu_extraction_jobs')
      .select('token_usage, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', today)

    const dailySpending = (dailyJobs || []).reduce(
      (sum: number, job: any) => sum + (job.token_usage?.estimatedCost || 0),
      0
    )

    // Get monthly spending
    const { data: monthlyJobs } = await this.supabase
      .from('menu_extraction_jobs')
      .select('token_usage, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', monthStartStr)

    const monthlySpending = (monthlyJobs || []).reduce(
      (sum: number, job: any) => sum + (job.token_usage?.estimatedCost || 0),
      0
    )

    // Get last extraction
    const { data: lastJob } = await this.supabase
      .from('menu_extraction_jobs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return {
      userId,
      dailySpending,
      monthlySpending,
      totalExtractions: (monthlyJobs || []).length,
      lastExtraction: lastJob ? new Date(lastJob.created_at) : new Date()
    }
  }

  /**
   * Get overall extraction metrics
   */
  async getOverallMetrics(startDate: string, endDate: string): Promise<ExtractionMetrics> {
    // Get all completed jobs in date range
    const { data: jobs, error } = await this.supabase
      .from('menu_extraction_jobs')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (error || !jobs) {
      console.error('Error fetching jobs for metrics:', error)
      return this.getEmptyMetrics()
    }

    const completedJobs = jobs.filter((j: any) => j.status === 'completed')
    const failedJobs = jobs.filter((j: any) => j.status === 'failed')

    if (completedJobs.length === 0) {
      return this.getEmptyMetrics()
    }

    // Calculate processing time percentiles
    const processingTimes = completedJobs
      .map((j: any) => j.processing_time || 0)
      .sort((a: number, b: number) => a - b)

    const p50 = this.percentile(processingTimes, 50)
    const p95 = this.percentile(processingTimes, 95)
    const p99 = this.percentile(processingTimes, 99)

    // Calculate averages
    const avgProcessingTime = processingTimes.reduce((a: number, b: number) => a + b, 0) / processingTimes.length
    const avgConfidence = completedJobs.reduce((sum: number, j: any) => sum + (j.confidence || 0), 0) / completedJobs.length
    
    const totalTokens = completedJobs.reduce((sum: number, j: any) => {
      return sum + (j.token_usage?.totalTokens || 0)
    }, 0)
    
    const totalCost = completedJobs.reduce((sum: number, j: any) => {
      return sum + (j.token_usage?.estimatedCost || 0)
    }, 0)

    // Calculate rates
    const uncertainItemRate = completedJobs.reduce((sum: number, j: any) => {
      const uncertainCount = j.uncertain_items?.length || 0
      return sum + (uncertainCount > 0 ? 1 : 0)
    }, 0) / completedJobs.length

    const failureRate = failedJobs.length / jobs.length

    // Get feedback
    const { data: feedback } = await this.supabase
      .from('extraction_feedback')
      .select('feedback_type')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const feedbackCount = feedback?.length || 0
    const positiveCount = feedback?.filter((f: any) => f.feedback_type === 'excellent').length || 0
    const negativeCount = feedback?.filter((f: any) => 
      f.feedback_type === 'system_error' || f.feedback_type === 'needs_improvement'
    ).length || 0

    return {
      averageProcessingTime: Math.round(avgProcessingTime),
      p50ProcessingTime: Math.round(p50),
      p95ProcessingTime: Math.round(p95),
      p99ProcessingTime: Math.round(p99),
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      manualCorrectionRate: 0, // Would need to track corrections separately
      uncertainItemRate: Math.round(uncertainItemRate * 100) / 100,
      totalExtractions: completedJobs.length,
      totalTokensUsed: totalTokens,
      totalCost: Math.round(totalCost * 10000) / 10000,
      averageCostPerExtraction: Math.round((totalCost / completedJobs.length) * 10000) / 10000,
      failureRate: Math.round(failureRate * 100) / 100,
      retryRate: 0, // Would need to track retries separately
      apiErrorRate: 0, // Would need to track API errors separately
      validationErrorRate: 0, // Would need to track validation errors separately
      feedbackCount,
      positiveRating: feedbackCount > 0 ? Math.round((positiveCount / feedbackCount) * 100) / 100 : 0,
      negativeRating: feedbackCount > 0 ? Math.round((negativeCount / feedbackCount) * 100) / 100 : 0
    }
  }

  /**
   * Alert on threshold breach
   */
  async alertOnThreshold(
    metric: string,
    value: number,
    threshold: number,
    severity: 'info' | 'warning' | 'critical' = 'warning'
  ): Promise<void> {
    if (value > threshold) {
      console.warn(`[${severity.toUpperCase()}] Metric threshold exceeded:`, {
        metric,
        value,
        threshold,
        message: `${metric} exceeded threshold: ${value} > ${threshold}`
      })

      // In production, send alert via email/Slack/etc.
      // For now, just log to console
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
  }

  private getEmptyMetrics(): ExtractionMetrics {
    return {
      averageProcessingTime: 0,
      p50ProcessingTime: 0,
      p95ProcessingTime: 0,
      p99ProcessingTime: 0,
      averageConfidence: 0,
      manualCorrectionRate: 0,
      uncertainItemRate: 0,
      totalExtractions: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      averageCostPerExtraction: 0,
      failureRate: 0,
      retryRate: 0,
      apiErrorRate: 0,
      validationErrorRate: 0,
      feedbackCount: 0,
      positiveRating: 0,
      negativeRating: 0
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMetricsCollector(supabaseClient: any): MetricsCollector {
  return new MetricsCollector(supabaseClient)
}
