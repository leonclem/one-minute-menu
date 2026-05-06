import { hasAnalyticsConsent } from '@/lib/consent'
import { ANALYTICS_EVENTS, AnalyticsEventName } from './events'
import {
  isAnalyticsEnabledEnv,
  isDev,
  PersonProperties,
} from './config'
import {
  getPostHog,
  isPostHogInitialized,
  posthogOptInCapturingIfLoaded,
  posthogOptOutCapturingIfLoaded,
} from './client'
import { isDistinctIdSafe, sanitizePersonProperties, sanitizeProperties } from './sanitize'

// ---------------------------------------------------------------------------
// §4.1 AnalyticsProperties type
// ---------------------------------------------------------------------------

/**
 * Flat property bag for analytics events.
 * Nested objects and arrays are intentionally excluded so the sanitizer can
 * operate on a flat key space and so property shape surprises are caught at
 * compile time.
 */
export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>

// ---------------------------------------------------------------------------
// §6.5 Pre-Initialization Event Queue
// ---------------------------------------------------------------------------

const MAX_QUEUE_SIZE = 20

type QueueEntry = { event: AnalyticsEventName; properties?: AnalyticsProperties }

/**
 * Bounded in-memory FIFO queue for events captured before posthog.init()
 * completes. Memory-only — no localStorage, no IndexedDB, no sendBeacon.
 * On page unload the queue is garbage-collected with the rest of the JS heap.
 */
const PreInitQueue: QueueEntry[] = []

/**
 * Flush the pre-init queue in FIFO order, forwarding each entry to
 * posthog.capture(). Idempotent — calling on an empty queue is a no-op.
 * Called from client.ts `loaded` callback immediately after initialized=true.
 *
 * Implements: 14.8, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7
 */
export function flushPreInitQueue(): void {
  const ph = getPostHog()
  if (!ph) return
  while (PreInitQueue.length > 0) {
    const entry = PreInitQueue.shift()!
    try {
      ph.capture(entry.event, entry.properties)
    } catch {
      /* swallow per-entry errors so one bad entry doesn't block the rest */
    }
  }
}

// ---------------------------------------------------------------------------
// §7 Opt-out helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the user has set the admin opt-out flag in localStorage.
 * SSR-safe: returns false on the server.
 *
 * Implements: 2.8, 7.1, 9.1
 */
export function isAnalyticsDisabledByUser(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('gridmenu_analytics_disabled') === 'true'
}

/**
 * Returns true if analytics is currently active for this browser session.
 * Checks the admin opt-out flag first, then (if PostHog is loaded) the SDK's
 * own opt-out state.
 *
 * Implements: 2.1, 2.9, 7.1
 */
export function isAnalyticsEnabled(): boolean {
  if (isAnalyticsDisabledByUser()) return false
  const ph = getPostHog()
  if (isPostHogInitialized() && ph) {
    return !ph.has_opted_out_capturing()
  }
  return true
}

/**
 * Persists or clears the admin opt-out flag and mirrors the state to the
 * PostHog SDK if it is already loaded.
 *
 * Callers are responsible for emitting the admin_analytics_disabled /
 * admin_analytics_enabled events around this call (see AnalyticsOptOutToggle).
 *
 * Implements: 2.1, 7.3, 9.1
 */
export function setAnalyticsDisabled(disabled: boolean): void {
  if (typeof window === 'undefined') return
  if (disabled) {
    localStorage.setItem('gridmenu_analytics_disabled', 'true')
    if (isPostHogInitialized()) {
      posthogOptOutCapturingIfLoaded()
    }
  } else {
    localStorage.removeItem('gridmenu_analytics_disabled')
    if (isPostHogInitialized()) {
      posthogOptInCapturingIfLoaded()
    }
  }
}

// ---------------------------------------------------------------------------
// §6 captureEvent — 7-step pipeline
// ---------------------------------------------------------------------------

const registryValues = new Set<string>(Object.values(ANALYTICS_EVENTS))

