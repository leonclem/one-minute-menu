/**
 * Admin Cutout Render Usage API Route
 *
 * Provides render-time image source analytics for admin monitoring.
 *
 * GET /api/admin/cutout-render-usage
 *
 * Query params:
 *   startDate, endDate, templateId, fallbackReason
 *
 * Requirements: 7.1–7.4
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAdminApi } from '@/lib/admin-api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const templateId = searchParams.get('templateId')
    const fallbackReason = searchParams.get('fallbackReason')

    // Build filtered query
    let query = admin.supabase
      .from('cutout_render_usage')
      .select('*')
      .order('rendered_at', { ascending: false })

    if (startDate) {
      query = query.gte('rendered_at', startDate)
    }
    if (endDate) {
      query = query.lte('rendered_at', endDate)
    }
    if (templateId) {
      query = query.eq('template_id', templateId)
    }
    if (fallbackReason) {
      query = query.eq('fallback_reason', fallbackReason)
    }

    const { data: records, error } = await query

    if (error) {
      logger.error('Error querying cutout render usage:', error)
      return NextResponse.json(
        { error: 'Failed to fetch render usage data' },
        { status: 500 }
      )
    }

    const rows = records ?? []

    // Compute aggregated statistics
    const totalRenders = rows.length
    const cutoutUsed = rows.filter((r: any) => r.image_source_used === 'cutout').length
    const originalUsed = rows.filter((r: any) => r.image_source_used === 'original').length
    const cutoutUsageRate = totalRenders > 0 ? cutoutUsed / totalRenders : 0

    return NextResponse.json({
      records: rows,
      aggregates: {
        totalRenders,
        cutoutUsed,
        originalUsed,
        cutoutUsageRate,
      },
    })
  } catch (error) {
    logger.error('Error fetching cutout render usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
