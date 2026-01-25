import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe-config'
import type { CustomerPortalRequest, CustomerPortalResponse, CheckoutError } from '@/types'
import { logUnauthorizedAccess } from '@/lib/security'

/**
 * POST /api/customer-portal
 * 
 * Creates a Stripe Customer Portal session for subscription management.
 * Allows users to update payment methods, view invoices, and manage subscriptions.
 * 
 * Requirements: 15.2, 15.3
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    // 1. Authentication check (Requirement 15.2)
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      await logUnauthorizedAccess(
        request,
        requestId,
        undefined,
        'Unauthenticated customer portal access attempt'
      )
      
      const errorResponse: CheckoutError = {
        error: 'Authentication required',
        code: 'UNAUTHENTICATED',
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 401 })
    }

    // 2. Parse request body for optional return URL
    let returnUrl: string | undefined
    try {
      const body: CustomerPortalRequest = await request.json()
      returnUrl = body.returnUrl
    } catch {
      // Body is optional, use default return URL
    }

    // 3. Get user's Stripe customer ID from profile (Requirement 15.2)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[customer-portal] Error fetching profile:', profileError)
      const errorResponse: CheckoutError = {
        error: 'Failed to fetch user profile',
        code: 'DATABASE_ERROR',
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 500 })
    }

    // 4. Handle missing customer ID case
    if (!profile?.stripe_customer_id) {
      const errorResponse: CheckoutError = {
        error: 'No Stripe customer found. Please make a purchase first.',
        code: 'NO_CUSTOMER_ID',
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // 5. Create Stripe Customer Portal session (Requirement 15.3)
    const stripe = getStripe()
    
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: returnUrl || `${request.nextUrl.origin}/dashboard`,
      })

      // 6. Return portal URL
      const response: CustomerPortalResponse = {
        url: session.url,
      }
      return NextResponse.json(response, { status: 200 })
    } catch (stripeError: any) {
      console.error('[customer-portal] Stripe API error:', stripeError)
      const errorResponse: CheckoutError = {
        error: stripeError.message || 'Failed to create customer portal session',
        code: 'STRIPE_API_ERROR',
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 500 })
    }
  } catch (error: any) {
    console.error('[customer-portal] Unexpected error:', error)
    const errorResponse: CheckoutError = {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    }
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
