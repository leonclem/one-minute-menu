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
import { analyticsOperations } from '@/lib/analytics-server'
import { logger } from '@/lib/logger'
import { requireAdminApi } from '@/lib/admin-api-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

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
    logger.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
