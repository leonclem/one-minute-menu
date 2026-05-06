// Feature: posthog-integration, Property 1: No-op when uninitialized, Validates Requirements: 2.3, 2.4, 14.1

/**
 * Property 1: No-op when uninitialized
 *
 * When PostHog has not yet been initialized, captureEvent and identifyUser
 * must never forward calls to posthog.capture / posthog.identify, and must
 * never throw.
 *
 * Implements: 14.1, 2.3, 2.4
 */

import * as fc from 'fast-check'
import { ANALYTICS_EVENTS } from '../events'
import { PERSON_PROPERTY_ALLOWLIST } from '../config'

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

const allowListedPropsArb = fc.record(
  Object.fromEntries(PERSON_PROPERTY_ALLOWLIST.map((k) => [k, fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))])),
  { requiredKeys: [] },
)

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('Property 1: No-op when uninitialized', () => {
  let captureMock: jest.Mock
  let identifyMock: jest.Mock

  beforeEach(() => {
    jest.resetModules()

    captureMock = jest.fn()
    identifyMock = jest.fn()

    // PostHog SDK mock — should never be called
    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn(),
        capture: captureMock,
        identify: identifyMock,
        reset: jest.fn(),
        opt_out_capturing: jest.fn(),
        opt_in_capturing: jest.fn(),
        has_opted_out_capturing: jest.fn().mockReturnValue(false),
      },
    }))

    // All gates pass except init — PostHog is never initialized
    jest.doMock('@/lib/consent', () => ({
      __esModule: true,
      hasAnalyticsConsent: () => true,
    }))

    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'true'
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN = 'test-token'

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
    delete process.env.NEXT_PUBLIC_ENABLE_ANALYTICS
    delete process.env.NEXT_PUBLIC_POSTHOG_TOKEN
    jest.restoreAllMocks()
  })

  it('captureEvent never calls posthog.capture when uninitialized', async () => {
    const { captureEvent } = await import('../helper')

    fc.assert(
      fc.property(eventNameArb, propsArb, (eventName, props) => {
        captureMock.mockClear()
        // isPostHogInitialized() returns false because we never called initializePostHogIfAllowed()
        expect(() => captureEvent(eventName, props)).not.toThrow()
        expect(captureMock).toHaveBeenCalledTimes(0)
      }),
      { numRuns: 100 },
    )
  })

  it('identifyUser never calls posthog.identify when uninitialized', async () => {
    const { identifyUser } = await import('../helper')

    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('@')),
        allowListedPropsArb,
        (id, props) => {
          identifyMock.mockClear()
          // identifyUser has an init guard — returns early when not initialized
          expect(() => identifyUser(id, props)).not.toThrow()
          expect(identifyMock).toHaveBeenCalledTimes(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
