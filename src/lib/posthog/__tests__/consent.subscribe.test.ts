/**
 * Unit test: subscribeToConsentChanges
 *
 * Verifies:
 * - Subscribed listener receives the full ConsentPreferences payload after saveConsent
 * - saveConsent signature accepts exactly { analytics } and nothing else changed
 * - Multiple listeners are all notified
 * - Unsubscribe removes the listener
 * - A throwing listener does not prevent other listeners from being called
 *
 * Implements: 11.2, 11.3, 11.4
 */

// Use a fresh module for each test to avoid cross-test localStorage state
beforeEach(() => {
  window.localStorage.clear()
})

import {
  saveConsent,
  subscribeToConsentChanges,
  getStoredConsent,
  hasAnalyticsConsent,
} from '../../../lib/consent'
import type { ConsentPreferences } from '../../../lib/consent'

describe('subscribeToConsentChanges', () => {
  it('calls the listener with the full ConsentPreferences payload after saveConsent', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToConsentChanges(listener)

    saveConsent({ analytics: true })

    expect(listener).toHaveBeenCalledTimes(1)
    const payload = listener.mock.calls[0][0] as ConsentPreferences
    expect(payload.analytics).toBe(true)
    expect(typeof payload.updatedAt).toBe('string')

    unsubscribe()
  })

  it('calls the listener with analytics: false when consent is declined', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToConsentChanges(listener)

    saveConsent({ analytics: false })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].analytics).toBe(false)

    unsubscribe()
  })

  it('notifies all subscribed listeners', () => {
    const listenerA = jest.fn()
    const listenerB = jest.fn()
    const unsubA = subscribeToConsentChanges(listenerA)
    const unsubB = subscribeToConsentChanges(listenerB)

    saveConsent({ analytics: true })

    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)

    unsubA()
    unsubB()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToConsentChanges(listener)

    saveConsent({ analytics: true })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    saveConsent({ analytics: false })
    // Still only called once — unsubscribed before second saveConsent
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('a throwing listener does not prevent other listeners from being called', () => {
    const throwingListener = jest.fn(() => {
      throw new Error('listener error')
    })
    const safeListener = jest.fn()

    const unsubThrow = subscribeToConsentChanges(throwingListener)
    const unsubSafe = subscribeToConsentChanges(safeListener)

    // saveConsent should not throw even if a listener throws
    expect(() => saveConsent({ analytics: true })).not.toThrow()
    expect(safeListener).toHaveBeenCalledTimes(1)

    unsubThrow()
    unsubSafe()
  })

  it('calling unsubscribe twice is safe (idempotent)', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToConsentChanges(listener)

    unsubscribe()
    expect(() => unsubscribe()).not.toThrow()

    saveConsent({ analytics: true })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('saveConsent — signature unchanged (Req 11.4)', () => {
  it('accepts exactly { analytics: boolean } and persists to localStorage', () => {
    saveConsent({ analytics: true })
    const stored = getStoredConsent()
    expect(stored).not.toBeNull()
    expect(stored?.analytics).toBe(true)
  })

  it('hasAnalyticsConsent() reflects the saved value', () => {
    saveConsent({ analytics: true })
    expect(hasAnalyticsConsent()).toBe(true)

    saveConsent({ analytics: false })
    expect(hasAnalyticsConsent()).toBe(false)
  })
})
