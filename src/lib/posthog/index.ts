/**
 * Public barrel for the PostHog integration.
 *
 * App code should import exclusively from `@/lib/posthog` — never from the
 * internal modules (client.ts, helper.ts, sanitize.ts, config.ts, events.ts).
 *
 * Implements: 2.10, 12.3
 */

// ---------------------------------------------------------------------------
// Event registry
// ---------------------------------------------------------------------------
export { ANALYTICS_EVENTS } from './events'
export type { AnalyticsEventName } from './events'

// ---------------------------------------------------------------------------
// Core capture / identify / reset helpers + opt-out utilities + pre-init queue
// ---------------------------------------------------------------------------
export {
  captureEvent,
  identifyUser,
  resetAnalytics,
  isAnalyticsEnabled,
  setAnalyticsDisabled,
  isAnalyticsDisabledByUser,
  flushPreInitQueue,
} from './helper'
export type { AnalyticsProperties } from './helper'

// ---------------------------------------------------------------------------
// PostHog SDK lifecycle
// ---------------------------------------------------------------------------
export {
  initializePostHogIfAllowed,
  isPostHogInitialized,
  posthogOptOutCapturingIfLoaded,
  posthogOptInCapturingIfLoaded,
} from './client'

// ---------------------------------------------------------------------------
// Auth-state identify hook
// ---------------------------------------------------------------------------
export { useAnalyticsIdentify } from './useAnalyticsIdentify'
