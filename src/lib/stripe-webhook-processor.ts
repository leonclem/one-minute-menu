import Stripe from 'stripe'
import { createAdminSupabaseClient } from './supabase-server'
import { purchaseLogger } from './purchase-logger'
import { notificationService } from './notification-service'

/**
 * Webhook Event Processor
 * 
 * Processes different Stripe webhook event types and fulfills purchases.
 * All operations are idempotent to handle retries safely.
 * 
 * Requirements: 4.3, 4.4, 4.5, 8.5, 15.6
 */

/**
 * Process checkout.session.completed event
 * This is where we fulfill purchases after successful payment
 * 
 * Requirements: 4.3, 4.4, 4.5, 9.4, 9.5
 */
export async function processCheckoutCompleted(
  session: Stripe.Checkout.Session,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing checkout.session.completed: ${session.id}`)
  
  // Extract metadata (Requirement 4.3)
  let userId = session.metadata?.user_id
  const productType = session.metadata?.product_type

  if (!productType) {
    throw new Error(`Missing product_type in checkout session metadata`)
  }

  // Handle guest checkout (missing user_id)
  if (!userId) {
    console.log(`[webhook:${requestId}] Guest checkout detected, creating user account...`)
    const email = session.customer_details?.email
    
    if (!email) {
      throw new Error(`No customer email found in checkout session ${session.id}`)
    }

    const adminSupabase = createAdminSupabaseClient()
    
    // Create new user (this will also trigger the profile creation via DB trigger)
    // If user already exists, this will return an error, which we handle
    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        created_via: 'stripe_checkout',
        session_id: session.id,
      }
    })

    if (createError) {
      // Check if it's because the user already exists
      if (createError.message.includes('already registered')) {
        // Try to find the user
        const { data: users, error: listError } = await adminSupabase.auth.admin.listUsers()
        const user = users.users.find(u => u.email === email)
        if (user) {
          userId = user.id
          console.log(`[webhook:${requestId}] Existing user found for guest checkout: ${userId}`)
        } else {
          throw new Error(`User already registered but could not be found: ${email}`)
        }
      } else {
        console.error(`[webhook:${requestId}] Failed to create user for guest checkout:`, createError)
        throw new Error(`Failed to create user: ${createError.message}`)
      }
    } else if (newUser.user) {
      userId = newUser.user.id
      console.log(`[webhook:${requestId}] New user created for guest checkout: ${userId}`)
    } else {
      throw new Error(`Failed to create user: No user returned and no error`)
    }
  }

  const transactionId = session.id
  const amountCents = session.amount_total || 0
  const customerId = session.customer as string

  // Link Stripe Customer ID to Profile if not already linked
  const adminSupabaseClient = createAdminSupabaseClient()
  await adminSupabaseClient
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId)
    .is('stripe_customer_id', null)
  
  // Detect test mode (Requirements 9.4, 9.5)
  const isTestMode = !session.livemode

  // Route to appropriate fulfillment function (Requirement 4.4, 4.5)
  // Note: All fulfillment functions are idempotent and perform their own checks
  if (productType === 'creator_pack') {
    await purchaseLogger.fulfillCreatorPack(userId, transactionId, amountCents, false, isTestMode)
  } else if (productType === 'grid_plus' || productType === 'grid_plus_premium') {
    const subscriptionId = session.subscription as string
    await purchaseLogger.fulfillSubscription(
      userId,
      productType,
      customerId,
      subscriptionId,
      transactionId,
      amountCents,
      isTestMode
    )
  } else {
    throw new Error(`Unknown product type: ${productType}`)
  }

  console.log(`[webhook:${requestId}] Successfully fulfilled ${productType} for user ${userId} (test mode: ${isTestMode})`)
}

/**
 * Process customer.subscription.created event
 * Store subscription ID in user profile
 * 
 * Requirements: 8.5
 */
export async function processSubscriptionCreated(
  subscription: Stripe.Subscription,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing customer.subscription.created: ${subscription.id}`)
  
  const customerId = subscription.customer as string
  const supabase = createAdminSupabaseClient()

  // Find user by stripe_customer_id
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !profile) {
    console.log(`[webhook:${requestId}] User not found for customer ${customerId}. This may be a race condition; checkout fulfillment will handle this.`)
    return
  }

  // Update subscription status
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error(`[webhook:${requestId}] Failed to update subscription:`, updateError)
    throw new Error(`Failed to update subscription: ${updateError.message}`)
  }

  console.log(`[webhook:${requestId}] Subscription ${subscription.id} stored for user ${profile.id}`)
}

