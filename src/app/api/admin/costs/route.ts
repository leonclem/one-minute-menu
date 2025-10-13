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

export async function GET(request: NextRequest) {
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

    // TODO: Add admin role check
    // For now, allow all authenticated users
    // In production, check if user has admin role

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
    console.error('Error fetching cost data:', error)
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
    console.error('Error fetching jobs for top spenders:', error)
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

  // Get user emails
  const userIds = sorted.map(s => s.userId)
  const { data: users } = await supabase.auth.admin.listUsers()
  
  const userEmailMap = new Map<string, string>()
  if (users?.users) {
    for (const user of users.users) {
      userEmailMap.set(user.id, user.email || 'Unknown')
    }
  }

  return sorted.map(s => ({
    ...s,
    email: userEmailMap.get(s.userId) || 'Unknown'
  }))
}
