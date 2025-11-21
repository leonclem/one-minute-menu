import '@testing-library/jest-dom'

import { getStoredConsent, saveConsent, hasAnalyticsConsent } from '@/lib/consent'
import { trackMenuView } from '@/lib/analytics-client'
import { trackConversionEvent } from '@/lib/conversion-tracking'

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

  it('tracks demo conversion events alongside analytics when consent is granted', async () => {
    saveConsent({ analytics: true })

    // First, a menu view should go to /api/analytics/track
    await trackMenuView('menu-ux-demo')

    // Then a demo_start conversion should go to /api/analytics/conversion
    await trackConversionEvent({
      event: 'demo_start',
      metadata: { path: '/ux/demo/sample', menuId: 'menu-ux-demo' },
    })

    const endpoints = (global.fetch as jest.Mock).mock.calls.map((call) => call[0])
    expect(endpoints).toContain('/api/analytics/track')
    expect(endpoints).toContain('/api/analytics/conversion')
  })

  it('still allows conversion events when analytics consent is not granted', async () => {
    await trackConversionEvent({
      event: 'demo_start',
      metadata: { path: '/ux/demo/sample', sampleId: 'sample-breakfast' },
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/analytics/conversion')
  })
})


