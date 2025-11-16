export type ConsentPreferences = {
  analytics: boolean
  updatedAt: string
}

const STORAGE_KEY = 'gridmenu_consent_v1'

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
}

export function hasAnalyticsConsent(): boolean {
  const prefs = getStoredConsent()
  return prefs?.analytics === true
}


