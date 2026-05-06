// Feature: posthog-integration, Property 5: No email as distinct id, Validates Requirements: 6.2, 14.5

/**
 * Property 5: No email as distinct id
 *
 * identifyUser must never forward a call to posthog.identify when the id
 * contains '@' (i.e. looks like an email address). In dev mode it must throw;
 * in production mode it must return silently.
 *
 * Implements: 14.5, 6.2
 */

import * as fc from 'fast-check'

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('Property 5: No email as distinct id', () => {
  let identifyMock: jest.Mock
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()

    identifyMock = jest.fn()

    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn().mockImplementation(
          (_token: string, options: { loaded?: (ph: unknown) => void }) => {
            if (options?.loaded) options.loaded({})
          },
        ),
        capture: jest.fn(),
        identify: identifyMock,
        reset: jest.fn(),
        opt_out_capturing: jest.fn(),
        opt_in_capturing: jest.fn(),
        has_opted_out_capturing: jest.fn().mockReturnValue(false),
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

  it('never calls posthog.identify for any id containing "@" (dev mode — throws)', async () => {
    // Ensure we are in dev mode (NODE_ENV !== 'production')
    process.env.NODE_ENV = 'test'

    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()

    const { identifyUser } = await import('../helper')

    fc.assert(
      fc.property(
        fc.oneof(
          fc.emailAddress(),
          // Also generate arbitrary strings that happen to contain '@'
          fc.string().map((s) => s + '@example.com'),
        ),
        (emailId) => {
          identifyMock.mockClear()
          // In dev/test mode, identifyUser throws for email-like ids
          expect(() => identifyUser(emailId)).toThrow()
          expect(identifyMock).toHaveBeenCalledTimes(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('never calls posthog.identify for any id containing "@" (production mode — silent)', async () => {
    process.env.NODE_ENV = 'production'

    // Re-register mocks with production NODE_ENV
    jest.resetModules()
    identifyMock = jest.fn()

    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn().mockImplementation(
          (_token: string, options: { loaded?: (ph: unknown) => void }) => {
            if (options?.loaded) options.loaded({})
          },
        ),
        capture: jest.fn(),
        identify: identifyMock,
        reset: jest.fn(),
        opt_out_capturing: jest.fn(),
        opt_in_capturing: jest.fn(),
        has_opted_out_capturing: jest.fn().mockReturnValue(false),
      },
    }))

    jest.doMock('@/lib/consent', () => ({
      __esModule: true,
      hasAnalyticsConsent: () => true,
    }))

    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()

    const { identifyUser } = await import('../helper')

    fc.assert(
      fc.property(
        fc.oneof(
          fc.emailAddress(),
          fc.string().map((s) => s + '@example.com'),
        ),
        (emailId) => {
          identifyMock.mockClear()
          // In production mode, identifyUser returns silently — no throw
          expect(() => identifyUser(emailId)).not.toThrow()
          expect(identifyMock).toHaveBeenCalledTimes(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('does call posthog.identify for safe (non-email) ids', async () => {
    process.env.NODE_ENV = 'test'

    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()

    const { identifyUser } = await import('../helper')

    fc.assert(
      fc.property(
        // Generate strings that do NOT contain '@'
        fc.string().filter((s) => !s.includes('@') && s.length > 0),
        (safeId) => {
          identifyMock.mockClear()
          expect(() => identifyUser(safeId)).not.toThrow()
          expect(identifyMock).toHaveBeenCalledTimes(1)
        },
      ),
      { numRuns: 100 },
    )
  })
})
