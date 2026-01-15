import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-utils'

// GET /api/admin/users - List users for management
export async function GET() {
  try {
    await requireAdmin()
    
    const supabase = createServerSupabaseClient()
    
    // Fetch profiles sorted by approval status (unapproved first) then creation date
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('is_approved', { ascending: true })
      .order('created_at', { ascending: false })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      data: users.map(u => ({
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
