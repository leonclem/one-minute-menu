/**
 * JobProcessor - Handles full job lifecycle from claim to completion
 * 
 * Responsibilities:
 * - Fetch render snapshot from job metadata
 * - Call PuppeteerRenderer to generate output
 * - Validate output format and size
 * - Set storage_path in database BEFORE upload
 * - Upload to Supabase Storage using deterministic path
 * - Update job status to completed with file_url
 * - Handle errors and trigger retries with backoff
 * 
 * Requirements: 2.4, 2.5, 2.7, 2.8, 2.10
 */

import { PuppeteerRenderer } from './puppeteer-renderer'
import { StorageClient, generateStoragePath } from './storage-client'
import { validateOutput } from './output-validator'
import { getRenderSnapshot } from './snapshot'
import { handleJobFailure } from './retry-strategy'
import {
  ExportJob,
  ExtractionJob,
  updateJobToCompleted,
  updateJobToFailed,
  resetJobToPendingWithBackoff,
  updateJobStatus,
  updateExtractionJobToCompleted,
  updateExtractionJobToFailed,
} from './database-client'
import { notificationService } from '@/lib/notification-service'
import { createMenuExtractionService } from '@/lib/extraction/menu-extraction-service'
import { createWorkerSupabaseClient } from '@/lib/supabase-worker'
import { getPromptPackage } from '@/lib/extraction/prompt-stage1'
import { getPromptPackageV2 } from '@/lib/extraction/prompt-stage2'
import type { PDFOptions, ImageOptions, RenderSnapshot } from '@/types'
import { logJobEvent, logError, logWarning, logInfo } from './logger'
import {
  recordJobCompleted,
  recordJobFailed,
  recordJobRetried,
  recordRenderDuration,
  recordUploadDuration,
} from './metrics'
import { generateLayoutV2 } from '@/lib/templates/v2/layout-engine-v2'
import { renderToPdf } from '@/lib/templates/v2/renderer-pdf-v2'
import { optimizeLayoutDocumentImages } from '@/lib/templates/v2/image-optimizer-v2'
import type { EngineMenuV2 } from '@/lib/templates/v2/engine-types-v2'

export interface JobProcessorConfig {
  renderer: PuppeteerRenderer
  storageClient: StorageClient
  jobTimeoutSeconds?: number
}

export class JobProcessor {
  private renderer: PuppeteerRenderer
  private storageClient: StorageClient
  private jobTimeoutSeconds: number

  constructor(config: JobProcessorConfig) {
    this.renderer = config.renderer
    this.storageClient = config.storageClient
    this.jobTimeoutSeconds = config.jobTimeoutSeconds ?? 60
  }

