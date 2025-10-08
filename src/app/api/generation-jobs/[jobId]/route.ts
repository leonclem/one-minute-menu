import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createGenerationError, NanoBananaError } from '@/lib/nano-banana'
import type { ImageGenerationJob, GeneratedImage } from '@/types'

// GET /api/generation-jobs/[jobId] - Get job status and results
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
    const { data: job, error: jobError } = await supabase
      .from('image_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()
    
    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    
    // Get generated images if job is completed
    let images: GeneratedImage[] = []
    if (job.status === 'completed') {
      const { data: imageData, error: imageError } = await supabase
        .from('ai_generated_images')
        .select('*')
        .eq('generation_job_id', jobId)
        .order('created_at', { ascending: true })
      
      if (!imageError && imageData) {
        images = imageData.map(img => ({
          id: img.id,
          menuItemId: img.menu_item_id,
          generationJobId: img.generation_job_id,
          originalUrl: img.original_url,
          thumbnailUrl: img.thumbnail_url,
          mobileUrl: img.mobile_url,
          desktopUrl: img.desktop_url,
          webpUrl: img.webp_url,
          prompt: img.prompt,
          negativePrompt: img.negative_prompt,
          aspectRatio: img.aspect_ratio,
          width: img.width,
          height: img.height,
          fileSize: img.file_size,
          selected: img.selected,
          metadata: img.metadata,
          createdAt: new Date(img.created_at)
        }))
      }
    }
    
    // Transform job data
    const jobResponse: ImageGenerationJob = {
      id: job.id,
      userId: job.user_id,
      menuItemId: job.menu_item_id,
      status: job.status,
      prompt: job.prompt,
      negativePrompt: job.negative_prompt,
      apiParams: job.api_params,
      numberOfVariations: job.number_of_variations,
      resultCount: job.result_count || 0,
      errorMessage: job.error_message,
      errorCode: job.error_code,
      processingTime: job.processing_time,
      estimatedCost: job.estimated_cost,
      retryCount: job.retry_count,
      createdAt: new Date(job.created_at),
      startedAt: job.started_at ? new Date(job.started_at) : undefined,
      completedAt: job.completed_at ? new Date(job.completed_at) : undefined
    }
    
    // Add error suggestions if job failed
    let errorSuggestions: string[] = []
    if (job.status === 'failed' && job.error_code) {
      const mockError = new NanoBananaError(
        job.error_message || 'Unknown error',
        job.error_code
      )
      errorSuggestions = mockError.suggestions || []
    }
    
    return NextResponse.json({
      success: true,
      data: {
        job: jobResponse,
        images,
        errorSuggestions: errorSuggestions.length > 0 ? errorSuggestions : undefined
      }
    })
    
  } catch (error) {
    console.error('Error fetching generation job:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}