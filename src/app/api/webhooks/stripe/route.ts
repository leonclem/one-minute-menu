import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getWebhookSecret } from '@/lib/stripe-config'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Stripe from 'stripe'
import { webhookRateLimiter } from '@/lib/stripe-rate-limiter'
import { getRateLimitHeaders } from '@/lib/templates/rate-limiter'
import { logSecurityEvent, logRateLimitViolation } from '@/lib/security'

/**
 * POST /api/webhooks/stripe
 * 
 * Receives and processes Stripe webhook events.
 * Verifies webhook signatures and logs all events for audit.
 * 
 * Requirements: 4.1, 4.2, 4.7, 4.8, 4.9, 10.2, 14.1, 14.2
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const receivedAt = new Date()

  try {
    // 1. Rate limiting check (Requirement 14.3)
    // Use IP address as identifier for webhook rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    const rateLimitResult = webhookRateLimiter.check(ip)
    
    if (!rateLimitResult.allowed) {
      await logRateLimitViolation(request, requestId, ip, rateLimitResult.retryAfter)

      return NextResponse.json(
        { error: 'Too many webhook requests' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // 2. Read raw request body (CRITICAL for signature verification)
    // Must use request.text() not request.json() to preserve raw body
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      await logSecurityEvent('missing_signature', request, requestId, {
        endpoint: '/api/webhooks/stripe',
        details: 'Missing stripe-signature header',
      })
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 400 }
      )
    }

    // 3. Verify webhook signature (Requirements 4.1, 10.2, 14.1)
    const stripe = getStripe()
    const webhookSecret = getWebhookSecret()
    
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    } catch (err: any) {
      await logSecurityEvent('invalid_signature', request, requestId, {
        endpoint: '/api/webhooks/stripe',
        details: err.message,
      })
      // Requirement 4.2, 14.2: Return 400 for invalid signatures
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    console.log(`[webhook:${requestId}] Received event: ${event.type} (${event.id})`)

    // 4. Log webhook event for audit (Requirement 4.9)
    const supabase = createServerSupabaseClient()
    
    // Check if this event was already received (get existing retry_count)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('retry_count')
      .eq('stripe_event_id', event.id)
      .maybeSingle()
    
    const currentRetryCount = existingEvent?.retry_count ?? 0
    
    const { error: logError } = await supabase
      .from('webhook_events')
      .upsert({
        stripe_event_id: event.id,
        event_type: event.type,
        processed: false,
        payload: event as any,
        created_at: receivedAt.toISOString(),
        retry_count: currentRetryCount + (existingEvent ? 1 : 0), // Increment if retry
      }, {
        onConflict: 'stripe_event_id'
      })

    if (logError) {
      console.error(`[webhook:${requestId}] Failed to log webhook event:`, logError)
      // Continue processing even if logging fails
    }

    // 5. Route event to processor
    const processingStartTime = Date.now()
    try {
      await processWebhookEvent(event, requestId)
      
      const processingEndTime = Date.now()
      const processingTimeMs = processingEndTime - processingStartTime
      
      // Mark event as processed with latency tracking (Requirements 12.1, 12.6)
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_time_ms: processingTimeMs,
        })
        .eq('stripe_event_id', event.id)

      console.log(`[webhook:${requestId}] Processed in ${processingTimeMs}ms`)

      // Requirement 4.7: Return 200 for successful processing
      return NextResponse.json({ received: true }, { status: 200 })
    } catch (processingError: any) {
      console.error(`[webhook:${requestId}] Processing error:`, processingError)
      
      const processingEndTime = Date.now()
      const processingTimeMs = processingEndTime - processingStartTime
      
      // Log processing error with latency (Requirements 12.1, 12.6)
      await supabase
        .from('webhook_events')
        .update({
          processing_error: processingError.message,
          processing_time_ms: processingTimeMs,
        })
        .eq('stripe_event_id', event.id)

      // Requirement 4.8: Return 500 for processing errors (triggers Stripe retry)
      return NextResponse.json(
        { error: 'Processing failed', details: processingError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error(`[webhook:${requestId}] Unexpected error:`, error)
    // Return 500 to trigger Stripe retry
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Process a webhook event by routing to appropriate handler
 */
async function processWebhookEvent(event: Stripe.Event, requestId: string): Promise<void> {
  console.log(`[webhook:${requestId}] Processing event type: ${event.type}`)

  // Import processor functions
  const {
    processCheckoutCompleted,
    processSubscriptionCreated,
    processSubscriptionUpdated,
    processSubscriptionDeleted,
    processInvoicePaymentSucceeded,
    processInvoicePaymentFailed,
    processPaymentIntentSucceeded,
    processPaymentIntentFailed,
    processChargeFailed,
  } = await import('@/lib/stripe-webhook-processor')

  switch (event.type) {
    case 'checkout.session.completed':
      await processCheckoutCompleted(event.data.object as Stripe.Checkout.Session, requestId)
      break
    
    case 'customer.subscription.created':
      await processSubscriptionCreated(event.data.object as Stripe.Subscription, requestId)
      break
    
    case 'customer.subscription.updated':
      await processSubscriptionUpdated(event.data.object as Stripe.Subscription, requestId)
      break
    
    case 'customer.subscription.deleted':
      await processSubscriptionDeleted(event.data.object as Stripe.Subscription, requestId)
      break
    
    case 'invoice.payment_succeeded':
      await processInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, requestId)
      break
    
    case 'invoice.payment_failed':
      await processInvoicePaymentFailed(event.data.object as Stripe.Invoice, requestId)
      break

    case 'payment_intent.succeeded':
      await processPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, requestId)
      break

    case 'payment_intent.payment_failed':
      await processPaymentIntentFailed(event.data.object as Stripe.PaymentIntent, requestId)
      break

    case 'charge.failed':
      await processChargeFailed(event.data.object as Stripe.Charge, requestId)
      break
    
    default:
      console.log(`[webhook:${requestId}] Unhandled event type: ${event.type}`)
      // Not an error - just log and continue
  }
}
