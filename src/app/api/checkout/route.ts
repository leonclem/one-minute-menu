import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { getStripe, getPriceId, type ProductType } from '@/lib/stripe-config'
import { purchaseLogger } from '@/lib/purchase-logger'
import type { CheckoutRequest, CheckoutResponse, CheckoutError } from '@/types'
import { checkoutRateLimiter } from '@/lib/stripe-rate-limiter'
import { getRateLimitHeaders } from '@/lib/templates/rate-limiter'
import { logUnauthorizedAccess, logRateLimitViolation, logInvalidInput } from '@/lib/security'
import { getBillingCurrency, getStripePriceId } from '@/lib/billing-currency-service'
import type { BillingCurrency } from '@/lib/currency-config'

/**
 * POST /api/checkout
 * 
 * Creates a Stripe Checkout Session for subscription or Creator Pack purchase.
 * Handles free Creator Pack eligibility check and direct grant.
 * Uses user's selected billing currency to determine the appropriate Stripe Price ID.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9, 3.1, 3.2, 3.3
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  
  try {
    // 1. Authentication check (Requirement 2.9)
    const supabaseClient = createServerSupabaseClient()
    
    // Safety check for tests where supabaseClient might be partially mocked
    let user = null
    if (supabaseClient && supabaseClient.auth) {
      const { data: authData } = await supabaseClient.auth.getUser() || { data: { user: null } }
      user = authData?.user
    }

    const adminSupabase = createAdminSupabaseClient()

    // Note: We no longer strictly require authentication here to support guest checkout.
    // If user is not logged in, we'll collect their email during Stripe Checkout
    // and create an account for them in the webhook.
    
    // 2. Rate limiting check (Requirement 10.5)
    // For guest users, use their IP address for rate limiting
    const identifier = user?.id || request.headers.get('x-forwarded-for') || 'anonymous'
    const rateLimitResult = checkoutRateLimiter.check(identifier)
    
    if (!rateLimitResult.allowed) {
      await logRateLimitViolation(
        request,
        requestId,
        user?.id || 'anonymous',
        rateLimitResult.retryAfter
      )

      const errorResponse: CheckoutError = {
        error: 'Too many checkout requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString(),
        retryAfter: rateLimitResult.retryAfter,
      }

      return NextResponse.json(errorResponse, {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      })
    }

    // 3. Parse and validate request body
    let body: CheckoutRequest
    try {
      body = await request.json()
    } catch (parseError) {
      const errorResponse: CheckoutError = {
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    const { productType, successUrl, cancelUrl } = body

    // 3.1 Check for existing active subscription (Requirement 5.1)
    let existingCustomerId: string | null = null

    if (user) {
      // Check for active plan
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('plan, subscription_status, stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        existingCustomerId = profile.stripe_customer_id

        // Block redundant purchases for high-tier plans (Requirement 5.2)
        if (profile.plan === 'grid_plus_premium' || profile.plan === 'enterprise') {
          const { getPlanFriendlyName } = await import('@/lib/utils')
          const errorResponse: CheckoutError = {
            error: `You already have unlimited access with your ${getPlanFriendlyName(profile.plan)} plan. No further purchases are required.`,
            code: 'REDUNDANT_PURCHASE',
            timestamp: new Date().toISOString(),
          }
          return NextResponse.json(errorResponse, { status: 400 })
        }

        if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
          if (profile.plan === productType) {
            const errorResponse: CheckoutError = {
              error: `You already have an active ${productType} subscription.`,
              code: 'ALREADY_SUBSCRIBED',
              timestamp: new Date().toISOString(),
            }
            return NextResponse.json(errorResponse, { status: 400 })
          }
        }
      }

      // Check for very recent successful purchases (within last 2 minutes)
      // to prevent duplicate charges if webhook is slightly delayed
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      const { data: recentPurchases } = await adminSupabase
        .from('purchase_audit')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productType)
        .eq('status', 'success')
        .gt('created_at', twoMinutesAgo)
        .limit(1)

      if (recentPurchases && recentPurchases.length > 0) {
        const errorResponse: CheckoutError = {
          error: 'A purchase for this product was recently completed. Please wait a moment for your account to update.',
          code: 'RECENT_PURCHASE',
          timestamp: new Date().toISOString(),
        }
        return NextResponse.json(errorResponse, { status: 400 })
      }
    }

    // Special handling for Creator Pack free trial (Requirement 6.1, 6.2, 6.3)
    if (productType === 'creator_pack' && user) {
      // Check if user has already used their free trial
      const { data: existingPacks, error: packError } = await adminSupabase
        .from('user_packs')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_free_trial', true)
        .limit(1)

      if (packError) {
        console.error('[checkout] Failed to check pack eligibility:', packError)
        const errorResponse: CheckoutError = {
          error: 'Failed to check pack eligibility',
          code: 'DATABASE_ERROR',
          timestamp: new Date().toISOString(),
        }
        return NextResponse.json(errorResponse, { status: 500 })
      }

      // If no free trial used yet, grant it directly
      if (!existingPacks || existingPacks.length === 0) {
        try {
          // Grant the pack
          const { error: grantError } = await adminSupabase
            .from('user_packs')
            .insert({
              user_id: user.id,
              pack_type: 'creator_pack',
              is_free_trial: true,
              expires_at: new Date(Date.now() + 24 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 24 months
              edit_window_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
            })

          if (grantError) throw grantError

          // Log the free grant
          await purchaseLogger.logPurchase({
            userId: user.id,
            transactionId: `free_${crypto.randomUUID()}`,
            productId: 'creator_pack',
            amountCents: 0,
            currency: 'usd',
            status: 'success',
            metadata: { is_free_trial: true }
          })

          const response: CheckoutResponse = {
            sessionId: 'free_grant',
            url: successUrl || `${request.nextUrl.origin}/checkout/success`,
            grantedFree: true,
          }
          return NextResponse.json(response, { status: 200 })
        } catch (grantError: any) {
          console.error('[checkout] Failed to grant free Creator Pack:', grantError)
          const errorResponse: CheckoutError = {
            error: 'Failed to grant free Creator Pack',
            code: 'FULFILLMENT_ERROR',
            timestamp: new Date().toISOString(),
          }
          return NextResponse.json(errorResponse, { status: 500 })
        }
      }
    }

    // Validate product type (Requirement 10.4)
    const validProductTypes: ProductType[] = ['grid_plus', 'grid_plus_premium', 'creator_pack']
    if (!productType || !validProductTypes.includes(productType)) {
      await logInvalidInput(
        request,
        requestId,
        'productType',
        productType,
        'Invalid product type'
      )
      
      const errorResponse: CheckoutError = {
        error: 'Invalid product type. Must be one of: grid_plus, grid_plus_premium, creator_pack',
        code: 'INVALID_PRODUCT_TYPE',
        details: { validTypes: validProductTypes },
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // Validate URLs if provided (Requirement 10.4)
    if (successUrl && !isValidUrl(successUrl)) {
      await logInvalidInput(
        request,
        requestId,
        'successUrl',
        successUrl,
        'Invalid URL format'
      )
      
      const errorResponse: CheckoutError = {
        error: 'Invalid success URL format',
        code: 'INVALID_SUCCESS_URL',
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    if (cancelUrl && !isValidUrl(cancelUrl)) {
      await logInvalidInput(
        request,
        requestId,
        'cancelUrl',
        cancelUrl,
        'Invalid URL format'
      )
      
      const errorResponse: CheckoutError = {
        error: 'Invalid cancel URL format',
        code: 'INVALID_CANCEL_URL',
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // Validate price ID exists for product type and currency (Requirement 10.4)
    try {
      // Get user's billing currency to validate price ID
      const billingCurrency = await getBillingCurrency(user?.id)
      getStripePriceId(productType, billingCurrency) // This will throw if price ID is not configured
    } catch (priceError: any) {
      const errorResponse: CheckoutError = {
        error: 'Product configuration error',
        code: 'INVALID_PRODUCT_CONFIG',
        details: { message: priceError.message },
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // 4. Get user's selected billing currency (Requirements 2.3, 3.1, 3.2, 3.3)
    const billingCurrency: BillingCurrency = await getBillingCurrency(user?.id)

    // 5. Create Stripe Checkout Session (Requirements 2.1, 2.2, 2.3, 2.4, 2.5)
    const stripe = getStripe()
    const priceId = getStripePriceId(productType, billingCurrency)

    // Determine session mode based on product type
    const mode = productType === 'creator_pack' ? 'payment' : 'subscription'

    // Build session parameters
    const metadata: any = {
      product_type: productType,
      billing_currency: billingCurrency,
    }
    if (user) {
      metadata.user_id = user.id
    }

    const sessionParams: any = {
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${request.nextUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.nextUrl.origin}/checkout/cancel`,
      metadata,
    }

    if (mode === 'payment') {
      sessionParams.payment_intent_data = {
        description: 'GridMenu Creator Pack',
        metadata: {
          product_type: productType,
          billing_currency: billingCurrency,
          ...(user ? { user_id: user.id } : {}),
        },
      }
    }

    // Reuse existing customer ID if available
    if (existingCustomerId) {
      sessionParams.customer = existingCustomerId
    } else if (user) {
      // Let Stripe create a new customer and link to user's email
      sessionParams.customer_email = user.email
    }

    try {
      const session = await stripe.checkout.sessions.create(sessionParams)

      // 5. Return session URL (Requirements 2.6, 2.7)
      const response: CheckoutResponse = {
        sessionId: session.id,
        url: session.url || undefined,
      }
      return NextResponse.json(response, { status: 200 })
    } catch (stripeError: any) {
      console.error('[checkout] Stripe API error:', stripeError)
      const errorResponse: CheckoutError = {
        error: stripeError.message || 'Failed to create checkout session',
        code: 'STRIPE_API_ERROR',
        details: { type: stripeError.type },
        timestamp: new Date().toISOString(),
      }
      return NextResponse.json(errorResponse, { status: 500 })
    }
  } catch (error: any) {
    console.error('[checkout] Unexpected error:', error)
    const errorResponse: CheckoutError = {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    }
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

/**
 * Validate URL format
 * Ensures URL is a valid HTTP/HTTPS URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}