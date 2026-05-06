// Feature: posthog-integration, Property 2: Opt-out blocks capture (idempotent), Validates Requirements: 7.3, 14.2, 14.6

/**
 * Property 2: Opt-out blocks capture (idempotent)
 *
 * When the admin opt-out flag is set, captureEvent must never forward any
 * event to posthog.capture, regardless of how many events are sent or what
 * their names/properties are.
 *
 * Implements: 14.2, 14.6, 7.3
 */

import * as fc from 'fast-check'
import { ANALYTICS_EVENTS } from '../events'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const eventNameArb = fc.constantFrom(...Object.values(ANALYTICS_EVENTS))

const propValueArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
)

const propsArb = fc.dictionary(fc.string(), propValueArb)

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('Property 2: Opt-out blocks capture (idempotent)', () => {
  let captureMock: jest.Mock
  let localStorageGetItem: jest.Mock

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
    }

    // localStorage: opt-out flag is SET ('true') — admin has disabled analytics
    localStorageGetItem = jest.fn().mockReturnValue('true')
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: localStorageGetItem,
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

  it('posthog.capture is never called when opt-out flag is set, for any sequence of events', async () => {
    // Force initialized = true by importing client and calling init with all gates
    // except the opt-out gate (which is set). We do this by temporarily clearing
    // the opt-out flag for init, then re-setting it.
    localStorageGetItem.mockReturnValueOnce(null) // first call (admin opt-out gate in init) passes
    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()

    // Now set opt-out flag for all subsequent captureEvent calls
    localStorageGetItem.mockReturnValue('true')

    const { captureEvent } = await import('../helper')

    fc.assert(
      fc.property(
        fc.array(fc.tuple(eventNameArb, propsArb), { minLength: 0, maxLength: 50 }),
        (events) => {
          captureMock.mockClear()
          for (const [eventName, props] of events) {
            expect(() => captureEvent(eventName, props)).not.toThrow()
          }
          expect(captureMock).toHaveBeenCalledTimes(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
