/**
 * @jest-environment node
 */

/**
 * SSR safety test — verifies that all posthog modules can be imported and
 * their public functions called in a Node.js context (no window/document/localStorage).
 *
 * Implements: 1.6, 9.1, 9.2
 */

describe('SSR safety — Node environment (no jsdom)', () => {
  it('can import and call all client.ts public functions without throwing', async () => {
    // In Node env, typeof window === 'undefined'
    expect(typeof window).toBe('undefined')

    const client = await import('../client')

    // None of these should throw
    expect(() => client.isPostHogInitialized()).not.toThrow()
    expect(() => client.getPostHog()).not.toThrow()
    await expect(client.initializePostHogIfAllowed()).resolves.toBeUndefined()
    expect(() => client.posthogOptOutCapturingIfLoaded()).not.toThrow()
    expect(() => client.posthogOptInCapturingIfLoaded()).not.toThrow()

    // SSR guard: init should be a no-op (posthog never initialized)
    expect(client.isPostHogInitialized()).toBe(false)
    expect(client.getPostHog()).toBeNull()
  })

  it('can import and call all config.ts public functions without throwing', async () => {
    const config = await import('../config')

    expect(() => config.getPostHogToken()).not.toThrow()
    expect(() => config.getPostHogHost()).not.toThrow()
    expect(() => config.getPostHogUiHost()).not.toThrow()
    expect(() => config.isAnalyticsEnabledEnv()).not.toThrow()
    expect(() => config.isDev()).not.toThrow()
  })

  it('can import events.ts without throwing', async () => {
    const events = await import('../events')
    expect(events.ANALYTICS_EVENTS).toBeDefined()
    expect(typeof events.ANALYTICS_EVENTS).toBe('object')
  })

  it('can import and call all sanitize.ts public functions without throwing', async () => {
    const sanitize = await import('../sanitize')

    expect(() => sanitize.sanitizeProperties({})).not.toThrow()
    expect(() => sanitize.sanitizeProperties({ key: 'value' })).not.toThrow()
    expect(() => sanitize.isDistinctIdSafe('test-user-id')).not.toThrow()
    expect(() => sanitize.sanitizePersonProperties({})).not.toThrow()
  })
})
