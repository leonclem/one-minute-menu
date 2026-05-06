/**
 * Tests that initializePostHogIfAllowed() isolates errors from posthog.init().
 * If posthog.init() throws, the function must not reject and isPostHogInitialized()
 * must remain false.
 *
 * Implements: 9.3
 */

describe('client.ts — error isolation on init failure', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()

    // Mock posthog-js to throw on init
    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn().mockImplementation(() => {
          throw new Error('PostHog init failed — simulated error')
        }),
        opt_out_capturing: jest.fn(),
        opt_in_capturing: jest.fn(),
      },
    }))

    jest.doMock('@/lib/consent', () => ({
      __esModule: true,
      hasAnalyticsConsent: () => true,
    }))

    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_POSTHOG_TOKEN: 'test-token',
      NEXT_PUBLIC_ENABLE_ANALYTICS: 'true',
    }

    Object.defineProperty(window, 'localStorage', {
      value: { getItem: jest.fn().mockReturnValue(null), setItem: jest.fn(), removeItem: jest.fn() },
      writable: true,
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('does not reject when posthog.init() throws', async () => {
    const { initializePostHogIfAllowed } = await import('../client')
    await expect(initializePostHogIfAllowed()).resolves.toBeUndefined()
  })

  it('leaves isPostHogInitialized() as false when posthog.init() throws', async () => {
    const { initializePostHogIfAllowed, isPostHogInitialized } = await import('../client')
    await initializePostHogIfAllowed()
    expect(isPostHogInitialized()).toBe(false)
  })
})
