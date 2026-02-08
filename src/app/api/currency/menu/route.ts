import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getMenuCurrency, setMenuCurrency } from '@/lib/menu-currency-service'
import type { ISO4217CurrencyCode } from '@/lib/currency-config'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/currency/menu
 * Get current menu currency for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const currency = await getMenuCurrency(user.id)

    return NextResponse.json({ currency })
  } catch (error) {
    console.error('Failed to get menu currency:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/currency/menu
 * Update menu currency for authenticated user
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currency, confirmed = false } = body

    if (!currency) {
      return NextResponse.json(
        { error: 'Currency is required' },
        { status: 400 }
      )
    }

    const result = await setMenuCurrency(
      user.id,
      currency as ISO4217CurrencyCode,
      confirmed
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to update menu currency:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
