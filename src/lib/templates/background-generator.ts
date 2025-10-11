/**
 * Background Generator Service
 * 
 * Handles AI-generated background creation for menu templates using the nano-banana
 * integration. Implements job queue pattern for async generation with content-hash
 * based deduplication and caching.
 */

import { createHash } from 'crypto'
import { getNanoBananaClient, NanoBananaError, createGenerationError } from '../nano-banana'
import type { TemplateDescriptor } from './types'
import type { NanoBananaParams, GenerationError } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Parameters for background generation
 */
export interface BackgroundGenerationParams {
  /** User ID for ownership tracking */
  userId: string
  /** Menu ID for association */
  menuId: string
  /** Template identifier */
  templateId: string
  /** Reference style image from template */
  referenceImage: string
  /** Optional brand colors extracted from brand image */
  brandColors?: string[]
  /** Optional brand image URL for additional context */
  brandImageUrl?: string
  /** Seed for reproducible generation */
  seed?: number
}

/**
 * Result of background generation
 */
export interface BackgroundResult {
  /** Public URL of generated background */
  url: string
  /** Storage key/path for the background */
  storageKey: string
  /** Generation time in milliseconds */
  generationTime: number
  /** Job ID for tracking */
  jobId: string
}

/**
 * Background generation job status
 */
export type JobStatus = 'queued' | 'generating' | 'ready' | 'failed'

/**
 * Background generation job record
 */
export interface BackgroundJob {
  id: string
  userId: string
  menuId: string
  templateId: string
  contentHash: string
  status: JobStatus
  brandColors?: string[]
  resultUrl?: string
  errorMessage?: string
  errorCode?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  generationTime?: number
}

/**
 * Background Generator Service
 * 
 * Manages AI background generation with job queue, deduplication, and fallback strategies.
 */
export class BackgroundGenerator {
  private nanoBanana: ReturnType<typeof getNanoBananaClient>
  private supabase: SupabaseClient

  constructor(
    supabase: SupabaseClient,
    nanoBananaClient?: ReturnType<typeof getNanoBananaClient>
  ) {
    this.nanoBanana = nanoBananaClient || getNanoBananaClient()
    this.supabase = supabase
  }

  /**
   * Queue a background generation job
   * 
   * Creates a job record and checks for existing cached backgrounds based on content hash.
   * If a matching background exists, returns it immediately without queuing a new job.
   */
  async queueGeneration(params: BackgroundGenerationParams): Promise<BackgroundJob> {
    // Compute content hash for deduplication
    const contentHash = this.computeContentHash(params)

    // Check if we already have a completed job with this content hash
    const { data: existingJob, error: queryError } = await this.supabase
      .from('background_generation_jobs')
      .select('*')
      .eq('content_hash', contentHash)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!queryError && existingJob) {
      console.log('🎨 [Background Generator] Found cached background:', existingJob.id)
      return this.mapJobFromDb(existingJob)
    }

    // Create new job record
    const jobId = globalThis.crypto?.randomUUID?.() || require('crypto').randomUUID()
    const now = new Date().toISOString()

