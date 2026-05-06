// Feature: posthog-integration, Property 9: Pre-init queue FIFO flush integrity, Validates Requirements: 14.8, 16.1, 16.2, 16.3, 16.7

/**
 * Property 9: Pre-init queue FIFO flush integrity
 *
 * Events captured before posthog.init() completes are enqueued in a bounded
 * FIFO queue (MAX_QUEUE_SIZE = 20). When init completes, the queue is flushed
 * in FIFO order. Events beyond the cap are silently dropped.
 *
 * Assertions per design §15 Property 9:
 * - posthog.capture is invoked exactly min(N, 20) times
 * - The i-th invocation (0-indexed, for i < min(N, 20)) receives (e_i, sanitize(p_i)) in FIFO order
 * - The queue is empty after flush
 * - A second flush call is a no-op
 *
 * Implements: 14.8, 16.1, 16.2, 16.3, 16.7
 */

import * as fc from 'fast-check'
import { ANALYTICS_EVENTS, AnalyticsEventName } from '../events'
import { sanitizeProperties } from '../sanitize'
import { AnalyticsProperties } from '../helper'

const MAX_QUEUE_SIZE = 20

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const eventNameArb = fc.constantFrom(...Object.values(ANALYTICS_EVENTS))

// Properties that are safe to sanitize (no sensitive keys, no undefined values
// that would be stripped in a way that changes FIFO ordering assertions)
const sanitizablePropsArb = fc.option(
  fc.dictionary(
    // Avoid sensitive keys so sanitized output equals input
    fc.string().filter(
      (k) =>
        ![
          'email',
          'phone',
          'full_name',
          'name',
          'address',
          'billing_address',
          'payment',
          'password',
          'dish_name',
          'dish_description',
          'menu_text',
          'file_name',
          'prompt',
        ].includes(k.toLowerCase()),
    ),
    fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
  ),
  { nil: undefined },
)

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('Property 9: Pre-init queue FIFO flush integrity', () => {
  let captureMock: jest.Mock
  let loadedCallback: ((ph: unknown) => void) | undefined
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()

    captureMock = jest.fn()
    loadedCallback = undefined

    // The init mock captures the `loaded` callback but does NOT call it yet —
    // we call it manually to simulate the async init completing after events
    // have been enqueued.
    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn().mockImplementation(
          (_token: string, options: { loaded?: (ph: unknown) => void }) => {
            loadedCallback = options?.loaded
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

  it('flushes exactly min(N, 20) events in FIFO order after init completes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(eventNameArb, sanitizablePropsArb), {
          minLength: 0,
          maxLength: 50, // deliberately spans both under-cap and over-cap regions
        }),
        async (events) => {
          // Reset module state for each run
          jest.resetModules()
          captureMock = jest.fn()
          loadedCallback = undefined

          jest.doMock('posthog-js', () => ({
            __esModule: true,
            default: {
              init: jest.fn().mockImplementation(
                (_token: string, options: { loaded?: (ph: unknown) => void }) => {
                  loadedCallback = options?.loaded
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

          // Start init (which stores the loaded callback but doesn't call it yet)
          const { initializePostHogIfAllowed } = await import('../client')
          const initPromise = initializePostHogIfAllowed()

          // Enqueue events BEFORE init completes (loaded callback not yet called)
          const { captureEvent } = await import('../helper')
          for (const [eventName, props] of events) {
            captureEvent(
              eventName as AnalyticsEventName,
              props as AnalyticsProperties | undefined,
            )
          }

          // Now complete init by invoking the loaded callback — this triggers flushPreInitQueue
          if (loadedCallback) {
            loadedCallback({})
          }
          await initPromise

          // Wait for the dynamic import of helper.ts inside the loaded callback to resolve
          await new Promise((resolve) => setTimeout(resolve, 0))

          const N = events.length
          const expectedCalls = Math.min(N, MAX_QUEUE_SIZE)

          // Assertion 1: exactly min(N, 20) capture calls
          expect(captureMock).toHaveBeenCalledTimes(expectedCalls)

          // Assertion 2: FIFO order — i-th call matches i-th enqueued event
          for (let i = 0; i < expectedCalls; i++) {
            const [expectedEvent, expectedProps] = events[i]
            const [actualEvent, actualProps] = captureMock.mock.calls[i]

            expect(actualEvent).toBe(expectedEvent)

            // Properties are sanitized at enqueue time
            const sanitized = expectedProps
              ? sanitizeProperties(expectedProps as Record<string, unknown>)
              : undefined
            expect(actualProps).toEqual(sanitized)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('second flush call after queue is drained is a no-op', async () => {
    jest.resetModules()
    captureMock = jest.fn()
    loadedCallback = undefined

    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn().mockImplementation(
          (_token: string, options: { loaded?: (ph: unknown) => void }) => {
            loadedCallback = options?.loaded
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

    const { initializePostHogIfAllowed } = await import('../client')
    const initPromise = initializePostHogIfAllowed()

    const { captureEvent, flushPreInitQueue } = await import('../helper')

    // Enqueue 3 events
    captureEvent(ANALYTICS_EVENTS.HOMEPAGE_VIEWED)
    captureEvent(ANALYTICS_EVENTS.CTA_CLICKED, { location: 'hero', label: 'Get started' })
    captureEvent(ANALYTICS_EVENTS.PRICING_VIEWED)

    // First flush via loaded callback
    if (loadedCallback) loadedCallback({})
    await initPromise
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(captureMock).toHaveBeenCalledTimes(3)

    // Second flush — queue is already empty, should be a no-op
    captureMock.mockClear()
    flushPreInitQueue()
    expect(captureMock).toHaveBeenCalledTimes(0)
  })

  it('silently drops events beyond MAX_QUEUE_SIZE (20) without throwing', async () => {
    jest.resetModules()
    captureMock = jest.fn()
    loadedCallback = undefined

    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: jest.fn().mockImplementation(
          (_token: string, options: { loaded?: (ph: unknown) => void }) => {
            loadedCallback = options?.loaded
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

    const { initializePostHogIfAllowed } = await import('../client')
    const initPromise = initializePostHogIfAllowed()

    const { captureEvent } = await import('../helper')

    // Enqueue 30 events — 10 beyond the cap
    for (let i = 0; i < 30; i++) {
      expect(() => captureEvent(ANALYTICS_EVENTS.HOMEPAGE_VIEWED)).not.toThrow()
    }

    if (loadedCallback) loadedCallback({})
    await initPromise
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Only the first 20 should have been flushed
    expect(captureMock).toHaveBeenCalledTimes(MAX_QUEUE_SIZE)
  })
})
