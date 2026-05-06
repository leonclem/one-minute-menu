// Feature: posthog-integration, Property 6: Person-property allow-list, Validates Requirements: 6.3, 6.4

/**
 * Property 6: Person-property allow-list
 *
 * identifyUser must only forward keys that are in PERSON_PROPERTY_ALLOWLIST
 * to posthog.identify. Any extra keys — including sensitive ones — must be
 * stripped before the call reaches the SDK.
 *
 * Implements: 6.3, 6.4
 */

import * as fc from 'fast-check'
import { PERSON_PROPERTY_ALLOWLIST } from '../config'

const allowListSet = new Set<string>(PERSON_PROPERTY_ALLOWLIST)

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const allowListedKeyArb = fc.constantFrom(
  'role',
  'plan',
  'subscription_status',
  'is_admin',
  'is_approved',
  'created_at',
)

const propsArb = fc.dictionary(
  fc.oneof(allowListedKeyArb, fc.string()),
  fc.anything(),
)

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('Property 6: Person-property allow-list', () => {
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

  it('only forwards keys in PERSON_PROPERTY_ALLOWLIST to posthog.identify', async () => {
    const { initializePostHogIfAllowed } = await import('../client')
    await initializePostHogIfAllowed()

    const { identifyUser } = await import('../helper')

    fc.assert(
      fc.property(
        // Safe non-email id
        fc.string().filter((s) => !s.includes('@') && s.length > 0),
        propsArb,
        (id, props) => {
          identifyMock.mockClear()

          // Cast through unknown to simulate runtime misuse of extra keys
          identifyUser(id, props as Parameters<typeof identifyUser>[1])

          expect(identifyMock).toHaveBeenCalledTimes(1)

          const forwardedProps = identifyMock.mock.calls[0][1] as
            | Record<string, unknown>
            | undefined

          if (forwardedProps !== undefined) {
            for (const key of Object.keys(forwardedProps)) {
              if (!allowListSet.has(key)) {
                return false
              }
            }
          }
          return true
        },
      ),
      { numRuns: 100 },
    )
  })

  it('PERSON_PROPERTY_ALLOWLIST contains exactly the 6 expected keys', () => {
    expect(PERSON_PROPERTY_ALLOWLIST).toEqual([
      'role',
      'plan',
      'subscription_status',
      'is_admin',
      'is_approved',
      'created_at',
    ])
    // account_id is intentionally absent (design §4.4)
    expect(allowListSet.has('account_id')).toBe(false)
  })
})
