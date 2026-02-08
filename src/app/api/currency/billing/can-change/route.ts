import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { canChangeBillingCurrency } from '@/lib/billing-currency-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/currency/billing/can-change
 * Check if user can change billing currency
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

    const result = await canChangeBillingCurrency(user.id)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to check if billing currency can be changed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
