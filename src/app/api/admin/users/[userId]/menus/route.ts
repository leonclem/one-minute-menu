import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/admin/users/[userId]/menus - List all menus for a specific user (admin only)
export async function GET(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin()

    const supabase = createAdminSupabaseClient()

    const { data, error } = await supabase
      .from('menus')
      .select('id, name, slug, status, current_version, created_at, updated_at')
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[admin-user-menus] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        status: m.status,
        currentVersion: m.current_version,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
    })
  } catch (error) {
    console.error('[admin-user-menus] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
