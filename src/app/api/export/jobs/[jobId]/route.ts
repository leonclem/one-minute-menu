/**
 * GET /api/export/jobs/:jobId
 * 
 * Query status of a specific export job.
 * 
 * This endpoint:
 * - Validates authentication
 * - Verifies user owns the job
 * - Returns job status, file_url, timestamps, error_message
 * - Returns 404 if job not found
 * - Returns 403 if user doesn't own job
 * 
 * Requirements: Technical Requirements - API Integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Response schema for successful job query
 */
interface GetJobResponse {
  job_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  export_type: 'pdf' | 'image'
  menu_id: string
  priority: number
  retry_count: number
  error_message?: string
  file_url?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

/**
 * Error response schema
 */
interface ErrorResponse {
  error: string
  code?: string
}

/**
 * GET /api/export/jobs/:jobId
 * 
 * Retrieves the status and details of a specific export job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params
    
    // Validate jobId format (basic UUID check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(jobId)) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Invalid job ID format. Must be a valid UUID.',
          code: 'INVALID_JOB_ID'
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
    
    // Query the export job
    const { data: job, error: queryError } = await supabase
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    // Handle job not found
    if (queryError || !job) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Job not found.',
          code: 'JOB_NOT_FOUND'
        },
        { status: 404 }
      )
    }
    
    // Verify user owns the job
    if (job.user_id !== userId) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'You do not have permission to access this job.',
          code: 'FORBIDDEN'
        },
        { status: 403 }
      )
    }
    
    // Build response
    const response: GetJobResponse = {
      job_id: job.id,
      status: job.status,
      export_type: job.export_type,
      menu_id: job.menu_id,
      priority: job.priority,
      retry_count: job.retry_count,
      created_at: job.created_at,
      ...(job.error_message && { error_message: job.error_message }),
      ...(job.file_url && { file_url: job.file_url }),
      ...(job.started_at && { started_at: job.started_at }),
      ...(job.completed_at && { completed_at: job.completed_at })
    }
    
    return NextResponse.json(response, { status: 200 })
    
  } catch (error) {
    console.error('[API] Unexpected error in GET /api/export/jobs/:jobId:', error)
    
    return NextResponse.json<ErrorResponse>(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
