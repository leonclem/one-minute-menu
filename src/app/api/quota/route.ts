import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { quotaOperations } from '@/lib/quota-management'

export const dynamic = 'force-dynamic'

// GET /api/quota - Get current user's quota status and usage stats
export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const [quota, usage] = await Promise.all([
      quotaOperations.checkQuota(user.id),
      quotaOperations.getUsageStats(user.id)
    ])

    return NextResponse.json({ success: true, data: { quota, usage } })
  } catch (err) {
    console.error('Failed to fetch quota:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch quota' }, { status: 500 })
  }
}


