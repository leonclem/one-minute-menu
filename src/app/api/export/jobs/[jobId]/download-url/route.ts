/**
 * POST /api/export/jobs/:jobId/download-url
 * 
 * Regenerate signed download URL for completed job (when original URL expires).
 * 
 * This endpoint:
 * - Validates authentication
 * - Verifies user owns the job
 * - Verifies job status is completed
 * - Generates new signed URL with 7-day expiry and Content-Disposition header
 * - Returns new URL and expiry timestamp
 * 
 * Requirements: 9.5
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { StorageClient, generateStoragePath } from '@/lib/worker/storage-client'

/**
 * Response schema for successful URL regeneration
 */
interface RegenerateUrlResponse {
  file_url: string
  expires_at: string
}

/**
 * Error response schema
 */
interface ErrorResponse {
  error: string
  code?: string
}

/**
 * POST /api/export/jobs/:jobId/download-url
 * 
 * Regenerates a signed download URL for a completed export job
 */
export async function POST(
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
    
    // Verify job is completed
    if (job.status !== 'completed') {
      return NextResponse.json<ErrorResponse>(
        {
          error: `Cannot generate download URL for job with status '${job.status}'. Job must be completed.`,
          code: 'JOB_NOT_COMPLETED'
        },
        { status: 409 }
      )
    }
    
    // Verify storage_path exists
    if (!job.storage_path) {
      return NextResponse.json<ErrorResponse>(
        {
          error: 'Job does not have a storage path. File may not have been uploaded.',
          code: 'STORAGE_PATH_MISSING'
        },
        { status: 500 }
      )
    }
    
    // Initialize storage client
    const storageClient = new StorageClient({
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      storage_bucket: process.env.EXPORT_STORAGE_BUCKET || 'export-files'
    })
    
    // Generate new signed URL with 7-day expiry
    const expiresInSeconds = 604800 // 7 days
    const newSignedUrl = await storageClient.generateSignedUrl(
      job.storage_path,
      expiresInSeconds
    )
    
    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    
    // Build response
    const response: RegenerateUrlResponse = {
      file_url: newSignedUrl,
      expires_at: expiresAt
    }
    
    return NextResponse.json(response, { status: 200 })
    
  } catch (error) {
    console.error('[API] Unexpected error in POST /api/export/jobs/:jobId/download-url:', error)
    
    return NextResponse.json<ErrorResponse>(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
