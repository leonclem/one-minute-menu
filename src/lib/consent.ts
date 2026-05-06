export type ConsentPreferences = {
  analytics: boolean
  updatedAt: string
}

const STORAGE_KEY = 'gridmenu_consent_v1'

// Module-level listener registry for consent change subscriptions.
// This is an extension point for future consent surfaces (e.g. a settings page,
// a footer link). PostHogBootstrap does NOT subscribe here — the consent → PostHog
// side-effect is wired directly from ConsentBanner.handleChoice (task 10.2) to
// guarantee exactly one side-effect per consent transition (Req 11 AC 5, design §8.3).
type ConsentListener = (preferences: ConsentPreferences) => void
const consentListeners = new Set<ConsentListener>()

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function getStoredConsent(): ConsentPreferences | null {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentPreferences
    if (typeof parsed.analytics === 'boolean' && typeof parsed.updatedAt === 'string') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function saveConsent(preferences: { analytics: boolean }): void {
  if (!isBrowser()) return

  const payload: ConsentPreferences = {
    analytics: preferences.analytics,
    updatedAt: new Date().toISOString(),
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage errors – consent should never break UX
  }

  // Notify all subscribers after saving. Each listener is called in its own
  // try/catch so a failing listener cannot prevent others from being notified.
  consentListeners.forEach((listener) => {
    try {
      listener(payload)
    } catch {
      // Swallow listener errors to keep consent saving robust
    }
  })
}

export function hasAnalyticsConsent(): boolean {
  const prefs = getStoredConsent()
  return prefs?.analytics === true
}

/**
 * Subscribe to consent changes. The callback is invoked after every successful
 * `saveConsent` call with the full saved preferences payload.
 *
 * Returns an unsubscribe function — call it to remove the listener.
 *
 * Extension point: intended for future consent surfaces beyond ConsentBanner.
 * See design §8.3 and task 10.1 note for guidance on avoiding duplicate
 * side-effects when adding a second consent surface.
 */
export function subscribeToConsentChanges(cb: ConsentListener): () => void {
  consentListeners.add(cb)
  return () => {
    consentListeners.delete(cb)
  }
}


