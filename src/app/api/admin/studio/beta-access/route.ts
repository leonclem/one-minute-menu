/**
 * Admin Studio beta access — inspect and grant/revoke private-beta access.
 *
 * GET  /api/admin/studio/beta-access?userId=
 * POST /api/admin/studio/beta-access { userId, action, note? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import {
  grantStudioBetaAccess,
  getStudioBetaAccess,
  revokeStudioBetaAccess,
  type StudioBetaAccessRecord,
} from '@/lib/studio/access/beta-access-store'
import { validateBetaAccessRequest } from '@/lib/studio/access/beta-access-validation'
import { getStudioCreditBalance } from '@/lib/studio/credits'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

type PublicBetaAccess = {
  enabled: boolean
  grantedBy: string | null
  grantedAt: string | null
  revokedAt: string | null
  note: string | null
}

function serializeAccess(
  access: StudioBetaAccessRecord | null,
): PublicBetaAccess | null {
  if (!access) return null

  return {
    enabled: access.enabled,
    grantedBy: access.granted_by,
    grantedAt: access.granted_at,
    revokedAt: access.revoked_at,
    note: access.note,
  }
}

/**
 * The shared request validator also owns UUID validation. Supplying a valid
 * action here lets GET use the same validation code without duplicating it.
 */
function validateUserId(userId: string | null) {
  return validateBetaAccessRequest({ userId, action: 'grant' })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) return auth.response

    const validation = validateUserId(request.nextUrl.searchParams.get('userId'))
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'Invalid beta access request', code: validation.code },
        { status: 400 },
      )
    }

    const userId = validation.value.userId
    const [access, creditBalance] = await Promise.all([
      getStudioBetaAccess(userId),
      getStudioCreditBalance(userId),
    ])

    return NextResponse.json({
      success: true,
      access: serializeAccess(access),
      creditBalance,
    })
  } catch (error) {
    logger.error('❌ [Admin Studio Beta Access] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi()
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const validation = validateBetaAccessRequest(body)
    if (!validation.ok) {
      return NextResponse.json(
        { error: 'Invalid beta access request', code: validation.code },
        { status: 400 },
      )
    }

    const { userId, action, note } = validation.value
    let access: StudioBetaAccessRecord
    try {
      access =
        action === 'grant'
          ? await grantStudioBetaAccess({
              userId,
              adminUserId: auth.user.id,
              note,
            })
          : await revokeStudioBetaAccess({
              userId,
              adminUserId: auth.user.id,
              note,
            })
    } catch (error) {
      logger.error('❌ [Admin Studio Beta Access] POST write failed', { error })
      return NextResponse.json(
        { error: 'Failed to write beta access', code: 'BETA_ACCESS_WRITE_FAILED' },
        { status: 500 },
      )
    }

    const creditBalance = await getStudioCreditBalance(userId)

    return NextResponse.json({
      success: true,
      access: serializeAccess(access),
      creditBalance,
    })
  } catch (error) {
    logger.error('❌ [Admin Studio Beta Access] POST failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
