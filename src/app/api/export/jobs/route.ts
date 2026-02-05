/**
 * API Routes for Export Jobs
 * 
 * GET /api/export/jobs - List user's export job history with pagination
 * POST /api/export/jobs - Create a new export job
 * 
 * Requirements: Technical Requirements - API Integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations, menuOperations, assertUserCanEditMenu, DatabaseError } from '@/lib/database'
import { createRenderSnapshot, SnapshotCreationError } from '@/lib/worker/snapshot'
import type { ExportJobMetadata } from '@/types'

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
  FREE_HOURLY: 10,
  SUBSCRIBER_HOURLY: 50,
  FREE_PENDING: 5,
  SUBSCRIBER_PENDING: 20,
} as const

/**
 * Plans that are considered subscribers (get higher limits)
 */
const SUBSCRIBER_PLANS = ['grid_plus', 'grid_plus_premium', 'premium', 'enterprise']

/**
 * Request body schema
 */
interface CreateExportJobRequest {
  menu_id: string
  export_type: 'pdf' | 'image'
  template_id?: string
  configuration?: any
  metadata?: {
    format?: 'A4' | 'Letter'
    orientation?: 'portrait' | 'landscape'
  }
}

/**
 * Response schema
 */
interface CreateExportJobResponse {
  job_id: string
  status: 'pending'
  created_at: string
  estimated_wait_seconds?: number
}

/**
 * Error response schema
 */
interface ErrorResponse {
  error: string
  code?: string
  details?: Record<string, any>
}

/**
 * Validates export_type parameter
 */
function validateExportType(exportType: any): exportType is 'pdf' | 'image' {
  return exportType === 'pdf' || exportType === 'image'
}

/**
 * Validates menu_id parameter (basic UUID format check)
 */
function validateMenuId(menuId: any): menuId is string {
  if (typeof menuId !== 'string') return false
  
  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(menuId)
}

/**
 * Checks rate limits atomically using database queries
 * 
 * This prevents race conditions where concurrent requests could exceed limits.
 * The atomic nature comes from the database's MVCC and the fact that we check
 * limits immediately before insertion in the same request context.
 * 
 * Note: For true atomicity across concurrent requests, we rely on the database's
 * transaction isolation. The small window between check and insert is acceptable
 * given the soft nature of rate limits (brief overages are tolerable).
 */
async function checkRateLimitsAtomic(
  userId: string,
  isSubscriber: boolean,
  supabase: any
): Promise<{ allowed: boolean; error?: string; code?: string }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    // Check hourly rate limit
    const { count: hourlyCount, error: hourlyError } = await supabase
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo)
    
    if (hourlyError) {
      throw new Error(`Failed to check hourly rate limit: ${hourlyError.message}`)
    }
    
    const hourlyLimit = isSubscriber ? RATE_LIMITS.SUBSCRIBER_HOURLY : RATE_LIMITS.FREE_HOURLY
    
    if ((hourlyCount || 0) >= hourlyLimit) {
      return {
        allowed: false,
        error: `Rate limit exceeded. You can create ${hourlyLimit} exports per hour.`,
        code: 'RATE_LIMIT_EXCEEDED'
      }
    }
    
    // Check pending job limit
    const { count: pendingCount, error: pendingError } = await supabase
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
    
    if (pendingError) {
      throw new Error(`Failed to check pending job limit: ${pendingError.message}`)
    }
    
    const pendingLimit = isSubscriber ? RATE_LIMITS.SUBSCRIBER_PENDING : RATE_LIMITS.FREE_PENDING
    
    if ((pendingCount || 0) >= pendingLimit) {
      return {
        allowed: false,
        error: `Pending job limit exceeded. You can have ${pendingLimit} pending exports at a time.`,
        code: 'PENDING_LIMIT_EXCEEDED'
      }
    }
    
    return { allowed: true }
  } catch (error) {
    console.error('[API] Rate limit check error:', error)
    return {
      allowed: false,
      error: 'Failed to check rate limits',
      code: 'RATE_LIMIT_CHECK_FAILED'
    }
  }
}

