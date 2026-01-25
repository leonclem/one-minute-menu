import { createServerSupabaseClient, createAdminSupabaseClient } from './supabase-server'
import { DatabaseError } from './database'
import { PurchaseRecord } from '@/types'
import { notificationService } from './notification-service'
import { PLAN_CONFIGS } from '@/types'

/**
 * Utility for logging purchases and managing user packs/subscriptions
 * This is designed to be called by Stripe webhooks or checkout routes.
 * 
 * IMPORTANT: Fulfillment operations use the Admin Supabase client to bypass RLS,
 * as they are triggered by server-side webhooks.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 9.4, 9.5
 */

/**
 * Detect if a transaction is in test mode based on transaction ID
 * Stripe test mode transaction IDs typically start with specific prefixes
 * 
 * Requirements: 9.5
 */
export function isTestModeTransaction(transactionId: string): boolean {
  // Stripe test mode IDs have specific prefixes
  const testPrefixes = [
    'cs_test_',      // Checkout Session test
    'sub_test_',     // Subscription test
    'in_test_',      // Invoice test
    'pi_test_',      // Payment Intent test
    'ch_test_',      // Charge test
    'cus_test_',     // Customer test
  ]
  
  return testPrefixes.some(prefix => transactionId.startsWith(prefix))
}

