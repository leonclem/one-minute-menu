import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

// GET /api/admin/users - List users for management
export async function GET() {
  try {
    await requireAdmin()
    
    // Use Admin client to bypass RLS and see all profiles
    const supabase = createAdminSupabaseClient()
    
    // 1. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('is_approved', { ascending: true })
      .order('created_at', { ascending: false })
    
    if (profilesError) {
      console.error('[admin-users] Supabase profiles error:', profilesError)
      return NextResponse.json({ error: profilesError.message }, { status: 400 })
    }

    /**
     * "Verified inbox" signal for pilot approvals:
     * Supabase can create auth.users + profiles at OTP request time (before the link is clicked),
     * and local/prod settings can make auth fields hard to rely on.
     *
     * We instead depend on an app-owned stamp written in `/auth/callback`:
     * - `profiles.last_login_at` is only set after a successful exchangeCodeForSession (i.e. link clicked).
     */
    const filteredUsers = (profiles || []).filter((p: any) => {
      if (p.role === 'admin') return true
      if (p.is_approved) return true
      return !!p.last_login_at
    })

    return NextResponse.json({
      success: true,
      data: filteredUsers.map(u => ({
        id: u.id,
        email: u.email,
        plan: u.plan,
        role: u.role,
        isApproved: u.is_approved,
        approvedAt: u.approved_at,
        createdAt: u.created_at,
        restaurantName: u.restaurant_name
      }))
    })
    
  } catch (error) {
    console.error('[admin-users] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
