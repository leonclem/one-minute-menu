'use client'

import { useEffect } from 'react'
import { captureEvent, ANALYTICS_EVENTS } from '@/lib/posthog'

/**
 * Fires Google Ads signup conversion + PostHog signup_completed once when
 * the auth callback redirected with ?new_signup=true.
 */
export function SignupConversionBeacon({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return

    const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
    const adsLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL
    if (typeof window !== 'undefined' && adsId && adsLabel) {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', { send_to: `${adsId}/${adsLabel}` })
      }
    }

    captureEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED)
  }, [enabled])

  return null
}