  /**
   * Process a single export job from start to completion
   * 
   * This is the main entry point for job processing. It orchestrates:
   * 1. Fetching render snapshot
   * 2. Rendering output
   * 3. Validating output
   * 4. Setting storage_path (BEFORE upload)
   * 5. Uploading to storage
   * 6. Updating job to completed
   * 
   * @param job - The export job to process
   * 
   * Requirements: 2.4, 2.5, 2.7, 2.8, 2.10
   */
  async process(job: ExportJob): Promise<void> {
    const startTime = Date.now()
    
    logJobEvent.started(job.id, job.export_type)

    // Load URLs for translation (images must be fetchable from inside Docker).
    const supabasePublicUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'http://localhost:54321'
    const supabaseInternalUrl =
      process.env.SUPABASE_INTERNAL_URL ||
      process.env.WORKER_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'http://host.docker.internal:54321'

    try {
      // Step 1: Fetch render snapshot from job metadata
      const snapshot = getRenderSnapshot(job.metadata)
      logInfo('Retrieved render snapshot', { job_id: job.id })

      // Step 2: Render the output
      const renderStartTime = Date.now()
      const output = await this.render(job, snapshot, supabasePublicUrl, supabaseInternalUrl)
      const renderDurationMs = Date.now() - renderStartTime
      
      // Record render duration metric
      recordRenderDuration(job.export_type, renderDurationMs / 1000)
      
      logInfo('Rendered output', {
        job_id: job.id,
        size_bytes: output.length,
        duration_ms: renderDurationMs,
      })

      // Step 3: Validate output format and size
      const imageFormat = job.export_type === 'image' ? 'png' : undefined
      const validation = validateOutput(output, job.export_type, imageFormat)

      if (!validation.valid) {
        throw new Error(
          `Output validation failed: ${validation.errors.join(', ')}`
        )
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        logWarning('Output validation warnings', {
          job_id: job.id,
          warnings: validation.warnings,
        })
      }

      logInfo('Output validated', {
        job_id: job.id,
        format_verified: validation.format_verified,
        file_size: validation.file_size,
      })

      // Step 4: Determine storage path (demo jobs use cache path for idempotency)
      const demoCachePath = (job.metadata as any)?.demo_cache_path
      const storagePath = demoCachePath ?? generateStoragePath(
        job.user_id!,
        job.export_type,
        job.id
      )

      // Step 5: Set storage_path in database BEFORE upload
      // This ensures idempotency - if upload fails, we can retry with same path
      await updateJobStatus(job.id, 'processing', {
        storage_path: storagePath,
      })
      logInfo('Set storage_path', {
        job_id: job.id,
        storage_path: storagePath,
      })

      // Step 6: Upload to Supabase Storage
      const uploadStartTime = Date.now()
      const contentType = this.getContentType(job.export_type)
      const publicUrl = await this.storageClient.upload(
        output,
        storagePath,
        contentType
      )
      const uploadDurationMs = Date.now() - uploadStartTime
      
      // Record upload duration metric
      recordUploadDuration(job.export_type, uploadDurationMs / 1000)
      
      logInfo('Uploaded file', {
        job_id: job.id,
        public_url: publicUrl,
        duration_ms: uploadDurationMs,
      })

      // Step 7: Generate signed URL with 7-day expiry
      const filename = buildFriendlyExportFilename(job)
      const signedUrl = await this.storageClient.generateSignedUrl(
        storagePath,
        604800, // 7 days in seconds
        filename
      )
      logInfo('Generated signed URL', { job_id: job.id })

      // Step 8: Update job status to completed
      await updateJobToCompleted(job.id, storagePath, signedUrl)
      
      // Calculate total duration and record metrics
      const totalDurationMs = Date.now() - startTime
      recordJobCompleted(job.export_type, totalDurationMs / 1000)
      
      logJobEvent.completed(
        job.id,
        job.export_type,
        totalDurationMs,
        output.length,
        signedUrl
      )

      // Step 9: Send completion notification email (skip for demo jobs)
      if (job.user_id) {
        const menuName = job.metadata.menu_name || 'Your Menu'
        await notificationService.sendExportCompletionEmail(
          job.user_id,
          signedUrl,
          menuName,
          job.export_type
        )
        logInfo('Sent completion email', { job_id: job.id })
      }
    } catch (error) {
      logError('Job processing failed', error as Error, { job_id: job.id })
      await this.handleError(job, error as Error)
    }
  }

