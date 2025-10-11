import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBackgroundGenerator } from '@/lib/templates/background-generator'
import { quotaOperations } from '@/lib/quota-management'
import { NanoBananaError } from '@/lib/nano-banana'

/**
 * POST /api/menus/[menuId]/generate-background
 * 
 * Queue a background generation job for a menu template.
 * Checks user quota and creates a job record that will be processed asynchronously.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  console.log('🎨 [Generate Background] API called for menu:', params.menuId)

  try {
    // Feature flag check
    const disabled = process.env.AI_BACKGROUND_GENERATION_DISABLED === 'true'
    const hasApiKey = !!process.env.NANO_BANANA_API_KEY
    
    if (disabled || !hasApiKey) {
      console.warn('🛑 [Generate Background] Disabled via flag or missing API key', {
        disabled,
        hasApiKey
      })
      return NextResponse.json(
        {
          error: 'Background generation is temporarily unavailable',
          code: 'FEATURE_DISABLED',
        },
        { status: 503 }
      )
    }

    const supabase = createServerSupabaseClient()
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ [Generate Background] Auth failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('✅ [Generate Background] User authenticated:', user.id)
    
    // Parse request body
    const body = await request.json() as {
      idempotencyKey?: string
      brandColors?: string[]
      brandImageUrl?: string
    }
    
    const { menuId } = params
    
    if (!menuId) {
      return NextResponse.json(
        { error: 'Menu ID is required' },
        { status: 400 }
      )
    }
    
    // Get menu and verify ownership
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .select('*')
      .eq('id', menuId)
      .eq('user_id', user.id)
      .single()
    
    if (menuError || !menu) {
      console.error('❌ [Generate Background] Menu not found:', menuError)
      return NextResponse.json(
        { error: 'Menu not found or unauthorized' },
        { status: 404 }
      )
    }
    
    // Check if menu has a template applied
    if (!menu.template_id) {
      return NextResponse.json(
        { error: 'Menu must have a template applied before generating background' },
        { status: 400 }
      )
    }
    
    // Check quota before proceeding
    const quotaStatus = await quotaOperations.checkQuota(user.id)
    
    if (quotaStatus.remaining < 1) {
      return NextResponse.json(
        {
          error: `You've used all ${quotaStatus.limit} generations this month. Upgrade to continue.`,
          code: 'QUOTA_EXCEEDED',
          quota: quotaStatus,
          upgrade: quotaStatus.needsUpgrade ? {
            cta: 'Upgrade to Premium',
            href: '/upgrade',
            reason: `Increase monthly AI generations from ${quotaStatus.limit} to ${quotaStatus.plan === 'free' ? '100' : '1000'}`
          } : undefined
        },
        { status: 429 }
      )
    }
    
    // Create background generator
    const backgroundGenerator = createBackgroundGenerator(supabase)
    
    // Queue generation job
    const job = await backgroundGenerator.queueGeneration({
      userId: user.id,
      menuId,
      templateId: menu.template_id,
      referenceImage: menu.template_id, // Template ID serves as reference
      brandColors: body.brandColors,
      brandImageUrl: body.brandImageUrl
    })
    
    // If job is already ready (cached), consume quota and update menu
    if (job.status === 'ready' && job.resultUrl) {
      await quotaOperations.consumeQuota(user.id, 1)
      
      // Update menu with background URL
      await supabase
        .from('menus')
        .update({ background_url: job.resultUrl })
        .eq('id', menuId)
      
      console.log('✅ [Generate Background] Using cached background:', job.id)
      
      return NextResponse.json({
        success: true,
        data: {
          jobId: job.id,
          status: 'ready',
          backgroundUrl: job.resultUrl,
          cached: true,
          quota: {
            remaining: quotaStatus.remaining - 1,
            used: quotaStatus.used + 1,
            limit: quotaStatus.limit
          }
        }
      })
    }
    
    // Job is queued, return job ID for polling
    console.log('✅ [Generate Background] Job queued:', job.id)
    
    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        message: 'Background generation queued. Poll /api/background-jobs/{jobId} for status.',
        quota: {
          remaining: quotaStatus.remaining,
          used: quotaStatus.used,
          limit: quotaStatus.limit
        }
      }
    }, { status: 202 }) // 202 Accepted for async processing
    
  } catch (error) {
    console.error('❌ [Generate Background] Error:', error)
    
    // Handle NanoBanana errors
    if (error instanceof NanoBananaError) {
      const payload = {
        error: error.message,
        code: error.code,
        retryAfter: error.retryAfter,
        suggestions: error.suggestions,
      }
      const status =
        error.code === 'AUTHENTICATION_ERROR' ? 401 :
        error.code === 'CONTENT_POLICY_VIOLATION' ? 403 :
        error.code === 'RATE_LIMIT_EXCEEDED' ? 429 :
        error.code === 'SERVICE_UNAVAILABLE' ? 503 :
        400
      return NextResponse.json(payload, { status })
    }
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
