// Cookieless analytics implementation using rotating localStorage identifiers
// No cookies, no IP addresses, only aggregated counts

import { createServerSupabaseClient } from './supabase-server'

/**
 * Generate a rotating visitor identifier that changes daily
 * This provides approximate unique visitor counts without persistent tracking
 */
export function generateRotatingVisitorId(): string {
  const today = new Date().toISOString().split('T')[0]
  const randomSeed = Math.random().toString(36).substring(2, 15)
  return `${today}-${randomSeed}`
}

/**
 * Get or create a visitor identifier from localStorage
 * Identifier rotates daily to prevent long-term tracking
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  
  const storageKey = 'qr_menu_visitor_id'
  const storedData = localStorage.getItem(storageKey)
  
  if (storedData) {
    try {
      const { id, date } = JSON.parse(storedData)
      const today = new Date().toISOString().split('T')[0]
      
      // If the stored ID is from today, reuse it
      if (date === today) {
        return id
      }
    } catch (e) {
      // Invalid data, generate new ID
    }
  }
  
  // Generate new ID for today
  const newId = generateRotatingVisitorId()
  const today = new Date().toISOString().split('T')[0]
  
  localStorage.setItem(storageKey, JSON.stringify({ id: newId, date: today }))
  
  return newId
}

/**
 * Track a menu view (client-side)
 * Sends minimal data: menu ID and rotating visitor ID
 */
export async function trackMenuView(menuId: string): Promise<void> {
  try {
    const visitorId = getVisitorId()
    
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menuId,
        visitorId,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    // Silently fail - analytics should never break the user experience
    console.error('Analytics tracking failed:', error)
  }
}

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
    
    // Get or create today's analytics record
    const { data: existing } = await supabase
      .from('menu_analytics')
      .select('*')
      .eq('menu_id', menuId)
      .eq('date', today)
      .single()
    
    if (existing) {
      // Update existing record
      // Track unique visitors using a simple set stored in metadata
      const uniqueVisitors = new Set(existing.unique_visitors_ids || [])
      uniqueVisitors.add(visitorId)
      
      await supabase
        .from('menu_analytics')
        .update({
          page_views: existing.page_views + 1,
          unique_visitors: uniqueVisitors.size,
          unique_visitors_ids: Array.from(uniqueVisitors),
        })
        .eq('id', existing.id)
    } else {
      // Create new record
      await supabase
        .from('menu_analytics')
        .insert({
          menu_id: menuId,
          date: today,
          page_views: 1,
          unique_visitors: 1,
          unique_visitors_ids: [visitorId],
        })
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
