/**
 * Auth gate for customer-facing `/api/studio/*` routes.
 *
 * Authentication is checked before Studio access so unauthenticated callers
 * consistently receive 401, while authenticated callers without access
 * receive a reasoned 403 response.
 */

import { NextResponse } from 'next/server'
import { requireUserApi, type RequireUserApiResult } from '@/lib/user-api-auth'
import { resolveStudioAccess } from '@/lib/studio/access/studio-access'

type StudioSupabaseClient = Extract<RequireUserApiResult, { ok: true }>['supabase']

export type RequireStudioApiResult = RequireUserApiResult

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

export async function requireStudioApi(): Promise<RequireStudioApiResult> {
  const auth = await requireUserApi()
  if (!auth.ok) return auth

  const isAdmin = await isAdminUser(auth.supabase, auth.user.id)
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

  return { ok: true, supabase: auth.supabase, user: auth.user }
}
