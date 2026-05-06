'use client'

import { useEffect } from 'react'
import { initializePostHogIfAllowed } from '@/lib/posthog'
import { useAnalyticsIdentify } from '@/lib/posthog'

/**
 * Client-only bootstrap component for PostHog analytics.
 *
 * Returns null — produces zero DOM output and does NOT wrap children.
 * Mounted as a self-closing sibling alongside <ToastProvider>, <ConsentBanner>,
 * and <VercelAnalytics> inside <body> (design §2.3).
 *
 * Responsibilities:
 * - Calls initializePostHogIfAllowed() on mount (once, idempotent).
 * - Mounts useAnalyticsIdentify() so the Supabase auth listener is live for
 *   the page lifetime.
 *
 * Route-change pageview capture is handled entirely by posthog-js via
 * capture_pageview: 'history_change' — no fallback hook is needed or mounted
 * here (design §10, §18).
 *
 * Consent → PostHog side-effects are wired directly from ConsentBanner.handleChoice
 * (design §8.3), NOT via subscribeToConsentChanges here, to guarantee exactly
 * one side-effect per consent transition (Req 11 AC 5).
 *
 * Implements: 1.8, 1.9, 6.1, 6.5, 11.1, 11.2, 11.3
 */
export function PostHogBootstrap(): null {
  useEffect(() => {
    initializePostHogIfAllowed()
  }, [])

  useAnalyticsIdentify()

  return null
}