/**
 * Captures an analytics event through the full §6 7-step pipeline:
 *
 * 1. SSR guard
 * 2. Opt-out guard
 * 3. Consent guard
 * 4. Env guard
 * 5. Dev-only registry-name guard
 * 6. Sanitize properties
 * 7. Branch: enqueue (pre-init) or forward (post-init)
 *
 * Implements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.1, 6.2, 6.3, 6.4, 6.5,
 *             9.1, 9.3, 10.3, 10.4
 */
export function captureEvent(
  eventName: AnalyticsEventName,
  properties?: AnalyticsProperties,
): void {
  // Step 1: SSR guard
  if (typeof window === 'undefined') return

  // Step 2: Opt-out guard
  if (isAnalyticsDisabledByUser()) return

  // Step 3: Consent guard
  if (!hasAnalyticsConsent()) return

  // Step 4: Env guard
  if (!isAnalyticsEnabledEnv()) return

  // Step 5: Dev-only registry-name guard
  if (!registryValues.has(eventName)) {
    if (isDev()) {
      console.warn(
        `[PostHog] captureEvent called with unregistered event name: "${eventName}". ` +
          `Use a constant from ANALYTICS_EVENTS.`,
      )
    }
    return
  }

  // Step 6: Sanitize
  const sanitized = properties
    ? (sanitizeProperties(properties as Record<string, unknown>) as AnalyticsProperties)
    : undefined

  // Step 7: Branch on init state
  if (!isPostHogInitialized()) {
    // Enqueue path — bounded FIFO queue (design §6.5)
    if (PreInitQueue.length < MAX_QUEUE_SIZE) {
      PreInitQueue.push({ event: eventName, properties: sanitized })
    }
    // else drop silently — no throw (Req 16 AC 2)
    return
  }

  // Forward path
  const ph = getPostHog()
  if (!ph) return
  try {
    ph.capture(eventName, sanitized)
  } catch {
    /* swallow transport errors (Req 9 AC 3) */
  }
}

// ---------------------------------------------------------------------------
// §7 identifyUser
// ---------------------------------------------------------------------------

/**
 * Identifies the current user in PostHog.
 *
 * Guards:
 * - SSR guard
 * - Init guard (no-op if PostHog not yet initialized)
 * - Enabled guard
 * - Distinct-id safety: rejects IDs containing '@' (throws in dev, warns+returns in prod)
 *
 * Person properties are filtered through PERSON_PROPERTY_ALLOWLIST before
 * being forwarded to posthog.identify().
 *
 * Implements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.3
 */
export function identifyUser(
  id: string,
  properties?: Partial<PersonProperties>,
): void {
  // SSR guard
  if (typeof window === 'undefined') return

  // Init guard
  if (!isPostHogInitialized()) return

  // Enabled guard
  if (!isAnalyticsEnabledEnv()) return

  // Distinct-id safety
  if (!isDistinctIdSafe(id)) {
    if (isDev()) {
      throw new Error(
        `[PostHog] identifyUser called with an email address as distinct id: "${id}". ` +
          `Use the Supabase user.id instead.`,
      )
    } else {
      console.warn(
        `[PostHog] identifyUser called with an email address as distinct id. Skipping.`,
      )
      return
    }
  }

  // Sanitize person properties through the allow-list
  const cleaned = properties
    ? sanitizePersonProperties(properties as Partial<Record<string, unknown>>)
    : undefined

  const ph = getPostHog()
  if (!ph) return
  try {
    ph.identify(id, cleaned as Record<string, unknown> | undefined)
  } catch {
    /* swallow (Req 9 AC 3) */
  }
}

// ---------------------------------------------------------------------------
// §7 resetAnalytics
// ---------------------------------------------------------------------------

/**
 * Resets the PostHog session (clears the distinct id and session data).
 * Called on SIGNED_OUT to prevent cross-user data leakage.
 *
 * Implements: 2.1, 6.5, 9.1, 9.3
 */
export function resetAnalytics(): void {
  // SSR guard
  if (typeof window === 'undefined') return

  // Init guard
  if (!isPostHogInitialized()) return

  const ph = getPostHog()
  if (!ph) return
  try {
    ph.reset()
  } catch {
    /* swallow (Req 9 AC 3) */
  }
}
