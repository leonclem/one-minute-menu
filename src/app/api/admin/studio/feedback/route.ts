import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { listRecentStudioFeedback } from '@/lib/studio/feedback/feedback-store'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * Admin-only read path for recent Studio feedback.
 *
 * GET /api/admin/studio/feedback?limit=<1..100>
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) return auth.response

    const rawLimit = request.nextUrl.searchParams.get('limit')
    const limit = rawLimit === null ? undefined : Number(rawLimit)
    const feedback = await listRecentStudioFeedback(limit)

    return NextResponse.json({ success: true, feedback })
  } catch (error) {
    logger.error('❌ [Admin Studio Feedback] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
