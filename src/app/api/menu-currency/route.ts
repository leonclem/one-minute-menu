import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getMenuCurrency } from '@/lib/menu-currency-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/menu-currency
 * 
 * Fetches the menu currency for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get menu currency for user
    const currency = await getMenuCurrency(user.id)
    
    return NextResponse.json({
      success: true,
      data: { currency }
    })
  } catch (error) {
    console.error('Failed to get menu currency:', error)
    return NextResponse.json(
      { error: 'Failed to get menu currency' },
      { status: 500 }
    )
  }
}
