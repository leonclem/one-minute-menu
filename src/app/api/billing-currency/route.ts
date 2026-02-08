import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getBillingCurrency, setBillingCurrency } from '@/lib/billing-currency-service'
import type { BillingCurrency } from '@/lib/currency-config'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/billing-currency
 * 
 * Fetches the billing currency for the authenticated user
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
    
    // Get billing currency for user
    const currency = await getBillingCurrency(user.id)
    
    return NextResponse.json({
      success: true,
      data: { currency }
    })
  } catch (error) {
    console.error('Failed to get billing currency:', error)
    return NextResponse.json(
      { error: 'Failed to get billing currency' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/billing-currency
 * 
 * Sets the billing currency for the authenticated user
 */
export async function POST(request: NextRequest) {
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
    
    // Parse request body
    const body = await request.json()
    const { currency } = body
    
    if (!currency) {
      return NextResponse.json(
        { error: 'Currency is required' },
        { status: 400 }
      )
    }
    
    // Set billing currency for user
    await setBillingCurrency(currency as BillingCurrency, user.id)
    
    return NextResponse.json({
      success: true,
      data: { currency }
    })
  } catch (error) {
    console.error('Failed to set billing currency:', error)
    return NextResponse.json(
      { error: 'Failed to set billing currency' },
      { status: 500 }
    )
  }
}
