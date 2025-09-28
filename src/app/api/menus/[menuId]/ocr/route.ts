import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { menuOperations, ocrOperations, userOperations, DatabaseError } from '@/lib/database'

// POST /api/menus/[menuId]/ocr - Enqueue OCR job for the menu's image
export async function POST(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
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
    const rateLimitPerHour = Number.parseInt(process.env.OCR_RATE_LIMIT_PER_HOUR || '10', 10)
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
    // Enqueue or reuse job
    const job = await ocrOperations.enqueueJob(user.id, menu.imageUrl, { force })

    // Defer processing to Python worker (LISTEN/NOTIFY wakes it on enqueue)
    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    console.error('Error enqueueing OCR job:', error)
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

