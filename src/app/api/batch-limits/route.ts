import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userOperations } from '@/lib/database'
import { getBatchLimits } from '@/lib/rate-limiting'
import type { UserPlan } from '@/types'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Return free-plan defaults for unauthenticated users
      return NextResponse.json(getBatchLimits('free'))
    }

    const profile = await userOperations.getProfile(user.id)
    const plan = (profile?.plan ?? 'free') as UserPlan

    return NextResponse.json(getBatchLimits(plan))
  } catch {
    return NextResponse.json(getBatchLimits('free'))
  }
}
