/**
 * Admin Studio credits — grant/revoke + inspect balance/ledger.
 *
 * GET  /api/admin/studio/credits?userId=
 * POST /api/admin/studio/credits  { userId, delta, note }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import {
  creditAdminGrant,
  getStudioCreditBalance,
  listStudioCreditLedger,
  StudioCreditsError,
} from '@/lib/studio/credits'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) return auth.response

    const userId = request.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const [balance, ledger] = await Promise.all([
      getStudioCreditBalance(userId),
      listStudioCreditLedger(userId, 25),
    ])

    return NextResponse.json({ success: true, balance, ledger })
  } catch (error) {
    logger.error('❌ [Admin Studio Credits] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      userId?: unknown
      delta?: unknown
      note?: unknown
    }

    if (typeof body.userId !== 'string' || !body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (typeof body.delta !== 'number' || !Number.isInteger(body.delta)) {
      return NextResponse.json(
        { error: 'delta must be a non-zero integer' },
        { status: 400 },
      )
    }
    if (typeof body.note !== 'string') {
      return NextResponse.json({ error: 'note is required' }, { status: 400 })
    }

    const result = await creditAdminGrant({
      userId: body.userId,
      delta: body.delta,
      note: body.note,
      adminUserId: auth.user.id,
    })

    return NextResponse.json({
      success: true,
      balance: result.balanceAfter,
      ledgerId: result.ledgerId,
    })
  } catch (error) {
    if (error instanceof StudioCreditsError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }
    logger.error('❌ [Admin Studio Credits] POST failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
