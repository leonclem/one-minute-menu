import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getBillingCurrency, setBillingCurrency, canChangeBillingCurrency } from '@/lib/billing-currency-service'
import type { BillingCurrency } from '@/lib/currency-config'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/currency/billing
 * Get current billing currency for authenticated user
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

    const currency = await getBillingCurrency(user.id)

    return NextResponse.json({ currency })
  } catch (error) {
    console.error('Failed to get billing currency:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/currency/billing
 * Update billing currency for authenticated user
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
    const { currency } = body

    if (!currency) {
      return NextResponse.json(
        { error: 'Currency is required' },
        { status: 400 }
      )
    }

    const canChange = await canChangeBillingCurrency(user.id)
    if (!canChange.allowed) {
      return NextResponse.json(
        { error: canChange.reason ?? 'Cannot change billing currency while you have an active subscription.' },
        { status: 403 }
      )
    }

    await setBillingCurrency(currency as BillingCurrency, user.id)

    return NextResponse.json({ success: true, currency })
  } catch (error: any) {
    console.error('Failed to update billing currency:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
