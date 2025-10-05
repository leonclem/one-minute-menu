import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { analyticsOperations } from '@/lib/analytics'
import { menuOperations } from '@/lib/database'

/**
 * Get analytics for a specific menu
 * GET /api/analytics/menu/[menuId]?days=7
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { menuId: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { menuId } = params
    
    // Verify the user owns this menu
    const menu = await menuOperations.getMenu(menuId)
    if (!menu || menu.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Menu not found or access denied' },
        { status: 404 }
      )
    }
    
    // Get days parameter from query string
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7', 10)
    
    // Fetch analytics
    const [summary, history] = await Promise.all([
      analyticsOperations.getMenuAnalyticsSummary(menuId),
      analyticsOperations.getMenuAnalytics(menuId, days),
    ])
    
    return NextResponse.json({
      success: true,
      data: {
        summary,
        history,
      },
    })
  } catch (error) {
    console.error('Error fetching menu analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
