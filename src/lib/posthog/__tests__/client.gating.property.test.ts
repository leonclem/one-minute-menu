// Feature: posthog-integration, Property 8: Gating matrix, Validates Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.2, 8.3, 9.4, 11.1

/**
 * Property 8: Gating matrix
 *
 * initializePostHogIfAllowed() must call posthog.init exactly once iff ALL
 * four gates are open simultaneously:
 *   1. tokenPresent      — NEXT_PUBLIC_POSTHOG_TOKEN is non-empty
 *   2. enableFlagTrue    — NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'
 *   3. consentGranted    — hasAnalyticsConsent() returns true
 *   4. adminOptOutFalse  — localStorage 'gridmenu_analytics_disabled' !== 'true'
 *
 * For all 16 combinations of these four booleans, no call must throw and
 * posthog.init must be called exactly once iff all four are true, zero otherwise.
 *
 * Implements: 14.8 (design §15 Property 8), 1.1, 1.2, 1.3, 1.4, 1.5, 7.2, 8.3, 9.4, 11.1
 */

import * as fc from 'fast-check'

describe('Property 8: Gating matrix', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('calls posthog.init exactly once iff all four gates are open, for all 16 combinations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean()),
        async ([tokenPresent, enableFlagTrue, consentGranted, adminOptOutFalse]) => {
          // ----------------------------------------------------------------
          // 1. Reset module registry so client.ts module-level state is fresh
          // ----------------------------------------------------------------
          jest.resetModules()

          // ----------------------------------------------------------------
          // 2. Build a fresh initMock for this run
          // ----------------------------------------------------------------
          const initMock = jest.fn()

          // ----------------------------------------------------------------
          // 3. Register mocks in the fresh registry
          // ----------------------------------------------------------------
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
            hasAnalyticsConsent: () => consentGranted,
          }))

          // ----------------------------------------------------------------
          // 4. Configure env vars for this run
          // ----------------------------------------------------------------
          process.env = {
            ...originalEnv,
            NEXT_PUBLIC_POSTHOG_TOKEN: tokenPresent ? 'test-token' : '',
            NEXT_PUBLIC_ENABLE_ANALYTICS: enableFlagTrue ? 'true' : 'false',
          }
          // Ensure ui_host is absent so the options shape stays minimal
          delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST

          // ----------------------------------------------------------------
          // 5. Configure localStorage for admin opt-out gate
          // ----------------------------------------------------------------
          Object.defineProperty(window, 'localStorage', {
            value: {
              getItem: jest
                .fn()
                .mockReturnValue(adminOptOutFalse ? null : 'true'),
              setItem: jest.fn(),
              removeItem: jest.fn(),
            },
            writable: true,
          })

          // ----------------------------------------------------------------
          // 6. Import fresh client module and call initializePostHogIfAllowed
          // ----------------------------------------------------------------
          const { initializePostHogIfAllowed } = await import('../client')

          // Must never throw regardless of gate combination
          await expect(initializePostHogIfAllowed()).resolves.toBeUndefined()

          // ----------------------------------------------------------------
          // 7. Assert init call count
          // ----------------------------------------------------------------
          const allGatesOpen =
            tokenPresent && enableFlagTrue && consentGranted && adminOptOutFalse

          if (allGatesOpen) {
            expect(initMock).toHaveBeenCalledTimes(1)
          } else {
            expect(initMock).toHaveBeenCalledTimes(0)
          }
        },
      ),
      // 16 deterministic combinations — use exhaustive enumeration via numRuns
      // fast-check will sample from the 16-element space; setting numRuns to 100
      // ensures all 16 combinations are hit with high probability.
      { numRuns: 100 },
    )
  })

  it('covers all 16 gate combinations explicitly (exhaustive check)', async () => {
    // Enumerate all 16 combinations deterministically to guarantee full coverage
    const combinations: [boolean, boolean, boolean, boolean][] = []
    for (let i = 0; i < 16; i++) {
      combinations.push([
        Boolean(i & 8),
        Boolean(i & 4),
        Boolean(i & 2),
        Boolean(i & 1),
      ])
    }

    for (const [tokenPresent, enableFlagTrue, consentGranted, adminOptOutFalse] of combinations) {
      jest.resetModules()

      const initMock = jest.fn()

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
        hasAnalyticsConsent: () => consentGranted,
      }))

      process.env = {
        ...originalEnv,
        NEXT_PUBLIC_POSTHOG_TOKEN: tokenPresent ? 'test-token' : '',
        NEXT_PUBLIC_ENABLE_ANALYTICS: enableFlagTrue ? 'true' : 'false',
      }
      delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn().mockReturnValue(adminOptOutFalse ? null : 'true'),
          setItem: jest.fn(),
          removeItem: jest.fn(),
        },
        writable: true,
      })

      const { initializePostHogIfAllowed } = await import('../client')

      // Must never throw
      await expect(initializePostHogIfAllowed()).resolves.toBeUndefined()

      const allGatesOpen =
        tokenPresent && enableFlagTrue && consentGranted && adminOptOutFalse

      expect(initMock).toHaveBeenCalledTimes(
        allGatesOpen ? 1 : 0,
      )
    }
  })
})
