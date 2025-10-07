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
