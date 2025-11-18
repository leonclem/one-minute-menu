import { NextRequest, NextResponse } from 'next/server'
import { analyticsOperations } from '@/lib/analytics-server'
import { logger } from '@/lib/logger'

/**
 * Conversion and UX analytics endpoint
 *
 * Records high-level, aggregated conversion funnel and performance metrics
 * for the new UX flows. Uses the existing platform_analytics table via
 * analyticsOperations.trackPlatformMetric.
 *
 * POST /api/analytics/conversion
 * Body: { event: string; metadata?: Record<string, any> }
 */

const EVENT_TO_METRIC: Record<string, string> = {
  // Funnel steps
  landing_view: 'funnel_landing_page_views',
  demo_start: 'funnel_demo_starts',
  demo_completed: 'funnel_demo_completions',
  registration_start: 'funnel_registration_starts',
  signup_completed: 'funnel_signup_conversions',
  export_start: 'funnel_export_starts',
  export_completed: 'funnel_export_completions',

  // CTA interactions
  cta_click_primary: 'funnel_cta_primary_clicks',
  cta_click_secondary: 'funnel_cta_secondary_clicks',
  cta_click_try_own_menu: 'funnel_cta_try_own_menu_clicks',

  // Performance sampling
  web_vitals_sample: 'performance_core_web_vitals_samples',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as {
      event?: string
      metadata?: Record<string, any>
      value?: number
    } | null

    const event = body?.event
    const metadata = body?.metadata ?? {}
    const value = typeof body?.value === 'number' && Number.isFinite(body.value) ? body.value : 1

    if (!event) {
      return NextResponse.json(
        { error: 'Missing required field: event' },
        { status: 400 }
      )
    }

    const metricName = EVENT_TO_METRIC[event]
    if (!metricName) {
      // Silently ignore unknown events to allow forward compatibility
      logger.warn?.('[analytics] Ignoring unknown conversion event', { event })
      return NextResponse.json({ success: true })
    }

    // Record aggregated metric. We intentionally do not store any PII here;
    // metadata is limited to UX/variant context and performance samples.
    await analyticsOperations.trackPlatformMetric(metricName, value, {
      ...metadata,
      path: metadata.path || req.nextUrl.pathname,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Analytics should never break UX – log and return success.
    logger.error?.('[analytics] Conversion tracking failed', { error })
    return NextResponse.json({ success: true })
  }
}


