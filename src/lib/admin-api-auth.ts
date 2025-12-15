/**
 * Admin API Authentication Helper
 *
 * For Next.js route handlers (app router), where `redirect()` isn't appropriate.
 * Returns a structured result so callers can early-return a NextResponse.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export type RequireAdminApiResult =
  | { ok: true; supabase: any; user: any }
  | { ok: false; response: NextResponse }

export async function requireAdminApi(): Promise<RequireAdminApiResult> {
  const supabase = createServerSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 },
      ),
    }
  }

  return { ok: true, supabase, user }
}


