/**
 * GET /api/extraction/status/[jobId]
 * 
 * Get the status and results of an extraction job
 * 
 * Requirements:
 * - 15.3: API routes for extraction status
 * - Authorization: Users can only access their own jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { JobQueueManager } from '@/lib/extraction/job-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    // Validate jobId parameter
    if (!params.jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      )
    }

    // Get job status
    const queueManager = new JobQueueManager(supabase)
    const job = await queueManager.getJobStatus(params.jobId, user.id)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Authorization check - ensure user owns this job
    if (job.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Return job status and results
    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        schemaVersion: job.schemaVersion,
        promptVersion: job.promptVersion,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        processingTime: job.processingTime,
        tokenUsage: job.tokenUsage,
        confidence: job.confidence,
        uncertainItems: job.uncertainItems,
        superfluousText: job.superfluousText
      }
    })

  } catch (error) {
    console.error('Error getting job status:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'STATUS_CHECK_FAILED'
      },
      { status: 500 }
    )
  }
}
