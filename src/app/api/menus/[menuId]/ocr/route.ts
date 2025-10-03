import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, ocrOperations, userOperations, DatabaseError } from '@/lib/database'
import { PLAN_RUNTIME_LIMITS } from '@/types'
import { extractTextFromImage } from '@/lib/vision'

// POST /api/menus/[menuId]/ocr - Process OCR directly for the menu's image
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  const startTime = Date.now()
  
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const menu = await menuOperations.getMenu(params.menuId, user.id)
    if (!menu) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }
    if (!menu.imageUrl) {
      return NextResponse.json({ error: 'No image uploaded for this menu' }, { status: 400 })
    }

    // Enforce plan quota (monthly ocrJobs)
    const { allowed, current, limit } = await userOperations.checkPlanLimits(user.id, 'ocrJobs')
    if (!allowed) {
      return NextResponse.json(
        {
          error: `You have reached your monthly OCR limit (${current}/${limit}).`,
          code: 'PLAN_LIMIT_EXCEEDED',
          upgrade: {
            cta: 'Upgrade to Premium',
            href: '/upgrade',
            reason: 'Increase OCR limit from 5 to 50 per month',
          }
        },
        { status: 403 }
      )
    }

    // Enforce rate limit (configurable uploads/hour per user)
    const profile = await userOperations.getProfile(user.id)
    const plan = profile?.plan || 'free'
    const planRate = PLAN_RUNTIME_LIMITS[plan]?.ocrRatePerHour ?? 10
    const rateLimitPerHour = Number.parseInt(process.env.OCR_RATE_LIMIT_PER_HOUR || String(planRate), 10)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const rateRes = await supabase
      .from('ocr_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo.toISOString())
    const hourCount = rateRes.count || 0
    if (hourCount >= rateLimitPerHour) {
      return NextResponse.json({ error: `Rate limit exceeded (${rateLimitPerHour} uploads/hour). Please try again later.` }, { status: 429 })
    }

    // Accept optional force flag to reprocess
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === '1'

    // Check for existing completed job (unless force=1)
    if (!force) {
      const existingJob = await ocrOperations.findExistingJob(user.id, menu.imageUrl)
      if (existingJob && existingJob.status === 'completed' && existingJob.result) {
        return NextResponse.json({ 
          success: true, 
          data: existingJob,
          cached: true 
        })
      }
    }

    // Create OCR job record
    const job = await ocrOperations.enqueueJob(user.id, menu.imageUrl, { force })

    try {
      // Process OCR directly using Google Vision API
      const { text, confidence } = await extractTextFromImage(menu.imageUrl)
      
      const processingTime = Date.now() - startTime
      
      // Update job with results
      const completedJob = await ocrOperations.markCompleted(
        job.id, 
        text, 
        processingTime, 
        confidence
      )

      return NextResponse.json({ 
        success: true, 
        data: completedJob,
        processingTime 
      })
      
    } catch (ocrError) {
      // Mark job as failed
      await ocrOperations.markFailed(job.id, ocrError instanceof Error ? ocrError.message : 'OCR processing failed')
      
      return NextResponse.json({ 
        error: `OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
        code: 'OCR_FAILED'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error processing OCR:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

