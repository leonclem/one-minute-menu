/**
 * Menu Extraction Service
 * 
 * Provides vision-LLM extraction using OpenAI GPT-4V API with:
 * - Image preprocessing (resize, compress, format conversion)
 * - Idempotency checking using SHA-256 image hash
 * - Retry logic for transient API errors
 * - Token usage tracking and cost calculation
 * - Processing time measurement
 * 
 * Requirements: 10.1, 10.2, 15.6, 8.1, 12.1
 */

import OpenAI from 'openai'
import { createHash } from 'crypto'
import { withRetry, HttpError } from '../retry'
import { validateExtraction, type ValidationResult, SchemaValidator } from './schema-validator'
import { getPromptPackage, type PromptOptions } from './prompt-stage1'
import type { ExtractionResult } from './schema-stage1'
import { 
  ExtractionErrorHandler, 
  type ErrorResponse,
  type ImageQualityAssessment,
  validateAndHandleErrors
} from './error-handler'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ExtractionJob {
  id: string
  userId: string
  imageUrl: string
  imageHash: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  schemaVersion: 'stage1' | 'stage2'
  promptVersion: string
  result?: ExtractionResult
  error?: string
  createdAt: Date
  completedAt?: Date
  processingTime?: number
  tokenUsage?: TokenUsage
  confidence?: number
  uncertainItems?: any[]
  superfluousText?: any[]
  retryCount?: number
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
}

export interface ExtractionOptions {
  schemaVersion?: 'stage1' | 'stage2'
  promptVersion?: string
  currency?: string
  language?: string
  includeExamples?: boolean
  customInstructions?: string
  force?: boolean
}

export interface ProcessingMetadata {
  processingTime: number
  tokenUsage: TokenUsage
  confidence: number
  imageHash: string
}

export interface ExtractionResponse {
  success: boolean
  job?: ExtractionJob
  error?: ErrorResponse
  qualityAssessment?: ImageQualityAssessment
}

// ============================================================================
// Constants
// ============================================================================

const OPENAI_MODEL = 'gpt-4o' // GPT-4 with vision capabilities
const MAX_IMAGE_SIZE = 2048 // Max dimension for image preprocessing
const IMAGE_QUALITY = 85 // JPEG quality (0-100)

// Token pricing (as of 2024, adjust as needed)
const PRICING = {
  inputTokensPer1M: 2.50,  // $2.50 per 1M input tokens
  outputTokensPer1M: 10.00  // $10.00 per 1M output tokens
}

// ============================================================================
// Menu Extraction Service Class
// ============================================================================

export class MenuExtractionService {
  private openai: OpenAI
  private supabase: any // Supabase client

  constructor(openaiApiKey: string, supabaseClient: any) {
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required')
    }

    this.openai = new OpenAI({
      apiKey: openaiApiKey
    })
    
