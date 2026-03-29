/**
 * Admin Cutout Worker Trigger
 *
 * POST /api/admin/cutout-worker
 *   — Manually trigger processing of pending cutout jobs.
 *   — Also invoked by Vercel Cron on a schedule.
 *
 * GET  /api/admin/cutout-worker
 *   — Called by Vercel Cron (cron jobs use GET). Authenticated via
 *     CRON_SECRET header instead of session cookie.
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
 * GET — Vercel Cron trigger.
 * Authenticated via CRON_SECRET to prevent unauthorized invocations.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await processPendingCutouts()
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
 * Body: { menuId?: string } — optional scope to a single menu.
 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const body = await request.json().catch(() => ({})) as { menuId?: string }
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
