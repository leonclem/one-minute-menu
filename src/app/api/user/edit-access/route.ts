import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const profile = await userOperations.getProfile(user.id, supabase)
    const plan = (profile?.plan ?? 'free') as any
    const role = profile?.role

    const isSubscriber = ['grid_plus', 'grid_plus_premium', 'premium', 'enterprise'].includes(plan)
    const isAdmin = role === 'admin'
    if (!profile) {
      return NextResponse.json({ canEdit: false, reason: 'PROFILE_NOT_FOUND' })
    }
    if (isAdmin || isSubscriber) {
      return NextResponse.json({ canEdit: true, reason: 'SUBSCRIBER' })
    }

    const signupGraceMs = 7 * 24 * 60 * 60 * 1000
    const signupGraceEndsAt = new Date(profile.createdAt.getTime() + signupGraceMs)
    if (Date.now() < signupGraceEndsAt.getTime()) {
      return NextResponse.json({
        canEdit: true,
        reason: 'SIGNUP_GRACE',
        signupGraceEndsAt: signupGraceEndsAt.toISOString(),
      })
    }

    const { data: activeWindows, error } = await supabase
      .from('user_packs')
      .select('edit_window_end')
      .eq('user_id', user.id)
      .eq('pack_type', 'creator_pack')
      .gt('expires_at', new Date().toISOString())
      .gt('edit_window_end', new Date().toISOString())

    if (error) {
      return NextResponse.json({ canEdit: false, reason: 'CHECK_FAILED' }, { status: 500 })
    }

    if (activeWindows && activeWindows.length > 0) {
      const latest = activeWindows
        .map(w => w.edit_window_end ? new Date(w.edit_window_end) : null)
        .filter(Boolean)
        .sort((a: any, b: any) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined
      return NextResponse.json({
        canEdit: true,
        reason: 'CREATOR_PACK',
        editWindowEndsAt: latest?.toISOString(),
      })
    }

    return NextResponse.json({ canEdit: false, reason: 'EDIT_WINDOW_EXPIRED', code: 'EDIT_WINDOW_EXPIRED' }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