/**
 * Process customer.subscription.updated event
 * Handle plan changes and status updates
 * 
 * Requirements: 15.6
 */
export async function processSubscriptionUpdated(
  subscription: Stripe.Subscription,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing customer.subscription.updated: ${subscription.id}`)
  
  const customerId = subscription.customer as string
  const supabase = createAdminSupabaseClient()

  // Find user by stripe_customer_id
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !profile) {
    console.log(`[webhook:${requestId}] User not found for customer ${customerId}. This may be a race condition during update.`)
    return
  }

  // Update subscription status and period end
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: subscription.status,
      subscription_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error(`[webhook:${requestId}] Failed to update subscription:`, updateError)
    throw new Error(`Failed to update subscription: ${updateError.message}`)
  }

  console.log(`[webhook:${requestId}] Subscription ${subscription.id} updated for user ${profile.id}`)
}

/**
 * Process customer.subscription.deleted event
 * Downgrade user to free plan while maintaining access until period_end
 * 
 * Requirements: 8.5
 */
export async function processSubscriptionDeleted(
  subscription: Stripe.Subscription,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing customer.subscription.deleted: ${subscription.id}`)
  
  const customerId = subscription.customer as string
  const supabase = createAdminSupabaseClient()

  // Find user by stripe_customer_id
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !profile) {
    console.log(`[webhook:${requestId}] User not found for customer ${customerId} during deletion.`)
    return
  }

  // Update subscription status to canceled
  // Note: Access is maintained until period_end (handled by subscription_period_end field)
  const periodEnd = new Date((subscription as any).current_period_end * 1000)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      subscription_period_end: periodEnd.toISOString(),
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error(`[webhook:${requestId}] Failed to update subscription:`, updateError)
    throw new Error(`Failed to update subscription: ${updateError.message}`)
  }

  // Log cancellation and send notification email
  await purchaseLogger.cancelSubscription(
    profile.id,
    subscription.id,
    (subscription as any).cancellation_details?.reason || 'unknown',
    periodEnd
  )

  console.log(`[webhook:${requestId}] Subscription ${subscription.id} canceled for user ${profile.id}`)
}

/**
 * Process invoice.payment_succeeded event
 * Log successful recurring payment
 * 
 * Requirements: 8.5, 9.4, 9.5
 */
export async function processInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing invoice.payment_succeeded: ${invoice.id}`)
  
  const customerId = invoice.customer as string
  const supabase = createAdminSupabaseClient()

  // Find user by stripe_customer_id
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !profile) {
    console.log(`[webhook:${requestId}] User not found for customer ${customerId}`)
    // Don't throw - this might be a customer without a profile yet
    return
  }

  // Detect test mode (Requirements 9.4, 9.5)
  const isTestMode = !invoice.livemode

  // Log successful payment
  await purchaseLogger.logPurchase({
    userId: profile.id,
    transactionId: invoice.id,
    productId: ((invoice as any).subscription as string) || 'unknown',
    amountCents: (invoice as any).amount_paid,
    currency: invoice.currency,
    status: 'success',
    metadata: {
      action: 'recurring_payment',
      invoice_id: invoice.id,
      subscription_id: (invoice as any).subscription,
      period_start: (invoice as any).period_start,
      period_end: (invoice as any).period_end,
      is_test_mode: isTestMode,
    },
  })

  console.log(`[webhook:${requestId}] Invoice ${invoice.id} payment logged for user ${profile.id} (test mode: ${isTestMode})`)
}

/**
 * Process invoice.payment_failed event
 * Log failed payment and update subscription status
 * 
 * Requirements: 8.5, 9.4, 9.5
 */
export async function processInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing invoice.payment_failed: ${invoice.id}`)
  
  const customerId = invoice.customer as string
  const supabase = createAdminSupabaseClient()

  // Find user by stripe_customer_id
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !profile) {
    console.log(`[webhook:${requestId}] User not found for customer ${customerId}`)
    return
  }

  // Update subscription status to past_due
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', profile.id)

  if (updateError) {
    console.error(`[webhook:${requestId}] Failed to update subscription status:`, updateError)
  }

  // Detect test mode (Requirements 9.4, 9.5)
  const isTestMode = !invoice.livemode

  // Log failed payment
  await purchaseLogger.logPurchase({
    userId: profile.id,
    transactionId: invoice.id,
    productId: ((invoice as any).subscription as string) || 'unknown',
    amountCents: (invoice as any).amount_due,
    currency: invoice.currency,
    status: 'failed',
    metadata: {
      action: 'payment_failed',
      invoice_id: invoice.id,
      subscription_id: (invoice as any).subscription,
      attempt_count: (invoice as any).attempt_count,
      next_payment_attempt: (invoice as any).next_payment_attempt,
      is_test_mode: isTestMode,
    },
  })

  // Send payment failed notification email
  const failureReason = (invoice as any).last_payment_error?.message || 'Payment declined'
  await notificationService.sendPaymentFailedNotification(profile.id, failureReason)

  console.log(`[webhook:${requestId}] Invoice ${invoice.id} payment failure logged for user ${profile.id} (test mode: ${isTestMode})`)
}

