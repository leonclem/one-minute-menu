import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBackgroundGenerator } from '@/lib/templates/background-generator'
import { quotaOperations } from '@/lib/quota-management'
import type { BackgroundJob } from '@/lib/templates/background-generator'

/**
 * GET /api/background-jobs/[jobId]
 * 
 * Poll the status of a background generation job.
 * When job completes, updates the menu record with the background URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { jobId } = params
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }
    
    // Get job details and verify ownership
    const { data: jobData, error: jobError } = await supabase
      .from('background_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()
    
    if (jobError || !jobData) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    // Map job data
    const job: BackgroundJob = {
      id: jobData.id,
      userId: jobData.user_id,
      menuId: jobData.menu_id,
      templateId: jobData.template_id,
      contentHash: jobData.content_hash,
      status: jobData.status,
      brandColors: jobData.brand_colors ? JSON.parse(jobData.brand_colors) : undefined,
      resultUrl: jobData.result_url,
      errorMessage: jobData.error_message,
      errorCode: jobData.error_code,
      createdAt: new Date(jobData.created_at),
      startedAt: jobData.started_at ? new Date(jobData.started_at) : undefined,
      completedAt: jobData.completed_at ? new Date(jobData.completed_at) : undefined,
      generationTime: jobData.generation_time
    }
    
    // If job is completed successfully, update menu with background URL
    if (job.status === 'ready' && job.resultUrl) {
      // Check if menu already has this background URL
      const { data: menu } = await supabase
        .from('menus')
        .select('background_url')
        .eq('id', job.menuId)
        .single()
      
      if (menu && menu.background_url !== job.resultUrl) {
        // Update menu with background URL
        await supabase
          .from('menus')
          .update({ background_url: job.resultUrl })
          .eq('id', job.menuId)
        
        // Consume quota (only if not already consumed)
        // Check if this is the first time we're marking this job as complete
        if (!jobData.quota_consumed) {
          await quotaOperations.consumeQuota(user.id, 1)
          
          // Mark quota as consumed in job record
          await supabase
            .from('background_generation_jobs')
            .update({ quota_consumed: true })
            .eq('id', jobId)
        }
        
        console.log('✅ [Background Job] Updated menu with background URL:', job.menuId)
      }
    }
    
    // Build response
    const response: any = {
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        templateId: job.templateId,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        generationTime: job.generationTime
      }
    }
    
    // Add result URL if ready
    if (job.status === 'ready' && job.resultUrl) {
      response.data.backgroundUrl = job.resultUrl
    }
    
    // Add error details if failed
    if (job.status === 'failed') {
      response.data.error = {
        message: job.errorMessage || 'Background generation failed',
        code: job.errorCode || 'GENERATION_FAILED'
      }
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error fetching background job:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
