/**
 * Admin Cost Monitoring API Route
 * 
 * Provides cost monitoring data for admin dashboard
 * 
 * GET /api/admin/costs
 * 
 * Requirements: 8.3, 12.1, 12.4
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createMetricsCollector } from '@/lib/extraction/metrics-collector'
import { createCostMonitor } from '@/lib/extraction/cost-monitor'
import { logger } from '@/lib/logger'
import { requireAdminApi } from '@/lib/admin-api-auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const supabase = createServerSupabaseClient()

    // Create services
    const metricsCollector = createMetricsCollector(supabase)
    const costMonitor = createCostMonitor(supabase, metricsCollector)

    // Get spending summary
    const summary = await costMonitor.getSpendingSummary()

    // Get top spenders
    const topSpenders = await getTopSpenders(supabase)

    return NextResponse.json({
      summary,
      topSpenders,
      caps: costMonitor.getSpendingCaps()
    })
  } catch (error) {
    logger.error('Error fetching cost data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const supabase = createServerSupabaseClient()

    // Parse request body
    const body = await request.json()
    const { dailyCapGlobal, monthlyCapGlobal, dailyCapPerUser, monthlyCapPerUser } = body

    // Validate caps
    if (dailyCapGlobal !== undefined && (typeof dailyCapGlobal !== 'number' || dailyCapGlobal < 0)) {
      return NextResponse.json(
        { error: 'Invalid dailyCapGlobal' },
        { status: 400 }
      )
    }

    if (monthlyCapGlobal !== undefined && (typeof monthlyCapGlobal !== 'number' || monthlyCapGlobal < 0)) {
      return NextResponse.json(
        { error: 'Invalid monthlyCapGlobal' },
        { status: 400 }
      )
    }

    // Create services
    const metricsCollector = createMetricsCollector(supabase)
    const costMonitor = createCostMonitor(supabase, metricsCollector)

    // Update caps
    costMonitor.updateSpendingCaps({
      dailyCapGlobal,
      monthlyCapGlobal,
      dailyCapPerUser,
      monthlyCapPerUser
    })

    return NextResponse.json({
      success: true,
      caps: costMonitor.getSpendingCaps()
    })
  } catch (error) {
    logger.error('Error updating cost caps:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getTopSpenders(supabase: any, limit: number = 10) {
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString()

  // Get all users with extractions this month
  const { data: jobs, error } = await supabase
    .from('menu_extraction_jobs')
    .select('user_id, token_usage, created_at')
    .eq('status', 'completed')
    .gte('created_at', monthStartStr)

  if (error || !jobs) {
    logger.error('Error fetching jobs for top spenders:', error)
    return []
  }

  // Aggregate by user
  const userSpending = new Map<string, {
    userId: string
    dailySpending: number
    monthlySpending: number
    totalExtractions: number
  }>()

  const today = new Date().toISOString().split('T')[0]

  for (const job of jobs) {
    const existing = userSpending.get(job.user_id) || {
      userId: job.user_id,
      dailySpending: 0,
      monthlySpending: 0,
      totalExtractions: 0
    }

    const cost = job.token_usage?.estimatedCost || 0
    existing.monthlySpending += cost
    existing.totalExtractions += 1

    if (job.created_at.startsWith(today)) {
      existing.dailySpending += cost
    }

    userSpending.set(job.user_id, existing)
  }

  // Sort by monthly spending
  const sorted = Array.from(userSpending.values())
    .sort((a, b) => b.monthlySpending - a.monthlySpending)
    .slice(0, limit)

  // Get user emails from auth.users
  const userIds = sorted.map(s => s.userId)
  
  // Query profiles for user info
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds)
  
  const userEmailMap = new Map<string, string>()
  if (profiles) {
    for (const profile of profiles) {
      userEmailMap.set(profile.id, profile.email || 'Unknown')
    }
  }

  // If profiles don't have email, try to get from auth
  for (const userId of userIds) {
    if (!userEmailMap.has(userId)) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      if (authUser?.user?.email) {
        userEmailMap.set(userId, authUser.user.email)
      }
    }
  }

  return sorted.map(s => ({
    ...s,
    email: userEmailMap.get(s.userId) || 'Unknown User'
  }))
}
