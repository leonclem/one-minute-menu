import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    await requireAdmin()
    const adminSupabase = createAdminSupabaseClient()
    
    const { data, error } = await adminSupabase
      .from('feature_flags')
      .select('id, enabled, updated_at')
      .eq('id', 'require_admin_approval')
      .single()
    
    if (error) {
      console.error('Error fetching feature flag:', error)
      return NextResponse.json({ error: 'Failed to fetch feature flag' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: 403 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
    const adminSupabase = createAdminSupabaseClient()
    
    const { enabled } = await request.json()
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
    }
    
    const { data, error } = await adminSupabase
      .from('feature_flags')
      .update({ 
        enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'require_admin_approval')
      .select('id, enabled, updated_at')
      .single()
    
    if (error) {
      console.error('Error updating feature flag:', error)
      return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: 403 })
  }
}
