import { NextRequest, NextResponse } from 'next/server'
import { analyticsOperations } from '@/lib/analytics'

export const runtime = 'edge'

/**
 * Track menu view
 * POST /api/analytics/track
 * 
 * Body: { menuId: string, visitorId: string, timestamp: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { menuId, visitorId } = body
    
    // Validate input
    if (!menuId || typeof menuId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid menuId' },
        { status: 400 }
      )
    }
    
    if (!visitorId || typeof visitorId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid visitorId' },
        { status: 400 }
      )
    }
    
    // Record the view
    await analyticsOperations.recordMenuView(menuId, visitorId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics tracking error:', error)
    
    // Return success even on error to not break user experience
    // Analytics failures should be silent
    return NextResponse.json({ success: true })
  }
}
