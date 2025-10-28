/**
 * Admin Metrics API Route
 * 
 * Provides extraction metrics for admin dashboard
 * 
 * GET /api/admin/metrics?start=YYYY-MM-DD&end=YYYY-MM-DD
 * 
 * Requirements: 8.1, 8.2, 8.4
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createMetricsCollector } from '@/lib/extraction/metrics-collector'

export const dynamic = 'force-dynamic'

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
    // In production, check if user has admin role:
    // const { data: profile } = await supabase
    //   .from('profiles')
    //   .select('role')
    //   .eq('id', user.id)
    //   .single()
    // if (profile?.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // }

    // Get date range from query params
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start') || getDefaultStartDate()
    const endDate = searchParams.get('end') || getDefaultEndDate()

    // Validate dates
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Create metrics collector
    const metricsCollector = createMetricsCollector(supabase)

    // Get overall metrics
    const overall = await metricsCollector.getOverallMetrics(
      `${startDate}T00:00:00Z`,
      `${endDate}T23:59:59Z`
    )

    // Get daily metrics
    const daily = await metricsCollector.getDailyMetrics(startDate, endDate)

    return NextResponse.json({
      overall,
      daily,
      dateRange: {
        start: startDate,
        end: endDate
      }
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultStartDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30) // Last 30 days
  return date.toISOString().split('T')[0]
}

function getDefaultEndDate(): string {
  return new Date().toISOString().split('T')[0]
}

function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}
