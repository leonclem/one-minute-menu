/**
 * GET /api/studio/credits — signed-in user's Studio balance + cost table.
 */

import { NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import {
  getStudioCreditBalance,
  getStudioCreditCosts,
} from '@/lib/studio/credits'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const [balance, costs] = await Promise.all([
      getStudioCreditBalance(auth.user.id),
      Promise.resolve(getStudioCreditCosts()),
    ])

    return NextResponse.json({ balance, costs })
  } catch (error) {
    logger.error('❌ [Studio Credits] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
