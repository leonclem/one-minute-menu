/**
 * Tests for the exact shape of options passed to posthog.init()
 * inside initializePostHogIfAllowed().
 *
 * Implements: 1.7, 8.2, 8.4, 10.1, 10.2, 15.1, 15.2, 15.3, 15.4
 *
 * Strategy: client.ts has module-level state (`initialized`, `posthogModule`).
 * We use jest.resetModules() + jest.doMock() in beforeEach so each test gets
 * a fresh module instance with a fresh mock.
 */

describe('client.ts — init-options shape', () => {
  let initMock: jest.Mock
  const originalEnv = process.env

  beforeEach(() => {
    // Reset module registry so client.ts module-level state is cleared
    jest.resetModules()

    // Create a fresh init mock for this test
    initMock = jest.fn()

    // Register mocks AFTER resetModules so they are in the fresh registry
    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: initMock,
        opt_out_capturing: jest.fn(),
        opt_in_capturing: jest.fn(),
      },
    }))

    jest.doMock('@/lib/consent', () => ({
      __esModule: true,
      hasAnalyticsConsent: () => true,
    }))

    // Set env vars so all gates pass
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_POSTHOG_TOKEN: 'test-token',
      NEXT_PUBLIC_ENABLE_ANALYTICS: 'true',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://test.proxy.example.com',
    }
    // Ensure ui_host env is unset by default
    delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST

    // Mock localStorage so admin opt-out gate passes (returns null = not opted out)
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  /**
   * Helper: import client fresh (after mocks are set up) and call initializePostHogIfAllowed.
   * Returns the options object passed to posthog.init().
   */
  async function getInitOptions(): Promise<Record<string, unknown>> {
    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()
    expect(initMock).toHaveBeenCalledTimes(1)
    // posthog.init(token, options) — options is the second argument
    return initMock.mock.calls[0][1] as Record<string, unknown>
  }

  it('calls posthog.init with defaults as the first key', async () => {
    const options = await getInitOptions()
    expect(Object.keys(options)[0]).toBe('defaults')
    expect(options.defaults).toBe('2026-01-30')
  })

  it('passes the exact session_recording shape', async () => {
    const options = await getInitOptions()
    expect(options.session_recording).toEqual({
      maskAllInputs: true,
      maskInputOptions: { password: true, email: true },
      maskTextSelector: '[data-ph-mask], [data-ph-mask] *',
    })
  })

  it('passes capture_pageview, capture_pageleave, autocapture', async () => {
    const options = await getInitOptions()
    expect(options.capture_pageview).toBe('history_change')
    expect(options.capture_pageleave).toBe(true)
    expect(options.autocapture).toBe(true)
  })

  it('passes api_host from NEXT_PUBLIC_POSTHOG_HOST env var', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://my.custom.proxy.com'
    const options = await getInitOptions()
    expect(options.api_host).toBe('https://my.custom.proxy.com')
  })

  it('passes ui_host when NEXT_PUBLIC_POSTHOG_UI_HOST is set', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_UI_HOST = 'https://us.posthog.com'
    const options = await getInitOptions()
    expect(options.ui_host).toBe('https://us.posthog.com')
  })

  it('omits ui_host when NEXT_PUBLIC_POSTHOG_UI_HOST is unset', async () => {
    // Ensure the env var is absent
    delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST
    const options = await getInitOptions()
    expect(Object.prototype.hasOwnProperty.call(options, 'ui_host')).toBe(false)
  })

  it('passes persistence: localStorage+cookie', async () => {
    const options = await getInitOptions()
    expect(options.persistence).toBe('localStorage+cookie')
  })
})
