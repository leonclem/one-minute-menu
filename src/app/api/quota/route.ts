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

    const response = NextResponse.json({ success: true, data: { quota, usage } })
    // Explicitly prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (err) {
    console.error('Failed to fetch quota:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch quota' }, { status: 500 })
  }
}