  /**
   * Process a single menu extraction job
   */
  async processExtraction(job: ExtractionJob): Promise<void> {
    const startTime = Date.now()
    logInfo('Processing extraction job', { job_id: job.id })

    try {
      const openaiApiKey = process.env.OPENAI_API_KEY
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured in worker')
      }

      // NOTE: The image_url may be a local Supabase URL like http://localhost:54321/...
      // When running inside Docker, localhost points to the container, not the host.
      // Rewrite to host.docker.internal so the worker can fetch the image for preprocessing.
      const imageUrlForWorker = rewriteLocalhostUrlForDocker(job.image_url)

      // Create extraction service with worker's Supabase client
      // IMPORTANT: Workers must not use Next.js cookie-based clients.
      // Use the direct worker client (service role) instead.
      const supabase = createWorkerSupabaseClient()
      const extractionService = createMenuExtractionService(openaiApiKey, supabase)

      // Build prompt package based on schema version
      const useStage2 = job.schema_version === 'stage2'
      const promptPackage = useStage2
        ? getPromptPackageV2({
            currencyOverride: (job as any).currency,
            includeExamples: true,
          })
        : getPromptPackage({
            currencyOverride: (job as any).currency,
            includeExamples: true,
          })

      // Run the extraction
      // Note: extractionService handles its own vision-LLM calls and validation
      const result = await (extractionService as any).processWithVisionLLM(
        imageUrlForWorker,
        promptPackage,
        {
          schemaVersion: job.schema_version,
          promptVersion: job.prompt_version,
          menuId: job.menu_id || undefined
        }
      )

      const processingTime = Date.now() - startTime
      const tokenUsage = (extractionService as any).calculateTokenUsage(result.usage)

      // Update job to completed
      await updateExtractionJobToCompleted(
        job.id,
        result.extractionResult,
        processingTime,
        tokenUsage,
        (result as any).confidence,
        (result as any).uncertainItems,
        (result as any).superfluousText
      )

      logInfo('Extraction job completed', {
        job_id: job.id,
        duration_ms: processingTime,
        tokens: tokenUsage.totalTokens
      })
    } catch (error) {
      logError('Extraction job failed', error as Error, { job_id: job.id })
      await updateExtractionJobToFailed(job.id, (error as Error).message)
    }
  }

  /**
   * Render output based on export type
   * 
   * @param job - The export job
   * @param snapshot - The render snapshot with frozen menu state
   * @returns Rendered output buffer
   * 
   * Requirements: 2.4
   */
  private async render(
    job: ExportJob,
    snapshot: RenderSnapshot,
    supabasePublicUrl: string,
    supabaseInternalUrl: string
  ): Promise<Buffer> {
    // Check if this is a V2 template
    const isV2 = snapshot.snapshot_version === '2.0' || 
                 snapshot.template_id.includes('v2') || 
                 snapshot.configuration !== undefined

    if (isV2 && job.export_type === 'pdf') {
      logInfo('Using V2 Layout Engine for PDF export', { job_id: job.id })
      
      // 0. Translate public URLs to internal Docker URLs for image fetching inside Docker.
      // Rewrites any localhost/127.0.0.1 (Supabase :54321, Next app :3000 for demo images) to host.docker.internal.
      const translateUrl = (url?: string) => {
        if (!url) return url
        return rewriteLocalhostUrlForDocker(url)
      }

      const translatedItems = snapshot.menu_data.items.map(item => ({
        ...item,
        image_url: translateUrl(item.image_url)
      }))
      const translatedLogoUrl = translateUrl(snapshot.menu_data.logo_url)

      // Footer rendering in V2 relies on menu.metadata.venueInfo (not venueAddress).
      // The snapshot may contain either a full venue_info object or legacy establishment_* fields.
      const venueInfoFromSnapshot = (snapshot.menu_data as any).venue_info || (snapshot.menu_data as any).venueInfo
      const venueInfo =
        venueInfoFromSnapshot ??
        {
          address: snapshot.menu_data.establishment_address,
          phone: snapshot.menu_data.establishment_phone,
        }

      // 1. Transform snapshot to EngineMenuV2
      const engineMenu: EngineMenuV2 = {
        id: snapshot.menu_data.id,
        name: snapshot.menu_data.name,
        sections: this.transformToSections(translatedItems),
        metadata: {
          currency: snapshot.menu_data.items[0]?.currency || 'SGD',
          venueName: snapshot.menu_data.establishment_name,
          venueAddress: snapshot.menu_data.establishment_address,
          logoUrl: translatedLogoUrl,
          venueInfo:
            venueInfo && (venueInfo.address || venueInfo.phone || venueInfo.email || venueInfo.socialMedia)
              ? venueInfo
              : undefined,
        }
      }

      // 2. Generate V2 Layout
      const config = snapshot.configuration as any
      const layoutDocument = await generateLayoutV2({
        menu: engineMenu,
        templateId: snapshot.template_id,
        selection: {
          colourPaletteId: config?.palette?.id || config?.colourPaletteId,
          texturesEnabled: config?.texturesEnabled !== false,
          textOnly: config?.textOnly || false,
          showMenuTitle: config?.showMenuTitle || false,
        }
      })

      // 3. Optimize images (convert to base64 for PDF embedding)
      logInfo('Optimizing images for PDF embedding', { job_id: job.id })
      const optimizedLayout = await optimizeLayoutDocumentImages(layoutDocument, {
        maxWidth: 1000,
        quality: 75
      })

      // 4. Render to PDF
      logInfo('Rendering optimized layout to PDF', { job_id: job.id })
      const result = await renderToPdf(optimizedLayout, {
        paletteId: config?.palette?.id || config?.colourPaletteId,
        texturesEnabled: config?.texturesEnabled !== false,
      })

      return Buffer.from(result.pdfBytes)
    }

    // Fallback to legacy rendering
    const html = this.generateHTMLFromSnapshot(snapshot)

    // Render based on export type
    if (job.export_type === 'pdf') {
      const pdfOptions = this.getPDFOptions(snapshot)
      return await this.renderer.renderPDF(html, pdfOptions)
    } else if (job.export_type === 'image') {
      const imageOptions = this.getImageOptions(snapshot)
      return await this.renderer.renderImage(html, imageOptions)
    } else {
      throw new Error(`Unsupported export type: ${job.export_type}`)
    }
  }

  /**
   * Transforms flat snapshot items into EngineSectionV2 structure
   */
  private transformToSections(items: any[]): any[] {
    const sectionsMap = new Map<string, any>()
    
    items.forEach((item, index) => {
      const categoryName = item.category || 'General'
      if (!sectionsMap.has(categoryName)) {
        sectionsMap.set(categoryName, {
          id: `section-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
          name: categoryName,
          sortOrder: sectionsMap.size,
          items: []
        })
      }
      
      sectionsMap.get(categoryName).items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.image_url,
        sortOrder: item.display_order ?? index,
        indicators: item.indicators || {
          dietary: [],
          spiceLevel: null,
          allergens: []
        }
      })
    })
    
    return Array.from(sectionsMap.values())
  }

  /**
   * Generate HTML from render snapshot
   * 
   * This is a placeholder that should be replaced with actual template rendering.
   * In production, this would call the template system to render the menu.
   * 
   * @param snapshot - The render snapshot
   * @returns HTML string
   */
  private generateHTMLFromSnapshot(snapshot: RenderSnapshot): string {
    // TODO: Replace with actual template rendering
    // This should call the template system with the snapshot data
    
    const menuData = snapshot.menu_data
    const items = menuData.items || []
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${menuData.name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              color: #333;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .menu-item {
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #ddd;
              border-radius: 5px;
            }
            .item-name {
              font-size: 18px;
              font-weight: bold;
              color: #333;
            }
            .item-description {
              color: #666;
              margin: 5px 0;
            }
            .item-price {
              color: #2c5f2d;
              font-weight: bold;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <h1>${menuData.name}</h1>
          ${menuData.description ? `<p>${menuData.description}</p>` : ''}
          
          ${items.map(item => `
            <div class="menu-item">
              <div class="item-name">${item.name}</div>
              ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
              ${item.price ? `<div class="item-price">$${item.price}</div>` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `
  }

  /**
   * Get PDF rendering options from snapshot
   * 
   * @param snapshot - The render snapshot
   * @returns PDF rendering options
   */
  private getPDFOptions(snapshot: RenderSnapshot): PDFOptions {
    const exportOptions = snapshot.export_options || {}
    
    return {
      format: exportOptions.format || 'A4',
      orientation: exportOptions.orientation || 'portrait',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm',
      },
    }
  }

  /**
   * Get image rendering options from snapshot
   * 
   * @param snapshot - The render snapshot
   * @returns Image rendering options
   */
  private getImageOptions(snapshot: RenderSnapshot): ImageOptions {
    return {
      type: 'png',
      fullPage: true,
      omitBackground: false,
    }
  }

  /**
   * Get content type for storage upload
   * 
   * @param exportType - The export type
   * @returns MIME content type
   */
  private getContentType(exportType: 'pdf' | 'image'): string {
    switch (exportType) {
      case 'pdf':
        return 'application/pdf'
      case 'image':
        return 'image/png'
      default:
        throw new Error(`Unknown export type: ${exportType}`)
    }
  }

  /**
   * Handle job processing errors
   * 
   * Classifies errors and determines retry strategy:
   * - Transient errors: retry with exponential backoff
   * - Permanent errors: fail immediately
   * - Resource errors: retry with backoff
   * - Validation errors: fail immediately
   * 
   * @param job - The failed job
   * @param error - The error that occurred
   * 
   * Requirements: 2.10, 6.1, 6.2
   */
  private async handleError(job: ExportJob, error: Error): Promise<void> {
    // Determine retry strategy
    const retryDecision = handleJobFailure(error, job.retry_count)

    logJobEvent.failed(
      job.id,
      job.export_type,
      retryDecision.error_classification.category,
      retryDecision.error_classification.internal_message,
      job.retry_count,
      retryDecision.should_retry
    )

    if (retryDecision.should_retry) {
      // Retry with exponential backoff
      // Property 33: Do NOT send email notifications for transient failures
      logJobEvent.retrying(
        job.id,
        job.retry_count + 1,
        retryDecision.retry_delay_seconds * 1000
      )
      
      // Record retry metric
      recordJobRetried(job.export_type, job.retry_count + 1)

      await resetJobToPendingWithBackoff(
        job.id,
        retryDecision.retry_delay_seconds,
        retryDecision.error_classification.internal_message
      )
    } else {
      // Terminal failure
      logJobEvent.terminalFailure(
        job.id,
        job.export_type,
        retryDecision.error_classification.user_message,
        job.retry_count
      )
      
      // Record failure metric
      recordJobFailed(
        job.export_type,
        retryDecision.error_classification.category
      )

      await updateJobToFailed(
        job.id,
        retryDecision.error_classification.user_message
      )

      // Send failure notification email for terminal failures only
      // Property 33: Only send emails for terminal states (failed after all retries)
      // Property 34: Include menu name and export type in email
      const menuName = job.metadata.menu_name || 'Your Menu'
      await notificationService.sendExportFailureEmail(
        job.user_id,
        menuName,
        job.export_type,
        retryDecision.error_classification.user_message
      )
      logInfo('Sent failure email', { job_id: job.id })
    }
  }

  /**
   * Shutdown the processor and cleanup resources
   */
  async shutdown(): Promise<void> {
    logInfo('JobProcessor shutting down')
    await this.renderer.shutdown()
    logInfo('JobProcessor shutdown complete')
  }
}

function buildFriendlyExportFilename(job: ExportJob): string | undefined {
  const menuName = job.metadata?.menu_name
  const restaurantName = (job.metadata as any)?.restaurant_name

  const baseParts = [restaurantName, menuName].filter(Boolean).map(String)
  const base = baseParts.join(' - ').trim()
  if (!base) return undefined

  const safe = slugifyForFilename(base).slice(0, 140)
  const ext = job.export_type === 'image' ? 'png' : 'pdf'
  return `${safe}.${ext}`
}

function slugifyForFilename(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'export'
}

function rewriteLocalhostUrlForDocker(inputUrl: string): string {
  try {
    const url = new URL(inputUrl)

    // Only rewrite true localhost-style URLs.
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return inputUrl
    }

    // In Docker Desktop, host.docker.internal is the host gateway (works with --add-host on Linux too).
    url.hostname = process.env.WORKER_HOST_GATEWAY || 'host.docker.internal'
    return url.toString()
  } catch {
    return inputUrl
  }
}
