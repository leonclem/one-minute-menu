import '@testing-library/jest-dom'

import { getStoredConsent, saveConsent, hasAnalyticsConsent } from '@/lib/consent'
import { trackMenuView } from '@/lib/analytics-client'

describe('consent utilities', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns null when no consent is stored', () => {
    expect(getStoredConsent()).toBeNull()
  })

  it('persists and reads analytics consent', () => {
    saveConsent({ analytics: true })
    const prefs = getStoredConsent()
    expect(prefs).not.toBeNull()
    expect(prefs?.analytics).toBe(true)
    expect(typeof prefs?.updatedAt).toBe('string')
    expect(hasAnalyticsConsent()).toBe(true)
  })

  it('treats missing preferences as no analytics consent', () => {
    // Ensure nothing is stored
    const prefs = getStoredConsent()
    expect(prefs).toBeNull()
    expect(hasAnalyticsConsent()).toBe(false)
  })
})

describe('analytics tracking and consent', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    window.localStorage.clear()
    jest.clearAllMocks()
    // @ts-ignore
    global.fetch = undefined
  })

  it('does not send analytics events when consent is not granted', async () => {
    await trackMenuView('menu-123')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends analytics events when analytics consent is granted', async () => {
    saveConsent({ analytics: true })
    await trackMenuView('menu-456')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/analytics/track')
  })
})