export const purchaseLogger = {
  /**
   * Records a purchase in the audit trail
   * Ensures all required fields are included for complete audit logging
   * 
   * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
   */
  async logPurchase(record: Omit<PurchaseRecord, 'id' | 'createdAt'>): Promise<string> {
    const supabase = createAdminSupabaseClient()
    
    // Validate all required fields are present (Requirement 11.1, 11.2, 11.3, 11.4, 11.5)
    if (!record.userId) {
      throw new Error('Missing required field: userId')
    }
    if (!record.productId) {
      throw new Error('Missing required field: productId')
    }
    if (record.amountCents === undefined || record.amountCents === null) {
      throw new Error('Missing required field: amountCents')
    }
    if (!record.currency) {
      throw new Error('Missing required field: currency')
    }
    if (!record.status) {
      throw new Error('Missing required field: status')
    }
    
    const { data, error } = await supabase
      .from('purchase_audit')
      .insert({
        user_id: record.userId,
        transaction_id: record.transactionId,
        product_id: record.productId,
        amount_cents: record.amountCents,
        currency: record.currency,
        status: record.status,
        metadata: record.metadata || {}
      })
      .select('id')
      .single()
    
    if (error) {
      // Log error with full context (Requirement 12.2, 12.4)
      console.error('[purchase-logger] Failed to log purchase:', {
        userId: record.userId,
        transactionId: record.transactionId,
        productId: record.productId,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      })
      throw new DatabaseError(`Failed to log purchase: ${error.message}`, error.code)
    }
    
    return data.id
  },

  /**
   * Grants a Creator Pack to a user
   * Logs the grant in purchase_audit for complete audit trail
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  async grantCreatorPack(userId: string, metadata?: Record<string, any>): Promise<void> {
    const supabase = createAdminSupabaseClient()
    
    try {
      const { error } = await supabase
        .from('user_packs')
        .insert({
          user_id: userId,
          pack_type: 'creator_pack',
          expires_at: new Date(Date.now() + 24 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 24 months
          edit_window_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
          is_free_trial: metadata?.is_free || false,
          metadata
        })
      
      if (error) {
        // Log error with full context (Requirement 12.2, 12.4)
        console.error('[purchase-logger] Failed to grant creator pack:', {
          userId,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        })
        throw new DatabaseError(`Failed to grant creator pack: ${error.message}`, error.code)
      }
    } catch (error: any) {
      // Log error with full context (Requirement 12.2, 12.4)
      console.error('[purchase-logger] Exception granting creator pack:', {
        userId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  },

  /**
   * Updates a user's subscription plan
   * 
   * Requirements: 5.1, 5.2
   */
  async updateSubscription(userId: string, plan: 'grid_plus' | 'grid_plus_premium'): Promise<void> {
    const supabase = createAdminSupabaseClient()
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ plan })
        .eq('id', userId)
      
      if (error) {
        // Log error with full context (Requirement 12.2, 12.4)
        console.error('[purchase-logger] Failed to update subscription:', {
          userId,
          plan,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        })
        throw new DatabaseError(`Failed to update subscription: ${error.message}`, error.code)
      }
    } catch (error: any) {
      // Log error with full context (Requirement 12.2, 12.4)
      console.error('[purchase-logger] Exception updating subscription:', {
        userId,
        plan,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  },

  /**
   * Cancel a subscription and log the cancellation
   * Maintains access until period_end and sends notification email
   * 
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  async cancelSubscription(
    userId: string,
    stripeSubscriptionId: string,
    reason?: string,
    periodEnd?: Date
  ): Promise<void> {
    const supabase = createAdminSupabaseClient()
    
    try {
      // Log cancellation in purchase_audit (Requirement 8.4, 11.1)
      await this.logPurchase({
        userId,
        transactionId: `cancel_${stripeSubscriptionId}`,
        productId: 'subscription_cancellation',
        amountCents: 0,
        currency: 'usd',
        status: 'success',
        metadata: {
          action: 'subscription_cancelled',
          stripe_subscription_id: stripeSubscriptionId,
          reason: reason || 'user_requested',
          period_end: periodEnd?.toISOString(),
          cancelled_at: new Date().toISOString()
        }
      })

      // Send cancellation notification email (Requirement 8.4)
      if (periodEnd) {
        await notificationService.sendSubscriptionCancelledNotification(userId, periodEnd)
      }

      console.log('[purchase-logger] Subscription cancelled:', {
        userId,
        stripeSubscriptionId,
        reason,
        periodEnd: periodEnd?.toISOString(),
        timestamp: new Date().toISOString()
      })
    } catch (error: any) {
      // Log error with full context (Requirement 12.2, 12.4)
      console.error('[purchase-logger] Failed to cancel subscription:', {
        userId,
        stripeSubscriptionId,
        reason,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  },

  /**
   * Check if a transaction has already been processed (idempotency check)
   * 
   * Requirements: 4.6, 14.6
   */
  async checkIdempotency(transactionId: string): Promise<boolean> {
    const supabase = createAdminSupabaseClient()
    
    try {
      const { data, error } = await supabase
        .from('purchase_audit')
        .select('id')
        .eq('transaction_id', transactionId)
        .maybeSingle()

      if (error) {
        console.error('[purchase-logger] Error checking idempotency:', {
          transactionId,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        })
        throw new Error(`Failed to check idempotency: ${error.message}`)
      }

      return !!data
    } catch (error: any) {
      // Log error with full context (Requirement 12.2, 12.4)
      console.error('[purchase-logger] Exception checking idempotency:', {
        transactionId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  },

  /**
   * Fulfill a subscription purchase
   * Updates user profile, logs transaction, updates quotas, and sends confirmation email
   * 
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.4, 9.5
   */
  async fulfillSubscription(
    userId: string,
    plan: 'grid_plus' | 'grid_plus_premium',
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    transactionId: string,
    amountCents: number,
    isTestMode: boolean = false
  ): Promise<void> {
    const supabase = createAdminSupabaseClient()

    try {
      // Check idempotency (Requirement 4.6, 14.6)
      const alreadyProcessed = await this.checkIdempotency(transactionId)
      if (alreadyProcessed) {
        console.log('[purchase-logger] Transaction already processed:', transactionId)
        return
      }

      // Update user profile with subscription details (Requirement 5.1, 5.2, 5.3, 5.4)
      const planDefaults = PLAN_CONFIGS[plan]
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          plan,
          plan_limits: {
            menus: planDefaults.menus,
            items: planDefaults.menuItems,
            monthly_uploads: planDefaults.monthlyUploads,
            ai_image_generations: planDefaults.aiImageGenerations,
          },
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          subscription_status: 'active',
        })
        .eq('id', userId)

      if (profileError) {
        throw new DatabaseError(`Failed to update profile: ${profileError.message}`, profileError.code)
      }

      // Log transaction in purchase_audit (Requirement 5.5, 11.1, 9.5)
      await this.logPurchase({
        userId,
        transactionId,
        productId: plan,
        amountCents,
        currency: 'usd',
        status: 'success',
        metadata: {
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          action: 'subscription_activated',
          is_test_mode: isTestMode,
        },
      })

      // Update generation quotas based on plan (Requirement 5.6)
      // Use limits from central PLAN_CONFIGS to ensure consistency
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const resetDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

      const { error: quotaError } = await supabase
        .from('generation_quotas')
        .upsert({
          user_id: userId,
          plan, // CRITICAL: Fix null value error (Requirement 5.6)
          monthly_limit: PLAN_CONFIGS[plan].aiImageGenerations,
          current_usage: 0,
          reset_date: resetDate, // Use YYYY-MM-DD for DATE column
        }, {
          onConflict: 'user_id'
        })

      if (quotaError) {
        throw new DatabaseError(`Failed to update quotas: ${quotaError.message}`, quotaError.code)
      }

      // Send confirmation email (Requirement 5.5)
      await notificationService.sendSubscriptionConfirmation(userId, plan, amountCents)

      console.log('[purchase-logger] Subscription fulfilled:', {
        userId,
        plan,
        transactionId,
        isTestMode,
        timestamp: new Date().toISOString()
      })
    } catch (error: any) {
      // Log error with full context (Requirement 5.7, 12.2, 12.4)
      console.error('[purchase-logger] Failed to fulfill subscription:', {
        userId,
        plan,
        transactionId,
        isTestMode,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  },

  /**
   * Fulfill a Creator Pack purchase
   * Creates user pack record, logs transaction, and sends confirmation email
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.4, 9.5
   */
  async fulfillCreatorPack(
    userId: string,
    transactionId: string,
    amountCents: number,
    isFree: boolean = false,
    isTestMode: boolean = false
  ): Promise<void> {
    try {
      // Check idempotency (Requirement 4.6, 14.6)
      const alreadyProcessed = await this.checkIdempotency(transactionId)
      if (alreadyProcessed) {
        console.log('[purchase-logger] Transaction already processed:', transactionId)
        return
      }

      // Grant Creator Pack (Requirement 6.1, 6.2, 6.3)
      await this.grantCreatorPack(userId, {
        transaction_id: transactionId,
        amount_cents: amountCents,
        is_free: isFree,
        is_test_mode: isTestMode,
      })

      // Log transaction in purchase_audit (Requirement 6.4, 11.1, 9.5)
      await this.logPurchase({
        userId,
        transactionId,
        productId: 'creator_pack',
        amountCents,
        currency: 'usd',
        status: 'success',
        metadata: {
          pack_type: 'creator_pack',
          is_free: isFree,
          action: 'creator_pack_granted',
          is_test_mode: isTestMode,
        },
      })

      // Send confirmation email (Requirement 6.4)
      await notificationService.sendCreatorPackConfirmation(userId, isFree)

      console.log('[purchase-logger] Creator Pack fulfilled:', {
        userId,
        transactionId,
        isFree,
        isTestMode,
        timestamp: new Date().toISOString()
      })
    } catch (error: any) {
      // Log error with full context (Requirement 6.6, 12.2, 12.4)
      console.error('[purchase-logger] Failed to fulfill Creator Pack:', {
        userId,
        transactionId,
        isTestMode,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }
}
