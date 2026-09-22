import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { setGuestClaimCookie } from '@/lib/studio/guest/guest-claim-cookie'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const auth = await requireStudioApi({ guest: 'allow' })
    if (!auth.ok) return auth.response
    if (!auth.isGuest) {
      return NextResponse.json({ isGuest: false, claimToken: null })
    }

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('studio_guest_sessions')
      .upsert(
        { user_id: auth.user.id, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select('claim_token')
      .single()

    if (error || !data?.claim_token) {
      logger.error('[studio-guest] Failed to upsert guest session', { error })
      return NextResponse.json({ error: 'Failed to start guest session' }, { status: 500 })
    }

    const response = NextResponse.json({
      isGuest: true,
      claimToken: data.claim_token as string,
    })
    setGuestClaimCookie(response, data.claim_token as string)
    return response
  } catch (error) {
    logger.error('[studio-guest] Session error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireStudioApi({ guest: 'allow' })
    if (!auth.ok) return auth.response
    if (!auth.isGuest) {
      return NextResponse.json({ ok: true })
    }

    const body = (await request.json().catch(() => null)) as {
      magicLinkSent?: unknown
      pendingAction?: unknown
    } | null

    const admin = createAdminSupabaseClient()
    const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() }
    if (body?.magicLinkSent === true) {
      patch.magic_link_sent_at = new Date().toISOString()
    }
    if (body?.pendingAction && typeof body.pendingAction === 'object') {
      patch.pending_action = body.pendingAction
    }

    await admin.from('studio_guest_sessions').update(patch).eq('user_id', auth.user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('[studio-guest] Session update error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
