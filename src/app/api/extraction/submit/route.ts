/**
 * POST /api/extraction/submit
 * 
 * Submit a menu image for AI extraction
 * 
 * Requirements:
 * - 15.3: API routes for extraction submission
 * - 15.8: Rate limiting (10 uploads/hour per user)
 * - 12.2: Quota enforcement
 * - 12.3: Request validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'
import { PLAN_RUNTIME_LIMITS } from '@/types'
import { createMenuExtractionService, estimateExtractionCost } from '@/lib/extraction/menu-extraction-service'
import { JobQueueManager } from '@/lib/extraction/job-queue'
import { createMetricsCollector } from '@/lib/extraction/metrics-collector'
import { createCostMonitor } from '@/lib/extraction/cost-monitor'

// Supported image formats
const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 8 * 1024 * 1024 // 8MB

interface SubmitRequest {
  imageUrl: string
  schemaVersion?: 'stage1' | 'stage2'
  promptVersion?: string
  currency?: string
  language?: string
  force?: boolean
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Authentication check
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    let body: SubmitRequest
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Validate image URL format
    let imageUrl: URL
    try {
      imageUrl = new URL(body.imageUrl)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid imageUrl format' },
        { status: 400 }
      )
    }

    // Validate image format and size
    try {
      const imageValidation = await validateImage(body.imageUrl)
      if (!imageValidation.valid) {
        return NextResponse.json(
          { error: imageValidation.error },
          { status: 400 }
        )
      }
    } catch (error) {
      console.error('Error validating image:', error)
      return NextResponse.json(
        { error: 'Failed to validate image' },
        { status: 400 }
      )
    }

    // Check monthly quota
    const quotaCheck = await userOperations.checkPlanLimits(user.id, 'ocrJobs')
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: `Monthly extraction limit reached (${quotaCheck.current}/${quotaCheck.limit})`,
          code: 'QUOTA_EXCEEDED',
          upgrade: {
            cta: 'Upgrade to Premium',
            href: '/upgrade',
            reason: 'Increase extraction limit from 5 to 50 per month'
          }
        },
        { status: 403 }
      )
    }

    // Check rate limit (10 uploads/hour per user)
    const profile = await userOperations.getProfile(user.id)
    const plan = profile?.plan || 'free'
    const planRate = PLAN_RUNTIME_LIMITS[plan]?.ocrRatePerHour ?? 10
    const rateLimitPerHour = Number.parseInt(
      process.env.EXTRACTION_RATE_LIMIT_PER_HOUR || String(planRate),
      10
    )

    const queueManager = new JobQueueManager(supabase)
    const rateLimitCheck = await queueManager.checkRateLimit(user.id, rateLimitPerHour)
    
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded (${rateLimitCheck.current}/${rateLimitCheck.limit} uploads/hour)`,
          code: 'RATE_LIMIT_EXCEEDED',
          resetAt: rateLimitCheck.resetAt?.toISOString()
        },
        { status: 429 }
      )
    }

    // Check cost budget (Requirements: 8.3, 12.1, 12.4)
    const metricsCollector = createMetricsCollector(supabase)
    const costMonitor = createCostMonitor(supabase, metricsCollector)
    
    const estimatedCost = estimateExtractionCost(0, true) // Estimate with examples
    const costCheck = await costMonitor.canPerformExtraction(user.id, estimatedCost)
    
    if (!costCheck.allowed) {
      return NextResponse.json(
        {
          error: costCheck.reason || 'Cost budget exceeded',
          code: 'COST_BUDGET_EXCEEDED',
          currentSpending: costCheck.currentSpending,
          remainingBudget: costCheck.remainingBudget
        },
        { status: 403 }
      )
    }

    // Process any cost alerts
    if (costCheck.alerts.length > 0) {
      await costMonitor.processAlerts(costCheck.alerts)
    }

    // Get OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured')
      return NextResponse.json(
        { error: 'Extraction service not configured' },
        { status: 500 }
      )
    }

    // Create extraction service
    const extractionService = createMenuExtractionService(openaiApiKey, supabase)

    // Submit extraction job
    const job = await extractionService.submitExtractionJob(
      body.imageUrl,
      user.id,
      {
        schemaVersion: body.schemaVersion || 'stage1',
        promptVersion: body.promptVersion,
        currency: body.currency,
        language: body.language
      }
    )

    // Calculate estimated completion time
    // Average processing time is ~10-15 seconds
    const estimatedCompletionTime = new Date(Date.now() + 15000)

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        estimatedCompletionTime: estimatedCompletionTime.toISOString(),
        quotaRemaining: quotaCheck.limit - quotaCheck.current - 1,
        processingTime: Date.now() - startTime
      }
    })

  } catch (error) {
    console.error('Error submitting extraction job:', error)
    
    // Check if it's an OpenAI quota error
    if (error instanceof Error && error.message.includes('quota')) {
      return NextResponse.json(
        {
          error: 'AI service quota exceeded. Please try again later or contact support.',
          code: 'OPENAI_QUOTA_EXCEEDED',
          userMessage: 'The AI extraction service is temporarily unavailable due to quota limits. You can add menu items manually or try again later.'
        },
        { status: 503 }
      )
    }
    
    // Check if it's a rate limit error
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('rate limit'))) {
      return NextResponse.json(
        {
          error: 'AI service rate limit exceeded. Please try again in a few minutes.',
          code: 'OPENAI_RATE_LIMIT',
          userMessage: 'Too many extraction requests. Please wait a few minutes and try again.'
        },
        { status: 429 }
      )
    }
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'EXTRACTION_FAILED',
        userMessage: 'Extraction failed. You can add menu items manually.'
      },
      { status: 500 }
    )
  }
}

/**
 * Validate image format and size
 */
async function validateImage(imageUrl: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Fetch image headers to check format and size
    const response = await fetch(imageUrl, { method: 'HEAD' })
    
    if (!response.ok) {
      return {
        valid: false,
        error: 'Failed to fetch image'
      }
    }

    // Check content type
    const contentType = response.headers.get('content-type')
    if (!contentType || !SUPPORTED_FORMATS.includes(contentType.toLowerCase())) {
      return {
        valid: false,
        error: `Unsupported image format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`
      }
    }

    // Check content length
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      if (size > MAX_IMAGE_SIZE) {
        return {
          valid: false,
          error: `Image too large. Maximum size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`
        }
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('Error validating image:', error)
    return {
      valid: false,
      error: 'Failed to validate image'
    }
  }
}
