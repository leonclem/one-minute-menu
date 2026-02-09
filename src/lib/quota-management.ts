import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { 
  QuotaStatus, 
  GenerationQuota, 
  User, 
  ImageGenerationRequest,
  GenerationAnalytics 
} from '@/types'
import { PLAN_CONFIGS } from '@/types'
import { DatabaseError, userOperations } from '@/lib/database'

/**
 * Quota Management Service for AI Image Generation
 * 
 * Handles:
 * - Checking user generation quotas based on plan
 * - Consuming quota when images are generated
 * - Monthly quota reset logic
 * - Warning notifications for users approaching limits
 * - Cost estimation for generation requests
 */
export class QuotaManagementService {
  
  /**
   * Check current quota status for a user
   */
  async checkQuota(userId: string): Promise<QuotaStatus> {
    const supabase = createServerSupabaseClient()
    
    // Get user profile to determine plan (default to 'free' if not found)
    const profile = await userOperations.getProfile(userId)
    const plan = (profile?.plan ?? 'free') as User['plan']
    
    // Get the effective limit including any active Creator Packs
    const { limit: effectiveLimit } = await userOperations.checkPlanLimits(userId, 'aiImageGenerations', profile || undefined)
    
    // Get or create quota record
    let quotaRecord = await this.getQuotaRecord(userId)
    if (!quotaRecord) {
      quotaRecord = await this.createQuotaRecord(userId, plan)
    }
    
    // If the monthly_limit in the record doesn't match the effective limit (e.g. after a pack purchase), update it
    if (quotaRecord.monthlyLimit !== effectiveLimit) {
      console.log(`[QuotaManagement] Syncing quota for user ${userId}: ${quotaRecord.monthlyLimit} -> ${effectiveLimit}`)
      const { data: updatedQuota, error: updateError } = await supabase
        .from('generation_quotas')
        .update({
          monthly_limit: effectiveLimit,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()
      
      if (updateError) {
        console.error(`[QuotaManagement] Failed to sync quota for user ${userId}:`, updateError)
      } else if (updatedQuota) {
        quotaRecord = this.transformQuotaFromDB(updatedQuota)
        console.log(`[QuotaManagement] Successfully synced quota for user ${userId}: ${quotaRecord.monthlyLimit}`)
      }
    }
    
    // Check if quota needs reset (new month)
    const now = new Date()
    const resetDate = new Date(quotaRecord.resetDate)
    
    if (now >= resetDate) {
      quotaRecord = await this.resetMonthlyQuota(userId)
    }
    
    const isUnlimited = quotaRecord.monthlyLimit === -1
    const remaining = isUnlimited ? 999999 : Math.max(0, quotaRecord.monthlyLimit - quotaRecord.currentUsage)
    const warningThreshold = isUnlimited ? 999999 : Math.floor(quotaRecord.monthlyLimit * 0.8)
    
    return {
      userId,
      plan,
      limit: quotaRecord.monthlyLimit,
      used: quotaRecord.currentUsage,
      remaining,
      resetDate: quotaRecord.resetDate,
      warningThreshold,
      needsUpgrade: !isUnlimited && remaining === 0 && quotaRecord.monthlyLimit > 0
    }
  }
  
  /**
   * Consume quota when generating images
   */
  async consumeQuota(userId: string, count: number = 1): Promise<QuotaStatus> {
    const supabase = createServerSupabaseClient()
    
    // Check current quota first
    const currentQuota = await this.checkQuota(userId)
    
    if (currentQuota.remaining < count) {
      throw new DatabaseError(
        `Insufficient quota. Requested: ${count}, Available: ${currentQuota.remaining}`,
        'QUOTA_EXCEEDED'
      )
    }
    
    // Update usage
    const { data, error } = await supabase
      .from('generation_quotas')
      .update({
        current_usage: currentQuota.used + count,
        last_generation_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to consume quota: ${error.message}`, error.code)
    }
    
    // Return updated quota status
    return this.checkQuota(userId)
  }
  
  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId: string): Promise<{
    currentMonth: {
      total: number
      successful: number
      failed: number
      variations: number
    }
    previousMonth: {
      total: number
      successful: number
    }
    allTime: {
      total: number
      estimatedCost: number
    }
  }> {
    const supabase = createServerSupabaseClient()
    
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    
    // Current month stats
    const { data: currentMonthJobs, error: currentError } = await supabase
      .from('image_generation_jobs')
      .select('status, number_of_variations, result_count, estimated_cost')
      .eq('user_id', userId)
      .gte('created_at', currentMonthStart.toISOString())
    
    if (currentError) {
      throw new DatabaseError(`Failed to get current month stats: ${currentError.message}`, currentError.code)
    }
    
    // Previous month stats
    const { data: previousMonthJobs, error: previousError } = await supabase
      .from('image_generation_jobs')
      .select('status')
      .eq('user_id', userId)
      .gte('created_at', previousMonthStart.toISOString())
      .lt('created_at', previousMonthEnd.toISOString())
    
    if (previousError) {
      throw new DatabaseError(`Failed to get previous month stats: ${previousError.message}`, previousError.code)
    }
    
    // All time stats
    const { data: allTimeJobs, error: allTimeError } = await supabase
      .from('image_generation_jobs')
      .select('status, estimated_cost')
      .eq('user_id', userId)
    
    if (allTimeError) {
      throw new DatabaseError(`Failed to get all time stats: ${allTimeError.message}`, allTimeError.code)
    }
    
    // Calculate current month stats
    const currentMonth = {
      total: currentMonthJobs.length,
      successful: currentMonthJobs.filter(job => job.status === 'completed').length,
      failed: currentMonthJobs.filter(job => job.status === 'failed').length,
      variations: currentMonthJobs.reduce((sum, job) => sum + (job.result_count || job.number_of_variations || 1), 0)
    }
    
    // Calculate previous month stats
    const previousMonth = {
      total: previousMonthJobs.length,
      successful: previousMonthJobs.filter(job => job.status === 'completed').length
    }
    
    // Calculate all time stats
    const allTime = {
      total: allTimeJobs.length,
      estimatedCost: allTimeJobs.reduce((sum, job) => sum + (job.estimated_cost || 0), 0)
    }
    
    return {
      currentMonth,
      previousMonth,
      allTime
    }
  }
  
  /**
   * Reset monthly quota (called automatically when checking quota)
   */
  async resetMonthlyQuota(userId: string): Promise<GenerationQuota> {
    const supabase = createServerSupabaseClient()
    
    // Get user plan to determine profile (default to 'free' if not found)
    const profile = await userOperations.getProfile(userId)
    const plan = (profile?.plan ?? 'free') as User['plan']
    
    // Get the effective limit including any active Creator Packs
    const { limit: effectiveLimit } = await userOperations.checkPlanLimits(userId, 'aiImageGenerations', profile || undefined)
    
    // Calculate next reset date (first day of next month)
    const now = new Date()
    const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    
    const { data, error } = await supabase
      .from('generation_quotas')
      .update({
        plan,
        monthly_limit: effectiveLimit,
        current_usage: 0,
        reset_date: nextResetDate.toISOString().split('T')[0], // Date only
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to reset quota: ${error.message}`, error.code)
    }
    
    return this.transformQuotaFromDB(data)
  }
  
  /**
   * Estimate cost for a generation request
   */
  async estimateCost(request: ImageGenerationRequest): Promise<{
    perImage: number
    totalImages: number
    estimatedTotal: number
    currency: string
  }> {
    // Nano Banana pricing (estimated - should be configurable)
    const costPerImage = 0.02 // $0.02 per image
    const numberOfImages = request.numberOfVariations || 1
    
    return {
      perImage: costPerImage,
      totalImages: numberOfImages,
      estimatedTotal: costPerImage * numberOfImages,
      currency: 'USD'
    }
  }
  
  /**
   * Check if user is approaching quota limit (80% threshold)
   */
  async checkWarningThreshold(userId: string): Promise<boolean> {
    const quota = await this.checkQuota(userId)
    return quota.used >= quota.warningThreshold
  }
  
  /**
   * Get or create quota record for user
   */
  private async getQuotaRecord(userId: string): Promise<GenerationQuota | null> {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('generation_quotas')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new DatabaseError(`Failed to get quota record: ${error.message}`, error.code)
    }
    
    return this.transformQuotaFromDB(data)
  }
  
  /**
   * Create initial quota record for user
   */
  private async createQuotaRecord(userId: string, plan: User['plan']): Promise<GenerationQuota> {
    const supabase = createServerSupabaseClient()
    
    // Get user profile to determine plan (default to 'free' if not found)
    const profile = await userOperations.getProfile(userId)
    
    // Get the effective limit including any active Creator Packs
    const { limit: effectiveLimit } = await userOperations.checkPlanLimits(userId, 'aiImageGenerations', profile || undefined)
    
    // Calculate next reset date (first day of next month)
    const now = new Date()
    const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    
    const { data, error } = await supabase
      .from('generation_quotas')
      .insert({
        user_id: userId,
        plan,
        monthly_limit: effectiveLimit,
        current_usage: 0,
        reset_date: nextResetDate.toISOString().split('T')[0], // Date only
      })
      .select()
      .single()
    
    if (error) {
      throw new DatabaseError(`Failed to create quota record: ${error.message}`, error.code)
    }
    
    return this.transformQuotaFromDB(data)
  }
  
  /**
   * Transform database record to GenerationQuota type
   */
  private transformQuotaFromDB(data: any): GenerationQuota {
    return {
      id: data.id,
      userId: data.user_id,
      plan: data.plan,
      monthlyLimit: data.monthly_limit,
      currentUsage: data.current_usage,
      resetDate: new Date(data.reset_date),
      lastGenerationAt: data.last_generation_at ? new Date(data.last_generation_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}

// Export singleton instance
export const quotaManagementService = new QuotaManagementService()

// Export individual functions for backward compatibility
export const quotaOperations = {
  checkQuota: (userId: string) => quotaManagementService.checkQuota(userId),
  consumeQuota: (userId: string, count?: number) => quotaManagementService.consumeQuota(userId, count),
  getUsageStats: (userId: string) => quotaManagementService.getUsageStats(userId),
  resetMonthlyQuota: (userId: string) => quotaManagementService.resetMonthlyQuota(userId),
  estimateCost: (request: ImageGenerationRequest) => quotaManagementService.estimateCost(request),
  checkWarningThreshold: (userId: string) => quotaManagementService.checkWarningThreshold(userId)
}