/**
 * Process payment_intent.succeeded event
 * Log successful payment intent (one-time or subscription)
 */
export async function processPaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing payment_intent.succeeded: ${paymentIntent.id}`)
  
  // We usually fulfill via checkout.session.completed or invoice.payment_succeeded
  // This is just for additional logging/audit
  const customerId = paymentIntent.customer as string
  if (!customerId) return

  const supabase = createAdminSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) return

  const isTestMode = !paymentIntent.livemode

  await purchaseLogger.logPurchase({
    userId: profile.id,
    transactionId: paymentIntent.id,
    productId: (paymentIntent.metadata?.product_type as string) || 'payment_intent',
    amountCents: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    status: 'success',
    metadata: {
      action: 'payment_intent_succeeded',
      payment_method_type: paymentIntent.payment_method_types?.[0],
      is_test_mode: isTestMode,
    },
  })
}

/**
 * Process payment_intent.payment_failed event
 * Log failed payment intent and notify user
 */
export async function processPaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing payment_intent.payment_failed: ${paymentIntent.id}`)
  
  const customerId = paymentIntent.customer as string
  if (!customerId) {
    console.log(`[webhook:${requestId}] No customer ID on payment intent ${paymentIntent.id}`)
    return
  }

  const supabase = createAdminSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.log(`[webhook:${requestId}] No user profile found for customer ${customerId}`)
    return
  }

  const isTestMode = !paymentIntent.livemode
  const failureReason = paymentIntent.last_payment_error?.message || 'Payment declined'

  // Log failure
  await purchaseLogger.logPurchase({
    userId: profile.id,
    transactionId: paymentIntent.id,
    productId: (paymentIntent.metadata?.product_type as string) || 'payment_intent',
    amountCents: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: 'failed',
    metadata: {
      action: 'payment_intent_failed',
      failure_reason: failureReason,
      failure_code: paymentIntent.last_payment_error?.code,
      payment_method_type: paymentIntent.last_payment_error?.payment_method?.type,
      is_test_mode: isTestMode,
    },
  })

  // Notify user
  await notificationService.sendPaymentFailedNotification(profile.id, failureReason)

  console.log(`[webhook:${requestId}] Payment intent ${paymentIntent.id} failure logged for user ${profile.id}`)
}

/**
 * Process charge.failed event
 * Detailed logging of why a specific charge failed
 */
export async function processChargeFailed(
  charge: Stripe.Charge,
  requestId: string
): Promise<void> {
  console.log(`[webhook:${requestId}] Processing charge.failed: ${charge.id}`)
  
  const customerId = charge.customer as string
  if (!customerId) return

  const supabase = createAdminSupabaseClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) return

  const isTestMode = !charge.livemode
  const failureReason = charge.failure_message || 'Charge declined'

  // Log failure specifically for the charge
  await purchaseLogger.logPurchase({
    userId: profile.id,
    transactionId: charge.id,
    productId: (charge.metadata?.product_type as string) || 'charge',
    amountCents: charge.amount,
    currency: charge.currency,
    status: 'failed',
    metadata: {
      action: 'charge_failed',
      failure_reason: failureReason,
      failure_code: charge.failure_code,
      payment_intent: charge.payment_intent,
      is_test_mode: isTestMode,
    },
  })
}

/**
 * Check if a transaction has already been processed (idempotency check)
 * 
 * Requirements: 4.6, 14.6
 */
async function checkIdempotency(transactionId: string): Promise<boolean> {
  return purchaseLogger.checkIdempotency(transactionId)
}

/**
 * Get the date for next month (for quota reset)
 */
function getNextMonthDate(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`
}
