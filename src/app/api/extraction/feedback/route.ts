import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/extraction/feedback
 * Retrieve feedback (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get feedback with limit
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '200')
    
    const { data: feedback, error: queryError } = await supabase
      .from('extraction_feedback')
      .select('id, job_id, user_id, feedback_type, item_id, correction_made, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (queryError) {
      console.error('Failed to fetch feedback:', queryError)
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
    }

    return NextResponse.json({ feedback: feedback || [] })
  } catch (err) {
    console.error('Error fetching feedback:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/extraction/feedback
 * Collect user feedback for an extraction job.
 *
 * Body:
 * {
 *   jobId: string,
 *   feedbackType: 'system_error' | 'menu_unclear' | 'excellent' | 'needs_improvement',
 *   itemId?: string,
 *   correctionMade?: string,
 *   comment?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    let body: any
    try {
      body = await request.json()
    } catch (_err) {
      return NextResponse.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const {
      jobId,
      feedbackType,
      itemId,
      correctionMade,
      comment
    } = body || {}

    // Basic validation
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 })
    }

    const allowedTypes = new Set(['system_error', 'menu_unclear', 'excellent', 'needs_improvement'])
    if (!feedbackType || typeof feedbackType !== 'string' || !allowedTypes.has(feedbackType)) {
      return NextResponse.json({ success: false, error: 'Invalid feedbackType' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify job ownership
    const { data: job, error: jobError } = await supabase
      .from('menu_extraction_jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Insert feedback
    const { error: insertError } = await supabase
      .from('extraction_feedback')
      .insert({
        job_id: jobId,
        user_id: user.id,
        feedback_type: feedbackType,
        item_id: itemId || null,
        correction_made: correctionMade || null,
        comment: comment || null,
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Failed to insert extraction feedback:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to submit feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error handling feedback submission:', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}