/**
 * Estimates wait time based on queue depth (best-effort, not guaranteed)
 */
async function estimateWaitTime(supabase: any): Promise<number | undefined> {
  try {
    // Get queue depth (pending jobs that are available now)
    const { count, error } = await supabase
      .from('export_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('available_at', new Date().toISOString())
    
    if (error || count === null) {
      return undefined
    }
    
    // Rough estimate: assume 30 seconds per job, 3 concurrent workers
    // This is a best-effort estimate, not a guarantee
    const estimatedSeconds = Math.ceil((count / 3) * 30)
    
    return estimatedSeconds
  } catch (error) {
    console.error('[API] Failed to estimate wait time:', error)
    return undefined
  }
}

/**
 * GET /api/export/jobs
 * 
 * List user's export job history with pagination.
 * 
 * Query Parameters:
 * - limit: Number of jobs to return (default 20, max 100)
 * - offset: Number of jobs to skip (default 0)
 * - status: Filter by job status (optional)
 * 
 * Requirements: Technical Requirements - API Integration
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Unauthorized. Please sign in.',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }
    
    const userId = user.id
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const statusParam = searchParams.get('status')
    
    // Validate and parse limit (default 20, max 100)
    let limit = 20
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json<ErrorResponse>(
          {
            error: 'Invalid limit parameter. Must be a positive integer.',
            code: 'INVALID_LIMIT'
          },
          { status: 400 }
        )
      }
      limit = Math.min(parsedLimit, 100) // Cap at 100
    }
    
    // Validate and parse offset (default 0)
    let offset = 0
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10)
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return NextResponse.json<ErrorResponse>(
          {
            error: 'Invalid offset parameter. Must be a non-negative integer.',
            code: 'INVALID_OFFSET'
          },
          { status: 400 }
        )
      }
      offset = parsedOffset
    }
    
    // Validate status parameter if provided
    if (statusParam && !['pending', 'processing', 'completed', 'failed'].includes(statusParam)) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Invalid status parameter. Must be one of: pending, processing, completed, failed.',
          code: 'INVALID_STATUS'
        },
        { status: 400 }
      )
    }
    
    // Build query
    let query = supabase
      .from('export_jobs')
      .select('id, status, export_type, menu_id, created_at, completed_at, file_url', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply status filter if provided
    if (statusParam) {
      query = query.eq('status', statusParam)
    }
    
    // Execute query
    const { data: jobs, error: queryError, count } = await query
    
    if (queryError) {
      console.error('[API] Failed to query export jobs:', queryError)
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Failed to retrieve export jobs',
          code: 'QUERY_FAILED',
          details: { message: queryError.message }
        },
        { status: 500 }
      )
    }
    
    // Format response
    const response = {
      jobs: (jobs || []).map(job => ({
        job_id: job.id,
        status: job.status,
        export_type: job.export_type,
        menu_id: job.menu_id,
        created_at: job.created_at,
        ...(job.completed_at && { completed_at: job.completed_at }),
        ...(job.file_url && { file_url: job.file_url })
      })),
      total: count || 0,
      limit,
      offset
    }
    
    return NextResponse.json(response, { status: 200 })
    
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/export/jobs:', error)
    
    return NextResponse.json<ErrorResponse>(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/export/jobs
 * 
 * Creates a new export job
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: CreateExportJobRequest = await request.json()
    
    // Validate export_type
    if (!validateExportType(body.export_type)) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Invalid export_type. Must be "pdf" or "image".',
          code: 'INVALID_EXPORT_TYPE'
        },
        { status: 400 }
      )
    }
    
    // Validate menu_id
    if (!validateMenuId(body.menu_id)) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Invalid menu_id. Must be a valid UUID.',
          code: 'INVALID_MENU_ID'
        },
        { status: 400 }
      )
    }
    
    // Get authenticated user from Supabase
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Unauthorized. Please sign in.',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }
    
    const userId = user.id
    
    // Check if user owns the menu
    const menu = await menuOperations.getMenu(body.menu_id, userId)
    
    if (!menu) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Menu not found or you do not have permission to export it.',
          code: 'MENU_NOT_FOUND'
        },
        { status: 403 }
      )
    }
    
    // Get user profile to determine subscription status
    const profile = await userOperations.getProfile(userId)
    
    if (!profile) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'User profile not found.',
          code: 'PROFILE_NOT_FOUND'
        },
        { status: 500 }
      )
    }

    // If edits are locked, exporting is locked too (view-only mode)
    try {
      await assertUserCanEditMenu({
        userId,
        menuCreatedAt: menu.createdAt,
        profile,
        supabaseClient: supabase,
      })
    } catch (e) {
      if (e instanceof DatabaseError && e.code === 'EDIT_WINDOW_EXPIRED') {
        return NextResponse.json<ErrorResponse>(
          { error: e.message, code: e.code },
          { status: 403 }
        )
      }
      throw e
    }
    
    const isSubscriber = SUBSCRIBER_PLANS.includes(profile.plan) || profile.role === 'admin'
    
    // Check rate limits atomically
    const rateLimitCheck = await checkRateLimitsAtomic(userId, isSubscriber, supabase)
    
    if (!rateLimitCheck.allowed) {
      const statusCode = rateLimitCheck.code === 'RATE_LIMIT_EXCEEDED' ? 429 : 422
      
      return NextResponse.json<ErrorResponse>(
        {
          error: rateLimitCheck.error || 'Rate limit check failed',
          code: rateLimitCheck.code
        },
        { status: statusCode }
      )
    }
    
    // Create render snapshot
    let snapshot
    try {
      snapshot = await createRenderSnapshot(
        body.menu_id,
        body.template_id || 'elegant-dark',
        {
          template_id: body.template_id || 'elegant-dark',
          configuration: body.configuration,
          format: body.metadata?.format || 'A4',
          orientation: body.metadata?.orientation || 'portrait',
          include_images: true,
          include_prices: true
        }
      )
    } catch (error) {
      if (error instanceof SnapshotCreationError) {
        console.error('[API] Snapshot creation failed:', error.code, error.details)
        return NextResponse.json<ErrorResponse>(
          {
            error: error.message,
            code: error.code,
            details: error.details
          },
          { status: 400 }
        )
      }
      throw error
    }
    
    // Determine priority based on subscription
    const priority = isSubscriber ? 100 : 10
    
    // Fetch restaurant name for friendlier filenames in downloads/emails (best-effort)
    let restaurantName: string | undefined = undefined
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('restaurant_name')
        .eq('id', userId)
        .single()
      restaurantName = profile?.restaurant_name || undefined
    } catch {
      // best-effort
    }

    // Create export job metadata
    const metadata: ExportJobMetadata = {
      format: body.metadata?.format || 'A4',
      orientation: body.metadata?.orientation || 'portrait',
      menu_name: menu.name,
      restaurant_name: restaurantName,
      render_snapshot: snapshot
    }
    
    // Create export job record
    const { data: job, error: createError } = await supabase
      .from('export_jobs')
      .insert({
        user_id: userId,
        menu_id: body.menu_id,
        export_type: body.export_type,
        status: 'pending',
        priority,
        retry_count: 0,
        available_at: new Date().toISOString(),
        metadata
      })
      .select()
      .single()
    
    if (createError) {
      console.error('[API] Failed to create export job:', createError)
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Failed to create export job',
          code: 'JOB_CREATION_FAILED',
          details: { message: createError.message }
        },
        { status: 500 }
      )
    }
    
    // Estimate wait time (best-effort)
    const estimatedWaitSeconds = await estimateWaitTime(supabase)
    
    // Return success response
    const response: CreateExportJobResponse = {
      job_id: job.id,
      status: 'pending',
      created_at: job.created_at,
      ...(estimatedWaitSeconds !== undefined && { estimated_wait_seconds: estimatedWaitSeconds })
    }
    
    return NextResponse.json(response, { status: 201 })
    
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/export/jobs:', error)
    
    return NextResponse.json<ErrorResponse>(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: {
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}
