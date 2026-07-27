/**
 * POST /api/admin/studio/dishes/[dishId]/clear-generation-block
 *
 * Clears the per-dish billable-failure circuit breaker after support review.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { clearDishGenerationBlock } from '@/lib/studio/generation-failures'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(
  _request: NextRequest,
  { params }: { params: { dishId: string } },
) {
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) return auth.response

    const { dishId } = params
    if (!dishId) {
      return NextResponse.json({ error: 'dishId is required' }, { status: 400 })
    }

    const dish = await clearDishGenerationBlock(dishId)
    return NextResponse.json({ success: true, dish })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear block'
    logger.error('❌ [Admin clear generation block] failed', { error })
    const status = message.toLowerCase().includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
