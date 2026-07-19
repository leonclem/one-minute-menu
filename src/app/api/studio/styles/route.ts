/**
 * Photo Studio — active reference styles (display fields only).
 *
 * GET /api/studio/styles
 */

import { NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/user-api-auth'
import {
  listActiveBackgroundStyles,
  listActiveLightingStyles,
} from '@/lib/studio/reference-libraries'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const auth = await requireUserApi()
    if (!auth.ok) return auth.response

    const [lighting, background] = await Promise.all([
      listActiveLightingStyles(),
      listActiveBackgroundStyles(),
    ])

    return NextResponse.json({ lighting, background })
  } catch (error) {
    logger.error('❌ [Studio Styles] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