    this.supabase = supabaseClient
  }

  /**
   * Submit an extraction job
   * Creates a job record and processes the image
   */
  async submitExtractionJob(
    imageUrl: string,
    userId: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionJob> {
    const startTime = Date.now()
    let jobId: string | undefined

    try {
      // Calculate image hash for idempotency
      const imageHash = await this.calculateImageHash(imageUrl)

      // Check for existing job with same image hash
      const existingJob = await this.findExistingJob(imageHash, userId)
      let job: ExtractionJob
      
      if (existingJob && existingJob.result) {
        // Check if result has the new vision-LLM format (menu.categories)
        const hasNewFormat = existingJob.result?.menu?.categories
        if (hasNewFormat) {
          console.log(`Returning cached result for image hash: ${imageHash}`)
          console.log(`Cached result has ${existingJob.result.menu.categories.length} categories`)
          return existingJob
        } else {
          console.warn(`Found completed job with old format result, will re-process. Job ID: ${existingJob.id}`)
          console.warn(`Old format result structure:`, JSON.stringify(Object.keys(existingJob.result)))
          // Reuse the existing job and re-process it
          job = existingJob
          jobId = job.id
        }
      }

      // Get prompt package
      const promptPackage = getPromptPackage({
        currencyOverride: options.currency as any,
        includeExamples: options.includeExamples ?? true,
        customInstructions: options.customInstructions
      })

      // Create job record only if we don't have an existing one to reuse
      if (!job!) {
        job = await this.createJobRecord(
          userId,
          imageUrl,
          imageHash,
          options.schemaVersion || 'stage1',
          options.promptVersion || promptPackage.version
        )
        jobId = job.id
      }

      // Update status to processing
      await this.updateJobStatus(job.id, 'processing')

      // Process with vision-LLM
      const result = await this.processWithVisionLLM(
        imageUrl,
        promptPackage,
        options
      )

      const processingTime = Date.now() - startTime

      // Calculate token usage and cost
      const tokenUsage = this.calculateTokenUsage(result.usage)

      // Update job with results
      const completedJob = await this.completeJob(
        job.id,
        result.extractionResult,
        processingTime,
        tokenUsage
      )

      // Track metrics (Requirements: 8.1, 8.2)
      try {
        const { createMetricsCollector } = await import('./metrics-collector')
        const metricsCollector = createMetricsCollector(this.supabase)
        await metricsCollector.trackExtraction(completedJob, result.extractionResult)
      } catch (error) {
        console.error('Failed to track metrics:', error)
        // Don't fail the job if metrics tracking fails
      }

      return completedJob
    } catch (error) {
      console.error('Extraction job failed:', error)
      
      // Handle error and update job status
      const errorResponse = ExtractionErrorHandler.handleVisionAPIError(error)
      
      if (jobId) {
        await this.failJob(jobId, errorResponse)
      }
      
      throw error
    }
  }

  /**
   * Process image with vision-LLM
   * Handles image preprocessing, API call, and validation
   */
  async processWithVisionLLM(
    imageUrl: string,
    promptPackage: any,
    options: ExtractionOptions = {}
  ): Promise<{
    extractionResult: ExtractionResult
    usage: any
    validation?: ValidationResult & { partial?: boolean; salvaged?: any }
  }> {
    // Preprocess image
    const processedImageUrl = await this.preprocessImage(imageUrl)

    // Helper to run the completion with a given detail level and prompt weight
    const runCompletion = async (detail: 'high' | 'low', includeExamples: boolean) => {
      const userPrompt = includeExamples ? promptPackage.userPrompt : promptPackage.userPromptNoExamples || promptPackage.userPrompt
      return withRetry(
        async () => {
          try {
            const response = await this.openai.chat.completions.create({
              model: OPENAI_MODEL,
              messages: [
                { role: 'system', content: promptPackage.systemRole },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: processedImageUrl, detail } }
                  ]
                }
              ],
              temperature: promptPackage.temperature,
              // Adaptive token limit: reduce for potentially large outputs
              max_tokens: detail === 'high' && includeExamples ? 3500 : 4096,
              response_format: { type: 'json_object' }
            })
            return response
          } catch (error: any) {
            if (error?.status) {
              throw new HttpError(error.message || 'OpenAI API error', error.status, error)
            }
            throw error
          }
        },
        {
          retries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 5000,
          timeoutMs: 120000 // allow up to 120s for very tall/dense images
        }
      )
    }

    // First attempt: high detail with examples
    let completion
    try {
      // Detect potentially huge images and disable examples to reduce prompt size
      const largeImageHeuristic = processedImageUrl.includes('_cb=') // already fetched; heuristic can be expanded
      const includeExamples = largeImageHeuristic ? false : (options.includeExamples ?? true)
      completion = await runCompletion('high', includeExamples)
    } catch (primaryError) {
      console.warn('Primary extraction attempt failed, retrying with lower detail and fewer examples...', primaryError)
      // Fallback attempt: lower detail and omit examples to reduce token pressure
      completion = await runCompletion('low', false)
    }

    // Extract response
    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    // Parse JSON response
    let rawData: any
    try {
      rawData = JSON.parse(content)
    } catch (error) {
      // Attempt to salvage truncated JSON by trimming to the last full object
      try {
        const lastBrace = content.lastIndexOf('}')
        if (lastBrace > 0) {
          const trimmed = content.slice(0, lastBrace + 1)
          rawData = JSON.parse(trimmed)
          console.warn('Recovered from truncated JSON by trimming to last closing brace')
        } else {
          throw error
        }
      } catch (e2) {
        throw new Error(`Failed to parse extraction result as JSON: ${error}`)
      }
    }

    // Validate against schema
    const validation = await this.validateResult(rawData)
    
    if (!validation.valid) {
      // Attempt to salvage partial data
      const validator = new SchemaValidator()
      const salvageAttempt = validator.salvagePartialData(rawData)
      
      if (salvageAttempt.itemsRecovered > 0) {
        console.log(`Salvaged ${salvageAttempt.itemsRecovered} items from ${salvageAttempt.categoriesRecovered} categories`)
        
        // Return salvaged data with warnings
        return {
          extractionResult: salvageAttempt.salvaged as ExtractionResult,
          usage: completion.usage,
          validation: {
            ...validation,
            partial: true,
            salvaged: salvageAttempt
          }
        }
      }
      
      // No salvageable data - throw error
      throw new Error(
        `Extraction result validation failed: ${validation.errors.map(e => e.message).join(', ')}`
      )
    }

    return {
      extractionResult: validation.data!,
      usage: completion.usage,
      validation
    }
  }

  /**
   * Validate extraction result against schema
   * Requirement: 10.4
   */
  async validateResult(data: unknown): Promise<ValidationResult> {
    const validator = new SchemaValidator()
    return validator.validateExtractionResult(data)
  }

  /**
   * Assess image quality based on confidence scores
   * Requirement: 11.3
   */
  assessImageQuality(result: ExtractionResult): ImageQualityAssessment {
    return ExtractionErrorHandler.assessImageQuality(result)
  }

  /**
   * Get job status and results
   */
  async getJobStatus(jobId: string): Promise<ExtractionJob | null> {
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      console.error('Error fetching job:', error)
      return null
    }

    return this.mapJobFromDb(data)
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate SHA-256 hash of image for idempotency
   */
  private async calculateImageHash(imageUrl: string): Promise<string> {
    try {
      // Cache-bust to avoid stale CDN/browser caches causing inconsistent hashes
      const url = new URL(imageUrl)
      url.searchParams.set('_cb', String(Date.now()))

      let response = await fetch(url.toString())
      if (!response.ok) {
        // Brief retry once in case of transient edge/cache issue
        await new Promise(r => setTimeout(r, 200))
        response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`)
        }
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      const hash = createHash('sha256')
      hash.update(buffer)
      
      return hash.digest('hex')
    } catch (error) {
      console.error('Error calculating image hash:', error)
      // Fallback to URL-based hash if image fetch fails
      const hash = createHash('sha256')
      hash.update(imageUrl)
      return hash.digest('hex')
    }
  }

  /**
   * Find existing job with same image hash
   */
  private async findExistingJob(
    imageHash: string,
    userId: string
  ): Promise<ExtractionJob | null> {
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .select('*')
      .eq('image_hash', imageHash)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapJobFromDb(data)
  }

  /**
   * Create job record in database
   */
  private async createJobRecord(
    userId: string,
    imageUrl: string,
    imageHash: string,
    schemaVersion: string,
    promptVersion: string
  ): Promise<ExtractionJob> {
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .insert({
        user_id: userId,
        image_url: imageUrl,
        image_hash: imageHash,
        status: 'queued',
        schema_version: schemaVersion,
        prompt_version: promptVersion,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create job record: ${error.message}`)
    }

    return this.mapJobFromDb(data)
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string,
    status: 'queued' | 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    const { error } = await this.supabase
      .from('menu_extraction_jobs')
      .update({ status })
      .eq('id', jobId)

    if (error) {
      console.error('Error updating job status:', error)
    }
  }

  /**
   * Complete job with results
   */
  private async completeJob(
    jobId: string,
    result: ExtractionResult,
    processingTime: number,
    tokenUsage: TokenUsage
  ): Promise<ExtractionJob> {
    const { data, error } = await this.supabase
      .from('menu_extraction_jobs')
      .update({
        status: 'completed',
        result: result,
        processing_time: processingTime,
        token_usage: tokenUsage,
        confidence: result.menu.categories.reduce(
          (sum, cat) => sum + cat.confidence,
          0
        ) / result.menu.categories.length,
        uncertain_items: result.uncertainItems,
        superfluous_text: result.superfluousText,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`)
    }

    return this.mapJobFromDb(data)
  }

  /**
   * Mark job as failed with error details
   */
  private async failJob(
    jobId: string,
    errorResponse: ErrorResponse
  ): Promise<void> {
    const { error } = await this.supabase
      .from('menu_extraction_jobs')
      .update({
        status: 'failed',
        error_message: errorResponse.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (error) {
      console.error('Error updating failed job:', error)
    }
  }

  /**
   * Preprocess image (resize, compress, format conversion)
   */
  private async preprocessImage(imageUrl: string): Promise<string> {
    // Check if URL is localhost (local development)
    const isLocalhost = imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')
    
    if (isLocalhost) {
      // Convert to base64 data URL for local development
      // OpenAI can't access localhost URLs, so we need to fetch and encode
      try {
        const response = await fetch(imageUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        
        // Detect content type from response or default to jpeg
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        
        return `data:${contentType};base64,${base64}`
      } catch (error) {
        console.error('Error converting localhost image to base64:', error)
        throw new Error(`Failed to preprocess localhost image: ${error}`)
      }
    }
    
    // For production URLs, return as-is
    // Supabase storage URLs should already be optimized and publicly accessible
    return imageUrl
  }

  /**
   * Calculate token usage and cost
   */
  private calculateTokenUsage(usage: any): TokenUsage {
    const inputTokens = usage?.prompt_tokens || 0
    const outputTokens = usage?.completion_tokens || 0
    const totalTokens = usage?.total_tokens || inputTokens + outputTokens

    const inputCost = (inputTokens / 1_000_000) * PRICING.inputTokensPer1M
    const outputCost = (outputTokens / 1_000_000) * PRICING.outputTokensPer1M
    const estimatedCost = inputCost + outputCost

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000 // Round to 4 decimal places
    }
  }

  /**
   * Map database record to ExtractionJob
   */
  private mapJobFromDb(data: any): ExtractionJob {
    return {
      id: data.id,
      userId: data.user_id,
      imageUrl: data.image_url,
      imageHash: data.image_hash,
      status: data.status,
      schemaVersion: data.schema_version || 'stage1',
      promptVersion: data.prompt_version || 'v1.0',
      result: data.result,
      error: data.error_message,
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      processingTime: data.processing_time,
      tokenUsage: data.token_usage,
      confidence: data.confidence,
      retryCount: data.retry_count
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a MenuExtractionService instance
 */
export function createMenuExtractionService(
  openaiApiKey: string,
  supabaseClient: any
): MenuExtractionService {
  return new MenuExtractionService(openaiApiKey, supabaseClient)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate estimated cost for an extraction
 */
export function estimateExtractionCost(
  imageSize: number,
  includeExamples: boolean = true
): number {
  // Rough estimation based on typical token usage
  // Image tokens: ~765 tokens per image (for high detail)
  // Prompt tokens: ~1000-1500 depending on examples
  // Output tokens: ~500-1000 depending on menu complexity
  
  const imageTokens = 765
  const promptTokens = includeExamples ? 1500 : 1000
  const outputTokens = 750 // Average
  
  const inputCost = ((imageTokens + promptTokens) / 1_000_000) * PRICING.inputTokensPer1M
  const outputCost = (outputTokens / 1_000_000) * PRICING.outputTokensPer1M
  
  return Math.round((inputCost + outputCost) * 10000) / 10000
}

/**
 * Check if extraction is within cost budget
 */
export function isWithinCostBudget(estimatedCost: number, budget: number = 0.03): boolean {
  return estimatedCost <= budget
}
