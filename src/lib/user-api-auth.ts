/**
 * Authenticated (non-admin) API helper for Next.js route handlers.
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { User } from '@supabase/supabase-js'

export type RequireUserApiResult =
  | { ok: true; supabase: ReturnType<typeof createServerSupabaseClient>; user: User }
  | { ok: false; response: NextResponse }

export async function requireUserApi(): Promise<RequireUserApiResult> {
  const supabase = createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true, supabase, user }
}
