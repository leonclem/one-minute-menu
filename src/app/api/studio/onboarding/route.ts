import { NextRequest, NextResponse } from 'next/server'

import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/** Persist the account-level choice to hide the initial Studio guidance panel. */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => null)) as {
      dismissed?: unknown
    } | null
    if (typeof body?.dismissed !== 'boolean') {
      return NextResponse.json({ error: 'dismissed must be a boolean' }, { status: 400 })
    }

    const { error } = await auth.supabase
      .from('profiles')
      .update({ studio_first_run_dismissed: body.dismissed })
      .eq('id', auth.user.id)

    if (error) {
      throw new Error(`Failed to save Studio onboarding preference: ${error.message}`)
    }

    return NextResponse.json({ dismissed: body.dismissed })
  } catch (error) {
    logger.error('❌ [Studio Onboarding] preference update failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
