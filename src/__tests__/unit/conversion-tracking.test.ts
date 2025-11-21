import '@testing-library/jest-dom'

import { getABVariant, trackConversionEvent, initWebVitalsTracking } from '@/lib/conversion-tracking'

describe('conversion tracking utilities', () => {
  beforeEach(() => {
    // @ts-expect-error test environment
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    window.localStorage.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
    // @ts-expect-error test environment
    global.fetch = undefined
  })

  it('uses a stable A/B variant per test name', () => {
    const variant1 = getABVariant('home_cta', ['A', 'B'])
    const variant2 = getABVariant('home_cta', ['A', 'B'])

    expect(variant1).toBe(variant2)
    expect(['A', 'B']).toContain(variant1)
  })

  it('sends conversion events via fetch when sendBeacon is not available', async () => {
    // Ensure sendBeacon is not used in this test
    const originalNavigator = global.navigator
    // @ts-expect-error override for test
    global.navigator = {} as Navigator

    await trackConversionEvent({
      event: 'landing_view',
      metadata: { path: '/ux' },
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/analytics/conversion')

    // restore
    // @ts-expect-error restore
    global.navigator = originalNavigator
  })

  it('initialises web vitals tracking without throwing in jsdom', () => {
    // jsdom does not provide PerformanceObserver; this should no-op
    expect(() => initWebVitalsTracking()).not.toThrow()
  })
})

