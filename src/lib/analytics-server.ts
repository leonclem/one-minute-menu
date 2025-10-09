// Server-side analytics operations

import { createServerSupabaseClient } from './supabase-server'

/**
 * Server-side analytics operations
 */
export const analyticsOperations = {
  /**
   * Record a menu view in the database
   * Aggregates views by date and menu
   */
  async recordMenuView(menuId: string, visitorId: string): Promise<void> {
    const supabase = createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    
    console.log(`Recording menu view: menuId=${menuId}, visitorId=${visitorId}, date=${today}`)
    
    // Get or create today's analytics record
    const { data: existing, error: selectError } = await supabase
      .from('menu_analytics')
      .select('*')
      .eq('menu_id', menuId)
      .eq('date', today)
      .single()
    
    console.log('Existing record:', existing, 'Error:', selectError)
    
    if (existing) {
      // Update existing record
      // Track unique visitors using a simple set stored in metadata
      const uniqueVisitors = new Set(existing.unique_visitors_ids || [])
      uniqueVisitors.add(visitorId)
      
      const updateData = {
        page_views: existing.page_views + 1,
        unique_visitors: uniqueVisitors.size,
        unique_visitors_ids: Array.from(uniqueVisitors),
      }
      
      console.log('Updating existing record with:', updateData)
      
      const { error: updateError } = await supabase
        .from('menu_analytics')
        .update(updateData)
        .eq('id', existing.id)
      
      if (updateError) {
        console.error('Update error:', updateError)
        throw updateError
      }
    } else {
      // Create new record
      const insertData = {
        menu_id: menuId,
        date: today,
        page_views: 1,
        unique_visitors: 1,
        unique_visitors_ids: [visitorId],
      }
      
      console.log('Creating new record with:', insertData)
      
      const { error: insertError } = await supabase
        .from('menu_analytics')
        .insert(insertData)
      
      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }
    }
  },

  /**
   * Get analytics for a specific menu
   */
  async getMenuAnalytics(menuId: string, days: number = 7): Promise<MenuAnalyticsData[]> {
    const supabase = createServerSupabaseClient()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('menu_analytics')
      .select('date, page_views, unique_visitors')
      .eq('menu_id', menuId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true })
    
    if (error) throw error
    
    return data || []
  },

  /**
   * Get summary analytics for a menu
   */
  async getMenuAnalyticsSummary(menuId: string): Promise<MenuAnalyticsSummary> {
    const supabase = createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    // Get today's stats
    const { data: todayData } = await supabase
      .from('menu_analytics')
      .select('page_views, unique_visitors')
      .eq('menu_id', menuId)
      .eq('date', today)
      .single()
    
    // Get last 7 days stats
    const { data: weekData } = await supabase
      .from('menu_analytics')
      .select('page_views, unique_visitors')
      .eq('menu_id', menuId)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    
    const weekTotal = weekData?.reduce(
      (acc, day) => ({
        pageViews: acc.pageViews + day.page_views,
        uniqueVisitors: acc.uniqueVisitors + day.unique_visitors,
      }),
      { pageViews: 0, uniqueVisitors: 0 }
    ) || { pageViews: 0, uniqueVisitors: 0 }
    
    return {
      today: {
        pageViews: todayData?.page_views || 0,
        uniqueVisitors: todayData?.unique_visitors || 0,
      },
      last7Days: weekTotal,
    }
  },

  /**
   * Track platform-level metrics for admin monitoring
   */
  async trackPlatformMetric(
    metricName: string,
    metricValue: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    
    await supabase
      .from('platform_analytics')
      .upsert({
        date: today,
        metric_name: metricName,
        metric_value: metricValue,
        metadata: metadata || {},
      }, {
        onConflict: 'date,metric_name',
      })
  },

  /**
   * Get platform analytics for admin dashboard
   */
  async getPlatformAnalytics(days: number = 30): Promise<PlatformAnalyticsData[]> {
    const supabase = createServerSupabaseClient()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const { data, error } = await supabase
      .from('platform_analytics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true })
    
    if (error) throw error
    
    return data || []
  },

  /**
   * Record a successful AI image generation into daily generation analytics
   */
  async recordGenerationSuccess(
    userId: string,
    variations: number,
    cost: number,
    processingTimeMs?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.upsertGenerationAnalytics(userId, {
      successful_generations: 1,
      failed_generations: 0,
      total_variations: variations,
      estimated_cost: cost,
      processing_time: processingTimeMs,
      metadata,
    })
  },

  /**
   * Record a failed AI image generation into daily generation analytics
   */
  async recordGenerationFailure(
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.upsertGenerationAnalytics(userId, {
      successful_generations: 0,
      failed_generations: 1,
      total_variations: 0,
      estimated_cost: 0,
      processing_time: undefined,
      metadata,
    })
  },

  /**
   * Helper to upsert generation_analytics for current date
   */
  async upsertGenerationAnalytics(
    userId: string,
    delta: {
      successful_generations: number
      failed_generations: number
      total_variations: number
      estimated_cost: number
      processing_time?: number
      metadata?: Record<string, any>
    }
  ): Promise<void> {
    const supabase = createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: existing } = await supabase
      .from('generation_analytics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    if (existing) {
      const success = (existing.successful_generations || 0) + delta.successful_generations
      const failed = (existing.failed_generations || 0) + delta.failed_generations
      const variations = (existing.total_variations || 0) + delta.total_variations
      const cost = Number(existing.estimated_cost || 0) + Number(delta.estimated_cost || 0)

      // Recompute average processing time using weighted average over successful only
      const existingSuccess = existing.successful_generations || 0
      const existingAvg = existing.avg_processing_time || 0
      const newAvg = delta.processing_time != null && delta.successful_generations > 0
        ? Math.round(((existingAvg * existingSuccess) + delta.processing_time) / (existingSuccess + delta.successful_generations))
        : existingAvg

      // Merge metadata (shallow)
      const mergedMetadata = {
        ...(existing.metadata || {}),
        ...(delta.metadata || {}),
      }

      await supabase
        .from('generation_analytics')
        .update({
          successful_generations: success,
          failed_generations: failed,
          total_variations: variations,
          estimated_cost: cost,
          avg_processing_time: newAvg,
          metadata: mergedMetadata,
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('generation_analytics')
        .insert({
          user_id: userId,
          date: today,
          successful_generations: delta.successful_generations,
          failed_generations: delta.failed_generations,
          total_variations: delta.total_variations,
          estimated_cost: delta.estimated_cost,
          avg_processing_time: delta.processing_time ?? null,
          metadata: delta.metadata || {},
        })
    }
  },

  /**
   * Get per-day generation analytics for a user
   */
  async getGenerationAnalytics(userId: string, days: number = 30): Promise<any[]> {
    const supabase = createServerSupabaseClient()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('generation_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Admin: Get platform-wide generation analytics over a period and computed totals
   */
  async getGenerationAnalyticsAdmin(days: number = 30): Promise<{
    rows: any[]
    totals: {
      totalGenerations: number
      successful: number
      failed: number
      totalVariations: number
      estimatedCost: number
      successRate: number
      avgProcessingTime?: number
      byPlan?: Record<string, { cost: number; generations: number }>
    }
  }> {
    const supabase = createServerSupabaseClient()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('generation_analytics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (error) throw error
    const rows = data || []

    const successful = rows.reduce((s, r) => s + (r.successful_generations || 0), 0)
    const failed = rows.reduce((s, r) => s + (r.failed_generations || 0), 0)
    const totalGenerations = successful + failed
    const totalVariations = rows.reduce((s, r) => s + (r.total_variations || 0), 0)
    const estimatedCost = rows.reduce((s, r) => s + Number(r.estimated_cost || 0), 0)

    // Weighted average processing time across successful generations
    let weightedSum = 0
    rows.forEach(r => {
      if (r.avg_processing_time && r.successful_generations) {
        weightedSum += r.avg_processing_time * r.successful_generations
      }
    })
    const avgProcessingTime = successful > 0 ? Math.round(weightedSum / successful) : undefined

    // Optional: breakdown by plan (join profiles)
    let byPlan: Record<string, { cost: number; generations: number }> | undefined
    const userIds = Array.from(new Set(rows.map(r => r.user_id)))
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, plan')
        .in('id', userIds)
      const planByUser = new Map<string, string>((profiles || []).map(p => [p.id, p.plan]))
      byPlan = {}
      rows.forEach(r => {
        const plan = planByUser.get(r.user_id) || 'unknown'
        if (!byPlan![plan]) byPlan![plan] = { cost: 0, generations: 0 }
        byPlan![plan].cost += Number(r.estimated_cost || 0)
        byPlan![plan].generations += (r.successful_generations || 0) + (r.failed_generations || 0)
      })
    }

    return {
      rows,
      totals: {
        totalGenerations,
        successful,
        failed,
        totalVariations,
        estimatedCost,
        successRate: totalGenerations > 0 ? successful / totalGenerations : 0,
        avgProcessingTime,
        byPlan,
      }
    }
  },

  /**
   * Check if generation costs exceeded alert thresholds; record a platform metric if so
   */
  async checkGenerationCostThresholds(): Promise<void> {
    const dailyThreshold = Number(process.env.GENERATION_ALERT_DAILY_USD || '0')
    const monthlyThreshold = Number(process.env.GENERATION_ALERT_MONTHLY_USD || '0')
    if (!dailyThreshold && !monthlyThreshold) return

    const supabase = createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date()
    monthStart.setDate(1)

    // Sum today's cost
    const { data: todayRows } = await supabase
      .from('generation_analytics')
      .select('estimated_cost')
      .eq('date', today)
    const todayCost = (todayRows || []).reduce((s, r: any) => s + Number(r.estimated_cost || 0), 0)

    // Sum this month's cost
    const { data: monthRows } = await supabase
      .from('generation_analytics')
      .select('estimated_cost, date')
      .gte('date', monthStart.toISOString().split('T')[0])
    const monthCost = (monthRows || []).reduce((s, r: any) => s + Number(r.estimated_cost || 0), 0)

    if (dailyThreshold && todayCost > dailyThreshold) {
      await this.trackPlatformMetric('generation_cost_alerts', 1, {
        scope: 'daily',
        threshold: dailyThreshold,
        value: todayCost,
        date: today,
      })
      // eslint-disable-next-line no-console
      console.warn('[alerts] Daily generation cost threshold exceeded', { dailyThreshold, todayCost })
    }

    if (monthlyThreshold && monthCost > monthlyThreshold) {
      await this.trackPlatformMetric('generation_cost_alerts', 1, {
        scope: 'monthly',
        threshold: monthlyThreshold,
        value: monthCost,
        month: monthStart.toISOString().slice(0, 7),
      })
      // eslint-disable-next-line no-console
      console.warn('[alerts] Monthly generation cost threshold exceeded', { monthlyThreshold, monthCost })
    }
  },

  /**
   * Track geographic usage for compliance monitoring
   */
  async trackGeographicUsage(
    countryCode: string,
    registrations: number = 0,
    activeUsers: number = 0
  ): Promise<void> {
    const supabase = createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    
    const { data: existing } = await supabase
      .from('geographic_usage')
      .select('*')
      .eq('date', today)
      .eq('country_code', countryCode)
      .single()
    
    if (existing) {
      await supabase
        .from('geographic_usage')
        .update({
          registrations: existing.registrations + registrations,
          active_users: existing.active_users + activeUsers,
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('geographic_usage')
        .insert({
          date: today,
          country_code: countryCode,
          registrations,
          active_users: activeUsers,
        })
    }
  },
}

// Type definitions
export interface MenuAnalyticsData {
  date: string
  page_views: number
  unique_visitors: number
}

export interface MenuAnalyticsSummary {
  today: {
    pageViews: number
    uniqueVisitors: number
  }
  last7Days: {
    pageViews: number
    uniqueVisitors: number
  }
}

export interface PlatformAnalyticsData {
  id: string
  date: string
  metric_name: string
  metric_value: number
  metadata: Record<string, any>
  created_at: string
}
