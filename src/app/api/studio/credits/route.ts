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
    const auth = await requireStudioApi({ guest: 'allow' })
    if (!auth.ok) return auth.response

    const costs = getStudioCreditCosts()
    if (auth.isGuest) {
      return NextResponse.json({ balance: 0, costs, guest: true })
    }

    const balance = await getStudioCreditBalance(auth.user.id)

    return NextResponse.json({ balance, costs })
  } catch (error) {
    logger.error('❌ [Studio Credits] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
