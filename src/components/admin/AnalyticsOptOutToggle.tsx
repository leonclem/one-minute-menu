'use client'

import { useState, useEffect } from 'react'
import {
  ANALYTICS_EVENTS,
  captureEvent,
  initializePostHogIfAllowed,
  isAnalyticsDisabledByUser,
  isAnalyticsEnabled,
  isPostHogInitialized,
  posthogOptInCapturingIfLoaded,
  setAnalyticsDisabled,
} from '@/lib/posthog'

/**
 * Admin toggle that excludes the current browser from PostHog analytics.
 *
 * Label and description are verbatim per Req 7.4.
 * Event ordering per design §9:
 *   Off → On (disabling):  captureEvent(ADMIN_ANALYTICS_DISABLED) THEN setAnalyticsDisabled(true)
 *   On  → Off (enabling):  setAnalyticsDisabled(false) THEN initializePostHogIfAllowed() THEN opt-in + event
 *
 * localStorage-only; no server round-trip.
 * Implements: 7.1, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export function AnalyticsOptOutToggle() {
  const [disabled, setDisabled] = useState(false)

  // Read initial state from localStorage on mount (SSR-safe via isAnalyticsDisabledByUser)
  useEffect(() => {
    setDisabled(isAnalyticsDisabledByUser())
  }, [])

  const handleToggle = async () => {
    if (!disabled) {
      // Off → On: user is enabling the opt-out (disabling analytics)
      // Capture the event BEFORE disabling so it can still be sent
      if (isAnalyticsEnabled()) {
        captureEvent(ANALYTICS_EVENTS.ADMIN_ANALYTICS_DISABLED)
      }
      setAnalyticsDisabled(true)
      setDisabled(true)
    } else {
      // On → Off: user is disabling the opt-out (re-enabling analytics)
      setAnalyticsDisabled(false)
      await initializePostHogIfAllowed()
      // Only opt-in and fire the enable event if PostHog actually initialized
      if (isPostHogInitialized()) {
        posthogOptInCapturingIfLoaded()
        captureEvent(ANALYTICS_EVENTS.ADMIN_ANALYTICS_ENABLED)
      }
      setDisabled(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">
          Exclude my activity from analytics
        </span>
        <span className="text-xs text-gray-500">
          Prevents this browser from sending GridMenu analytics events. Useful for internal testing and admin work.
        </span>
      </div>
      <button
        type="button"
        onClick={() => void handleToggle()}
        className={`relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          disabled ? 'bg-primary-600' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={disabled}
        aria-label="Exclude my activity from analytics"
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            disabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
