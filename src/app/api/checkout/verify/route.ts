import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { getStripe } from '@/lib/stripe-config'
import { processCheckoutCompleted } from '@/lib/stripe-webhook-processor'

/**
 * GET /api/checkout/verify
 * 
 * Manually verify a Stripe Checkout Session status.
 * This acts as a fallback if the webhook is delayed or fails.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const searchParams = request.nextUrl.searchParams
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Note: To support guest checkout verification, we'll allow unauthenticated verify 
    // but only if the session metadata matches the transaction.
    // However, for now, we'll keep the auth check but make it more descriptive.
    if (authError || !user) {
      console.warn(`[verify:${requestId}] Unauthorized verification attempt for session ${sessionId}`)
      // Instead of 401, return a 200 with a flag so the UI can handle it
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required to verify purchase status automatically.' 
      })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Security check: ensure the session belongs to the user if we have user_id in metadata
    const metadataUserId = session.metadata?.user_id
    if (metadataUserId && metadataUserId !== user.id) {
      console.warn(`[verify:${requestId}] Session ${sessionId} user mismatch: meta=${metadataUserId}, user=${user.id}`)
      return NextResponse.json({ error: 'Session mismatch' }, { status: 403 })
    }

    const productType = session.metadata?.product_type || null

    const isSubscription = session.mode === 'subscription' || !!session.subscription
    const isPaidAndComplete = session.payment_status === 'paid' && (session.status === 'complete' || session.status === 'open')
    const isSubscriptionComplete = isSubscription && session.status === 'complete'

    if (isPaidAndComplete || isSubscriptionComplete) {
      // Check if already processed via purchase_audit
      const adminSupabase = createAdminSupabaseClient()
      const { data: existingPurchase } = await adminSupabase
        .from('purchase_audit')
        .select('id')
        .eq('transaction_id', session.id)
        .maybeSingle()

      if (!existingPurchase) {
        const verificationLabel = isPaidAndComplete ? 'paid' : 'subscription_complete'
        console.log(`[verify:${requestId}] Session ${verificationLabel} but not processed. Triggering fulfillment...`)
        // Override user_id in session metadata if it was a guest checkout 
        // that we are now verifying as a logged in user
        if (!session.metadata?.user_id) {
          session.metadata = { ...session.metadata, user_id: user.id }
        }
        await processCheckoutCompleted(session as any, `verify_${requestId}`)
      }

      return NextResponse.json({ 
        success: true, 
        status: session.status,
        payment_status: session.payment_status,
        processed: true,
        product_type: productType,
      })
    }

    return NextResponse.json({ 
      success: true, 
      status: session.status,
      payment_status: session.payment_status,
      processed: false,
      product_type: productType,
    })

  } catch (error: any) {
    console.error(`[verify:${requestId}] Error verifying session:`, error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
