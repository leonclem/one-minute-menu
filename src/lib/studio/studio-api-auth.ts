import { NextResponse } from 'next/server'
import { requireUserApi, type RequireUserApiResult } from '@/lib/user-api-auth'
import { resolveStudioAccess } from '@/lib/studio/access/studio-access'
import { getFeatureFlag } from '@/lib/feature-flags'
import { isAccountPendingApproval } from '@/lib/account-approval'
import {
  GUEST_AUTH_REQUIRED_CODE,
  isGuestAuthUser,
  resolveGuestStudioPathAllowed,
} from '@/lib/studio/guest/guest-path'

type StudioSupabaseClient = Extract<RequireUserApiResult, { ok: true }>['supabase']

export type RequireStudioApiSuccess = {
  ok: true
  supabase: StudioSupabaseClient
  user: Extract<RequireUserApiResult, { ok: true }>['user']
  isGuest: boolean
}

export type RequireStudioApiResult =
  | RequireStudioApiSuccess
  | { ok: false; response: NextResponse }

export type StudioGuestPolicy = 'allow' | 'deny'

/** Read the authenticated user's role from the profiles table. */
export async function isAdminUser(
  supabase: StudioSupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return !error && profile?.role === 'admin'
}

export async function requireStudioApi(
  options: { guest?: StudioGuestPolicy } = {},
): Promise<RequireStudioApiResult> {
  const guestPolicy = options.guest ?? 'deny'
  const auth = await requireUserApi()
  if (auth.ok === false) {
    return { ok: false, response: auth.response }
  }

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('role, is_approved, is_guest')
    .eq('id', auth.user.id)
    .single()

  const isGuest =
    profile?.is_guest === true || isGuestAuthUser(auth.user)
  const isAdmin = profile?.role === 'admin'
  const requireAdminApproval = await getFeatureFlag('require_admin_approval')

  if (isGuest && !resolveGuestStudioPathAllowed(requireAdminApproval)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sign in to use Studio', code: GUEST_AUTH_REQUIRED_CODE },
        { status: 401 },
      ),
    }
  }

  if (isGuest && guestPolicy === 'deny') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Create a free account to continue',
          code: GUEST_AUTH_REQUIRED_CODE,
        },
        { status: 401 },
      ),
    }
  }

  const decision = await resolveStudioAccess({
    userId: auth.user.id,
    isAdmin,
  })

  if (!decision.granted) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden - Studio access required', reason: decision.reason },
        { status: 403 },
      ),
    }
  }

  if (
    !isGuest &&
    isAccountPendingApproval({
      requireAdminApproval,
      isAdmin,
      isApproved: profile?.is_approved,
    })
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Forbidden - account pending approval',
          reason: 'denied_account_pending_approval',
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true, supabase: auth.supabase, user: auth.user, isGuest }
}
