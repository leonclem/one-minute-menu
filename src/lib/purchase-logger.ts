import { createServerSupabaseClient } from './supabase-server'
import { DatabaseError } from './database'
import { PurchaseRecord } from '@/types'

/**
 * Utility for logging purchases and managing user packs/subscriptions
 * This is designed to be called by Stripe webhooks or checkout routes.
 */
export const purchaseLogger = {
  /**
   * Records a successful purchase in the audit trail
   */
  async logPurchase(record: Omit<PurchaseRecord, 'id' | 'createdAt'>): Promise<string> {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('purchase_audit')
      .insert({
        user_id: record.userId,
        transaction_id: record.transactionId,
        product_id: record.productId,
        amount_cents: record.amountCents,
        currency: record.currency,
        status: record.status,
        metadata: record.metadata
      })
      .select('id')
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to log purchase: ${error.message}`, error.code)
    }
    
    return data.id
  },

  /**
   * Grants a Creator Pack to a user
   */
  async grantCreatorPack(userId: string, metadata?: Record<string, any>): Promise<void> {
    const supabase = createServerSupabaseClient()
    
    const { error } = await supabase
      .from('user_packs')
      .insert({
        user_id: userId,
        pack_type: 'creator_pack',
        expires_at: new Date(Date.now() + 24 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 24 months
        edit_window_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
        metadata
      })
    
    if (error) {
      throw new DatabaseError(`Failed to grant creator pack: ${error.message}`, error.code)
    }
  },

  /**
   * Updates a user's subscription plan
   */
  async updateSubscription(userId: string, plan: 'grid_plus' | 'grid_plus_premium'): Promise<void> {
    const supabase = createServerSupabaseClient()
    
    const { error } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', userId)
    
    if (error) {
      throw new DatabaseError(`Failed to update subscription: ${error.message}`, error.code)
    }
  }
}
