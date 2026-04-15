import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/[userId]/menus/[slug]/template-selection
 *
 * Admin-only endpoint to fetch the saved template selection for any user's menu.
 * Uses the admin Supabase client to bypass RLS.
 */
export async function GET(
  _req: Request,
  { params }: { params: { userId: string; slug: string } }
) {
  try {
    await requireAdmin()

    const supabase = createAdminSupabaseClient()

    // Resolve menu ID from userId + slug
    const { data: menuRow, error: menuError } = await supabase
      .from('menus')
      .select('id')
      .eq('user_id', params.userId)
      .eq('slug', params.slug)
      .single()

    if (menuError || !menuRow) {
      return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
    }

    // Fetch template selection — admin client bypasses RLS
    const { data, error } = await supabase
      .from('menu_template_selections')
      .select('*')
      .eq('menu_id', menuRow.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: true, data: null })
      }
      console.error('[admin-template-selection] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        menuId: data.menu_id,
        templateId: data.template_id,
        templateVersion: data.template_version,
        configuration: data.configuration,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    })
  } catch (error) {
    console.error('[admin-template-selection] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
