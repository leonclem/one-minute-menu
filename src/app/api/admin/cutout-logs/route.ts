/**
 * Admin Cutout Generation Logs API Route
 *
 * Provides cut-out generation log data for admin monitoring and troubleshooting.
 *
 * GET /api/admin/cutout-logs
 *
 * Query params:
 *   startDate, endDate, provider, status, userId, menuId
 *
 * Requirements: 5.1–5.4, 6.1–6.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Allow CRON_SECRET bearer token as an alternative to session-based admin auth
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`

    let supabase
    if (isCronAuth) {
      supabase = createAdminSupabaseClient()
    } else {
      const admin = await requireAdminApi()
      if (!admin.ok) return admin.response
      supabase = admin.supabase
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const provider = searchParams.get('provider')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const menuId = searchParams.get('menuId')

    // Build filtered query
    let query = supabase
      .from('cutout_generation_logs')
      .select('*')
      .order('requested_at', { ascending: false })

    if (startDate) {
      query = query.gte('requested_at', startDate)
    }
    if (endDate) {
      query = query.lte('requested_at', endDate)
    }
    if (provider) {
      query = query.eq('provider_name', provider)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (menuId) {
      query = query.eq('menu_id', menuId)
    }

    const { data: logs, error } = await query

    if (error) {
      logger.error('Error querying cutout logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cutout logs' },
        { status: 500 }
      )
    }

    const records = logs ?? []

    // Compute aggregated statistics
    const total = records.length
    const succeeded = records.filter((l: any) => l.status === 'succeeded').length
    const failed = records.filter((l: any) => l.status === 'failed').length
    const timedOut = records.filter((l: any) => l.status === 'timed_out').length
    const successRate = total > 0 ? succeeded / total : 0

    return NextResponse.json({
      logs: records,
      aggregates: {
        total,
        succeeded,
        failed,
        timedOut,
        successRate,
      },
    })
  } catch (error) {
    logger.error('Error fetching cutout logs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
