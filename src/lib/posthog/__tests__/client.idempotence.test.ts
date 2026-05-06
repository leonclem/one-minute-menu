/**
 * Tests that initializePostHogIfAllowed() is idempotent — calling it N times
 * with all gates open results in posthog.init being called exactly once.
 *
 * Implements: 1.9
 *
 * Strategy: client.ts has module-level state (`initialized`, `posthogModule`).
 * We use jest.resetModules() + jest.doMock() in beforeEach so each test gets
 * a fresh module instance with a fresh mock.
 *
 * The initMock simulates posthog calling the `loaded` callback synchronously,
 * which sets `initialized = true` inside client.ts so subsequent calls
 * short-circuit at the idempotence guard.
 */

describe('client.ts — init idempotence', () => {
  let initMock: jest.Mock
  const originalEnv = process.env

  beforeEach(() => {
    // Reset module registry so client.ts module-level state is cleared
    jest.resetModules()

    // Simulate posthog calling the loaded callback synchronously so that
    // `initialized` becomes true after the first call, causing subsequent
    // calls to short-circuit at the idempotence guard.
    initMock = jest.fn().mockImplementation(
      (_token: string, options: { loaded?: (ph: unknown) => void }) => {
        if (options?.loaded) {
          options.loaded({})
        }
      },
    )

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
    }

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
  })

  it('calls posthog.init exactly once even when initializePostHogIfAllowed is called 10 times', async () => {
    const { initializePostHogIfAllowed } = await import('../client')

    // Call 10 times sequentially — each call after the first should short-circuit
    for (let i = 0; i < 10; i++) {
      await initializePostHogIfAllowed()
    }

    expect(initMock).toHaveBeenCalledTimes(1)
  })
})
