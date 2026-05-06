// Feature: posthog-integration, Property 7: Registry-only event names, Validates Requirements: 2.2, 3.3, 14.7

/**
 * Property 7: Registry-only event names
 *
 * captureEvent must never forward an event to posthog.capture when the event
 * name is not a member of ANALYTICS_EVENTS values. In dev mode it must also
 * emit a console.warn.
 *
 * Implements: 14.7, 2.2, 3.3
 */

import * as fc from 'fast-check'
import { ANALYTICS_EVENTS, AnalyticsEventName } from '../events'

const registryValues = new Set<string>(Object.values(ANALYTICS_EVENTS))

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('Property 7: Registry-only event names', () => {
  let captureMock: jest.Mock
  let warnSpy: jest.SpyInstance
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()

    captureMock = jest.fn()

    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn().mockImplementation(
          (_token: string, options: { loaded?: (ph: unknown) => void }) => {
            if (options?.loaded) options.loaded({})
          },
        ),
        capture: captureMock,
        identify: jest.fn(),
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
      // Keep NODE_ENV as 'test' (non-production) so the dev guard fires
      NODE_ENV: 'test',
    }

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })

    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('never calls posthog.capture for unregistered event names, and warns in dev', async () => {
    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()

    const { captureEvent } = await import('../helper')

    fc.assert(
      fc.property(
        // Generate strings that are NOT in the registry
        fc.string().filter((s) => !registryValues.has(s)),
        (unregisteredName) => {
          captureMock.mockClear()
          warnSpy.mockClear()

          // Cast through unknown to simulate runtime misuse
          expect(() =>
            captureEvent(unregisteredName as AnalyticsEventName),
          ).not.toThrow()

          expect(captureMock).toHaveBeenCalledTimes(0)

          // In dev/test mode, a console.warn must have fired
          expect(warnSpy).toHaveBeenCalledTimes(1)
          expect(warnSpy.mock.calls[0][0]).toContain(unregisteredName)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('does call posthog.capture for all registered event names', async () => {
    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()

    const { captureEvent } = await import('../helper')

    for (const eventName of Object.values(ANALYTICS_EVENTS)) {
      captureMock.mockClear()
      expect(() => captureEvent(eventName)).not.toThrow()
      expect(captureMock).toHaveBeenCalledTimes(1)
    }
  })
})
