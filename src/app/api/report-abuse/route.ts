import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Report abuse or brand impersonation
 * POST /api/report-abuse
 * 
 * Body: {
 *   menuId: string
 *   reason: 'brand_impersonation' | 'inappropriate_content' | 'spam' | 'other'
 *   description: string
 *   reporterEmail?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { menuId, reason, description, reporterEmail } = body
    
    // Validate input
    if (!menuId || typeof menuId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid menuId' },
        { status: 400 }
      )
    }
    
    if (!reason || !['brand_impersonation', 'inappropriate_content', 'spam', 'other'].includes(reason)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reason' },
        { status: 400 }
      )
    }
    
    if (!description || typeof description !== 'string' || description.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Description must be at least 10 characters' },
        { status: 400 }
      )
    }
    
    const supabase = createServerSupabaseClient()
    
    // Create abuse report
    const { error: insertError } = await supabase
      .from('abuse_reports')
      .insert({
        menu_id: menuId,
        reason,
        description,
        reporter_email: reporterEmail || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
    
    if (insertError) {
      console.error('Error creating abuse report:', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to submit report' },
        { status: 500 }
      )
    }
    
    // TODO: Send notification to admin
    // This could be an email alert or Slack notification
    
    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully. We will review it shortly.',
    })
  } catch (error) {
    console.error('Error submitting abuse report:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit report' },
      { status: 500 }
    )
  }
}
