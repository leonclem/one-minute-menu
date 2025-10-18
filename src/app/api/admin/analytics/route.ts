/**
 * Admin Analytics API Route
 * 
 * Provides platform analytics data for admin dashboard
 * 
 * GET /api/admin/analytics
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { analyticsOperations } from '@/lib/analytics-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Fetch platform analytics
    const platformData = await analyticsOperations.getPlatformAnalytics(30)

    // Fetch generation analytics (admin view)
    const generationData = await analyticsOperations.getGenerationAnalyticsAdmin(30)
    
    // Group metrics by type
    const metricsByType = platformData.reduce((acc, metric) => {
      if (!acc[metric.metric_name]) {
        acc[metric.metric_name] = []
      }
      acc[metric.metric_name].push(metric)
      return acc
    }, {} as Record<string, typeof platformData>)
    
    // Calculate totals
    const totalMetrics = Object.entries(metricsByType).map(([name, data]) => ({
      name,
      total: data.reduce((sum, d) => sum + d.metric_value, 0),
      recent: data.slice(-7).reduce((sum, d) => sum + d.metric_value, 0),
    }))

    return NextResponse.json({
      platformData,
      generationData,
      metricsByType,
      totalMetrics
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
