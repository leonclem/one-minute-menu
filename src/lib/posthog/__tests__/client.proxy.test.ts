/**
 * Verification test: code-side proxy host support
 *
 * Confirms that initializePostHogIfAllowed() forwards NEXT_PUBLIC_POSTHOG_HOST
 * verbatim as api_host, and conditionally includes ui_host only when
 * NEXT_PUBLIC_POSTHOG_UI_HOST is set.
 *
 * Implements: 15.1, 15.2, 15.3, 15.4, 15.6, 15.7
 *
 * Strategy: same jest.resetModules() + jest.doMock() pattern as
 * client.initOptions.test.ts so each test gets a fresh module instance.
 */

describe('client.ts — proxy host wiring', () => {
  let initMock: jest.Mock
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()

    initMock = jest.fn()

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

    // All gates pass by default
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_POSTHOG_TOKEN: 'test-token',
      NEXT_PUBLIC_ENABLE_ANALYTICS: 'true',
    }
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST

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

  async function getInitOptions(): Promise<Record<string, unknown>> {
    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()
    expect(initMock).toHaveBeenCalledTimes(1)
    return initMock.mock.calls[0][1] as Record<string, unknown>
  }

  it('forwards a simulated proxy host verbatim as api_host', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://edge.gridmenu.ai'
    const options = await getInitOptions()
    expect(options.api_host).toBe('https://edge.gridmenu.ai')
  })

  it('includes ui_host when NEXT_PUBLIC_POSTHOG_UI_HOST is set alongside a proxy host', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://edge.gridmenu.ai'
    process.env.NEXT_PUBLIC_POSTHOG_UI_HOST = 'https://us.posthog.com'
    const options = await getInitOptions()
    expect(options.api_host).toBe('https://edge.gridmenu.ai')
    expect(options.ui_host).toBe('https://us.posthog.com')
  })

  it('omits ui_host when only NEXT_PUBLIC_POSTHOG_HOST is set (no UI host)', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://edge.gridmenu.ai'
    delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST
    const options = await getInitOptions()
    expect(options.api_host).toBe('https://edge.gridmenu.ai')
    expect(Object.prototype.hasOwnProperty.call(options, 'ui_host')).toBe(false)
  })

  it('falls back to the default PostHog ingest host when NEXT_PUBLIC_POSTHOG_HOST is unset', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    const options = await getInitOptions()
    expect(options.api_host).toBe('https://us.i.posthog.com')
  })

  it('accepts an EU proxy host verbatim', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu-edge.gridmenu.ai'
    process.env.NEXT_PUBLIC_POSTHOG_UI_HOST = 'https://eu.posthog.com'
    const options = await getInitOptions()
    expect(options.api_host).toBe('https://eu-edge.gridmenu.ai')
    expect(options.ui_host).toBe('https://eu.posthog.com')
  })
})
