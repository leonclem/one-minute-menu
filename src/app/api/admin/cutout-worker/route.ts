/**
 * Admin Cutout Worker Trigger
 *
 * POST /api/admin/cutout-worker
 *   — Manually trigger processing of pending cutout jobs.
 *
 * GET  /api/admin/cutout-worker
 *   — Same work, authenticated via the CRON_SECRET bearer token.
 *   — Not scheduled. Pending cutouts are drained by the Railway worker.
 *     Restore the every-minute cron by adding this under `crons` in vercel.json:
 *     { "path": "/api/admin/cutout-worker", "schedule": "* * * * *" }
 *
 * Requirements: 9.2
 */

import { NextRequest, NextResponse } from 'next/server'
import { processPendingCutouts, retryFailedCutouts } from '@/lib/background-removal/cutout-worker'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * POST — admin-authenticated manual trigger.
 */
export async function POST() {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const result = await processPendingCutouts()
    return NextResponse.json(result)
  } catch (error) {
    logger.error('[cutout-worker route] Error processing cutouts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET — CRON_SECRET-authenticated trigger.
 * Kept so the vercel.json cron entry can be restored without a route change.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processPendingCutouts()
    // Suppress no-op cron logs — only log when there was actual work to do
    if (result.processed > 0) {
      logger.info('[cutout-worker route] Cron processed cutouts', result)
    }
    return NextResponse.json(result)
  } catch (error) {
    logger.error('[cutout-worker route] Cron error processing cutouts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH — Reset failed/timed-out cutouts back to pending, then process them.
 * Body: { menuId?: string, imageId?: string } — optional scope to a single menu or image.
 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const body = await request.json().catch(() => ({})) as { menuId?: string; imageId?: string }
    
    // Phase 3.3: If imageId is provided, retry a specific image only
    if (body.imageId) {
      const supabase = (await import('@/lib/supabase-server')).createAdminSupabaseClient()
      
      // Reset this specific image's cutout back to pending
      const { error: updateErr } = await supabase
        .from('ai_generated_images')
        .update({
          cutout_status: 'pending',
          cutout_failure_reason: null,
          cutout_completed_at: null,
        })
        .eq('id', body.imageId)
        .in('cutout_status', ['failed', 'timed_out'])
      
      if (updateErr) {
        logger.error('[cutout-worker route] Failed to reset image cutout:', updateErr)
        return NextResponse.json(
          { error: 'Failed to reset cutout' },
          { status: 400 }
        )
      }
      
      // Also reset the corresponding log entry
      const { data: image } = await supabase
        .from('ai_generated_images')
        .select('cutout_generation_log_id')
        .eq('id', body.imageId)
        .maybeSingle()
      
      if (image?.cutout_generation_log_id) {
        await supabase
          .from('cutout_generation_logs')
          .update({ status: 'pending', error_category: null, error_code: null, error_message: null, completed_at: null })
          .eq('id', image.cutout_generation_log_id)
          .in('status', ['failed', 'timed_out'])
      }
      
      logger.info('[cutout-worker route] Reset cutout for image', { imageId: body.imageId })
      return NextResponse.json({ reset: 1, imageId: body.imageId })
    }
    
    // Original behavior: reset by menuId (or all if no menuId)
    const resetCount = await retryFailedCutouts(body.menuId)

    if (resetCount === 0) {
      return NextResponse.json({ reset: 0, processed: 0, succeeded: 0, failed: 0 })
    }

    // Immediately process the newly-pending jobs
    const result = await processPendingCutouts()
    return NextResponse.json({ reset: resetCount, ...result })
  } catch (error) {
    logger.error('[cutout-worker route] Error retrying failed cutouts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
