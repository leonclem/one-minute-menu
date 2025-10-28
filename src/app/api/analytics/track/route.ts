import { NextRequest, NextResponse } from 'next/server'
import { analyticsOperations } from '@/lib/analytics-server'
import { platformMetrics } from '@/lib/platform-metrics'
import { logger } from '@/lib/logger'

/**
 * Track menu view endpoint
 * Accepts cookieless analytics data and stores it aggregated by date
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { menuId, visitorId } = body

    // Validate required fields
    if (!menuId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing required fields: menuId, visitorId' },
        { status: 400 }
      )
    }

    // Record the menu view
    await analyticsOperations.recordMenuView(menuId, visitorId)

    // Track platform-level metrics (non-blocking)
    platformMetrics.trackTotalMenuViews(1)

    logger.info(`Analytics tracked: menuId=${menuId}, visitorId=${visitorId}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Analytics tracking error:', error)
    
    // Return success even on error to prevent breaking user experience
    // Analytics failures should be silent
    return NextResponse.json({ success: true })
  }
}