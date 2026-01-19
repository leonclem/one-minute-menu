import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'
import { isOnboardingComplete, getOnboardingBlockReason } from './onboarding-gate'
import { analyticsOperations } from './analytics-server'

export type RequireOnboardingApiResult =
  | { ok: true; user: any; profile: any }
  | { ok: false; response: NextResponse }

/**
 * API-layer guard to ensure onboarding is complete.
 * Patterned after requireAdminApi.
 */
export async function requireOnboardingCompleteApi(req: Request): Promise<RequireOnboardingApiResult> {
  const supabase = createServerSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const profile = await userOperations.getProfile(user.id)
  
  // Admins bypass onboarding requirements for flexibility
  if (profile?.role === 'admin') {
    return { ok: true, user, profile }
  }

  if (!isOnboardingComplete(profile)) {
    const reason = getOnboardingBlockReason(profile)
    const url = new URL(req.url)
    
    // Structured logging for audit/debugging
    console.warn('[onboarding] gate_blocked_api', {
      userId: user.id,
      email: user.email,
      path: url.pathname,
      reason
    })

    // Track platform metric for monitoring onboarding friction
    try {
      await analyticsOperations.trackPlatformMetric('onboarding_gate_blocked', 1, {
        userId: user.id,
        path: url.pathname,
        reason,
        layer: 'api'
      })
    } catch (err) {
      console.error('[onboarding] failed to track metric:', err)
    }

    return {
      ok: false,
      response: NextResponse.json(
        { 
          error: 'Onboarding required', 
          code: 'ONBOARDING_REQUIRED',
          redirectTo: `/onboarding?reason=required&next=${encodeURIComponent(url.pathname)}`
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true, user, profile }
}
