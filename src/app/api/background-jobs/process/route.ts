import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBackgroundGenerator } from '@/lib/templates/background-generator'
import { quotaOperations } from '@/lib/quota-management'

/**
 * POST /api/background-jobs/process
 * 
 * Process queued background generation jobs.
 * This endpoint should be called by a cron job or background worker.
 * 
 * For security, this endpoint should be protected by an API key or internal auth.
 */
export async function POST(request: NextRequest) {
  console.log('🔄 [Background Jobs] Processing queued jobs...')

  try {
    // Simple API key auth for internal processing
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.BACKGROUND_PROCESSOR_API_KEY || process.env.CRON_SECRET
    
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServerSupabaseClient()
    
    // Get queued jobs (limit to 5 at a time to avoid overwhelming the system)
    const { data: queuedJobs, error: queryError } = await supabase
      .from('background_generation_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(5)
    
    if (queryError) {
      console.error('❌ [Background Jobs] Failed to query jobs:', queryError)
      return NextResponse.json(
        { error: 'Failed to query jobs' },
        { status: 500 }
      )
    }
    
    if (!queuedJobs || queuedJobs.length === 0) {
      console.log('✅ [Background Jobs] No queued jobs to process')
      return NextResponse.json({
        success: true,
        data: {
          processed: 0,
          message: 'No queued jobs'
        }
      })
    }
    
    console.log(`📋 [Background Jobs] Found ${queuedJobs.length} queued jobs`)
    
    const results = []
    
    // Process each job
    for (const jobData of queuedJobs) {
      try {
        console.log(`🎨 [Background Jobs] Processing job ${jobData.id}...`)
        
        const backgroundGenerator = createBackgroundGenerator(supabase)
        
        // Generate background
        const result = await backgroundGenerator.generateBackground(
          {
            userId: jobData.user_id,
            menuId: jobData.menu_id,
            templateId: jobData.template_id,
            referenceImage: jobData.template_id,
            brandColors: jobData.brand_colors ? JSON.parse(jobData.brand_colors) : undefined
          },
          jobData.id
        )
        
        // Update menu with background URL
        await supabase
          .from('menus')
          .update({ background_url: result.url })
          .eq('id', jobData.menu_id)
        
        // Consume quota
        await quotaOperations.consumeQuota(jobData.user_id, 1)
        
        // Mark quota as consumed
        await supabase
          .from('background_generation_jobs')
          .update({ quota_consumed: true })
          .eq('id', jobData.id)
        
        console.log(`✅ [Background Jobs] Job ${jobData.id} completed in ${result.generationTime}ms`)
        
        results.push({
          jobId: jobData.id,
          status: 'success',
          generationTime: result.generationTime
        })
        
      } catch (error) {
        console.error(`❌ [Background Jobs] Job ${jobData.id} failed:`, error)
        
        results.push({
          jobId: jobData.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length
    const failedCount = results.filter(r => r.status === 'failed').length
    
    console.log(`✅ [Background Jobs] Processed ${results.length} jobs: ${successCount} succeeded, ${failedCount} failed`)
    
    return NextResponse.json({
      success: true,
      data: {
        processed: results.length,
        succeeded: successCount,
        failed: failedCount,
        results
      }
    })
    
  } catch (error) {
    console.error('❌ [Background Jobs] Error processing jobs:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