    const { data: newJob, error: insertError } = await this.supabase
      .from('background_generation_jobs')
      .insert({
        id: jobId,
        user_id: params.userId,
        menu_id: params.menuId,
        template_id: params.templateId,
        content_hash: contentHash,
        brand_colors: params.brandColors ? JSON.stringify(params.brandColors) : null,
        status: 'queued',
        created_at: now
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create background generation job: ${insertError.message}`)
    }

    console.log('🎨 [Background Generator] Queued new job:', jobId)
    return this.mapJobFromDb(newJob)
  }

  /**
   * Generate background image
   * 
   * Executes the actual background generation using nano-banana API.
   * Updates job status and stores the result in Supabase storage.
   */
  async generateBackground(
    params: BackgroundGenerationParams,
    jobId?: string
  ): Promise<BackgroundResult> {
    const startTime = Date.now()
    let job: BackgroundJob | null = null

    try {
      // If jobId provided, update job status to generating
      if (jobId) {
        await this.updateJobStatus(jobId, 'generating', { startedAt: new Date() })
        const { data } = await this.supabase
          .from('background_generation_jobs')
          .select('*')
          .eq('id', jobId)
          .single()
        if (data) {
          job = this.mapJobFromDb(data)
        }
      }

      // Build prompt for background generation
      const prompt = this.buildBackgroundPrompt(params)

      // Generate image using nano-banana
      console.log('🎨 [Background Generator] Generating background with prompt:', prompt.substring(0, 100))
      
      const nanoBananaParams: NanoBananaParams = {
        prompt,
        aspect_ratio: '1:1', // A4 portrait aspect ratio
        number_of_images: 1,
        safety_filter_level: 'block_some',
        person_generation: 'dont_allow'
      }

      const result = await this.nanoBanana.generateImage(nanoBananaParams)
      
      if (!result.images || result.images.length === 0) {
        throw new Error('No images returned from nano-banana')
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(result.images[0], 'base64')

      // Upload to storage
      const storageKey = await this.uploadToStorage(imageBuffer, params.templateId, params)
      
      // Get signed URL (valid for 1 year for long-lived access)
      const { data: urlData, error: urlError } = await this.supabase.storage
        .from('backgrounds')
        .createSignedUrl(storageKey, 31536000) // 1 year in seconds

      if (urlError || !urlData) {
        throw new Error(`Failed to create signed URL: ${urlError?.message || 'Unknown error'}`)
      }

      const generationTime = Date.now() - startTime

      // Update job status if we have a job
      if (jobId) {
        await this.updateJobStatus(jobId, 'ready', {
          completedAt: new Date(),
          resultUrl: urlData.signedUrl,
          generationTime
        })
      }

      console.log('🎨 [Background Generator] Generated background in', generationTime, 'ms')

      return {
        url: urlData.signedUrl,
        storageKey,
        generationTime,
        jobId: jobId || 'direct'
      }
    } catch (error) {
      const generationTime = Date.now() - startTime
      
      // Update job status to failed if we have a job
      if (jobId) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorCode = error instanceof NanoBananaError ? error.code : 'GENERATION_FAILED'
        
        await this.updateJobStatus(jobId, 'failed', {
          completedAt: new Date(),
          errorMessage,
          errorCode,
          generationTime
        })
      }

      // Re-throw for caller to handle
      throw error
    }
  }

  /**
   * Get fallback background
   * 
   * Returns a solid color or stock textured background when AI generation fails.
   */
  async getFallbackBackground(
    templateId: string,
    brandColors?: string[]
  ): Promise<string> {
    // Use first brand color or default to a neutral color
    const fallbackColor = brandColors?.[0] || '#F3F4F6'
    
    console.log('🎨 [Background Generator] Using fallback background:', fallbackColor)
    
    // For now, return a data URL with solid color
    // In the future, this could return a stock textured background from storage
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="2480" height="3508" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${fallbackColor}"/>
      </svg>
    `)}`
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<BackgroundJob | null> {
    const { data, error } = await this.supabase
      .from('background_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !data) {
      return null
    }

    return this.mapJobFromDb(data)
  }

  /**
   * Build background generation prompt
   * 
   * Constructs a prompt for nano-banana that incorporates template style,
   * brand colors, and reference image guidance.
   */
  private buildBackgroundPrompt(params: BackgroundGenerationParams): string {
    let prompt = `Create an elegant, professional menu background in the style of ${params.templateId}. `
    
    // Add reference image context
    if (params.referenceImage) {
      prompt += `Use the reference style from ${params.referenceImage}. `
    }

    // Add brand colors context
    if (params.brandColors && params.brandColors.length > 0) {
      prompt += `Incorporate these brand colors into the color palette: ${params.brandColors.join(', ')}. `
    }

    // Add general requirements
    prompt += `The background should be subtle and not overpower text content. `
    prompt += `Avoid any text, logos, or recognizable objects. `
    prompt += `Focus on abstract textures, gradients, or subtle patterns. `
    prompt += `Suitable for a restaurant menu with high-quality food photography aesthetic.`

    return prompt
  }

  /**
   * Upload generated background to Supabase storage
   * 
   * Uses content-hash based paths for deduplication.
   * Path format: {userId}/{templateId}/{contentHash}.webp
   */
  private async uploadToStorage(
    imageBuffer: Buffer,
    templateId: string,
    params: BackgroundGenerationParams
  ): Promise<string> {
    const contentHash = this.computeContentHash(params)
    const storageKey = `${params.userId}/${templateId}/${contentHash}.webp`

    // Check if file already exists
    const { data: existingFile } = await this.supabase.storage
      .from('backgrounds')
      .list(`${params.userId}/${templateId}`, {
        search: `${contentHash}.webp`
      })

    if (existingFile && existingFile.length > 0) {
      console.log('🎨 [Background Generator] Background already exists in storage:', storageKey)
      return storageKey
    }

    // Upload new file
    const { error: uploadError } = await this.supabase.storage
      .from('backgrounds')
      .upload(storageKey, imageBuffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload background to storage: ${uploadError.message}`)
    }

    console.log('🎨 [Background Generator] Uploaded background to storage:', storageKey)
    return storageKey
  }

  /**
   * Compute content hash for deduplication
   * 
   * Creates a hash from template ID and brand colors to identify unique backgrounds.
   * Note: userId and menuId are excluded from hash to enable deduplication across users.
   */
  private computeContentHash(params: BackgroundGenerationParams): string {
    const hashInput = JSON.stringify({
      templateId: params.templateId,
      brandColors: params.brandColors?.sort() || [],
      seed: params.seed || 0
    })

    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16)
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    updates: Partial<{
      startedAt: Date
      completedAt: Date
      resultUrl: string
      errorMessage: string
      errorCode: string
      generationTime: number
    }>
  ): Promise<void> {
    const updateData: any = { status }

    if (updates.startedAt) {
      updateData.started_at = updates.startedAt.toISOString()
    }
    if (updates.completedAt) {
      updateData.completed_at = updates.completedAt.toISOString()
    }
    if (updates.resultUrl) {
      updateData.result_url = updates.resultUrl
    }
    if (updates.errorMessage) {
      updateData.error_message = updates.errorMessage
    }
    if (updates.errorCode) {
      updateData.error_code = updates.errorCode
    }
    if (updates.generationTime !== undefined) {
      updateData.generation_time = updates.generationTime
    }

    const { error } = await this.supabase
      .from('background_generation_jobs')
      .update(updateData)
      .eq('id', jobId)

    if (error) {
      console.error('Failed to update job status:', error)
    }
  }

  /**
   * Map database record to BackgroundJob
   */
  private mapJobFromDb(data: any): BackgroundJob {
    return {
      id: data.id,
      userId: data.user_id,
      menuId: data.menu_id,
      templateId: data.template_id,
      contentHash: data.content_hash,
      status: data.status,
      brandColors: data.brand_colors ? JSON.parse(data.brand_colors) : undefined,
      resultUrl: data.result_url,
      errorMessage: data.error_message,
      errorCode: data.error_code,
      createdAt: new Date(data.created_at),
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      generationTime: data.generation_time
    }
  }
}

/**
 * Create a background generator instance
 */
export function createBackgroundGenerator(supabase: SupabaseClient): BackgroundGenerator {
  return new BackgroundGenerator(supabase)
}
