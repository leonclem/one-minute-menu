/**
 * Component test: AnalyticsOptOutToggle behavior
 *
 * Verifies the event-ordering contract per design §9:
 *   Off → On (disabling):  captureEvent(ADMIN_ANALYTICS_DISABLED) BEFORE setAnalyticsDisabled(true)
 *   On  → Off (enabling):  setAnalyticsDisabled(false) THEN initializePostHogIfAllowed()
 *                          THEN (only if init succeeded) posthogOptInCapturingIfLoaded() + captureEvent(ADMIN_ANALYTICS_ENABLED)
 *
 * Also verifies the no-init case (env missing) skips both the opt-in call and the enable event.
 *
 * Implements: 7.5, 7.6
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock call-order tracking
// ---------------------------------------------------------------------------

const callOrder: string[] = []

const mockCaptureEvent = jest.fn((eventName: string) => {
  callOrder.push(`captureEvent:${eventName}`)
})
const mockSetAnalyticsDisabled = jest.fn((disabled: boolean) => {
  callOrder.push(`setAnalyticsDisabled:${disabled}`)
})
const mockInitializePostHogIfAllowed = jest.fn(async () => {
  callOrder.push('initializePostHogIfAllowed')
})
const mockIsAnalyticsEnabled = jest.fn()
const mockIsPostHogInitialized = jest.fn()
const mockIsAnalyticsDisabledByUser = jest.fn()
const mockPosthogOptInCapturingIfLoaded = jest.fn(() => {
  callOrder.push('posthogOptInCapturingIfLoaded')
})

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  ANALYTICS_EVENTS: {
    ADMIN_ANALYTICS_DISABLED: 'admin_analytics_disabled',
    ADMIN_ANALYTICS_ENABLED: 'admin_analytics_enabled',
  },
  captureEvent: (eventName: string) => mockCaptureEvent(eventName),
  setAnalyticsDisabled: (disabled: boolean) => mockSetAnalyticsDisabled(disabled),
  initializePostHogIfAllowed: () => mockInitializePostHogIfAllowed(),
  isAnalyticsEnabled: () => mockIsAnalyticsEnabled(),
  isPostHogInitialized: () => mockIsPostHogInitialized(),
  isAnalyticsDisabledByUser: () => mockIsAnalyticsDisabledByUser(),
  posthogOptInCapturingIfLoaded: () => mockPosthogOptInCapturingIfLoaded(),
}))

import { AnalyticsOptOutToggle } from '../../../components/admin/AnalyticsOptOutToggle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderToggle() {
  return render(<AnalyticsOptOutToggle />)
}

function getToggleButton() {
  return screen.getByRole('switch', { name: /exclude my activity from analytics/i })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalyticsOptOutToggle — off→on (disabling analytics)', () => {
  beforeEach(() => {
    callOrder.length = 0
    jest.clearAllMocks()
    // Start with analytics enabled (toggle is off / not opted-out)
    mockIsAnalyticsDisabledByUser.mockReturnValue(false)
    mockIsAnalyticsEnabled.mockReturnValue(true)
    mockIsPostHogInitialized.mockReturnValue(true)
  })

  it('fires captureEvent(ADMIN_ANALYTICS_DISABLED) BEFORE setAnalyticsDisabled(true)', async () => {
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    const captureIdx = callOrder.indexOf('captureEvent:admin_analytics_disabled')
    const disableIdx = callOrder.indexOf('setAnalyticsDisabled:true')

    expect(captureIdx).toBeGreaterThanOrEqual(0)
    expect(disableIdx).toBeGreaterThanOrEqual(0)
    expect(captureIdx).toBeLessThan(disableIdx)
  })

  it('calls setAnalyticsDisabled(true) exactly once', async () => {
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    expect(mockSetAnalyticsDisabled).toHaveBeenCalledTimes(1)
    expect(mockSetAnalyticsDisabled).toHaveBeenCalledWith(true)
  })

  it('does NOT call captureEvent when isAnalyticsEnabled() is false', async () => {
    mockIsAnalyticsEnabled.mockReturnValue(false)
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    expect(mockCaptureEvent).not.toHaveBeenCalled()
    expect(mockSetAnalyticsDisabled).toHaveBeenCalledWith(true)
  })

  it('does NOT call initializePostHogIfAllowed on the off→on path', async () => {
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    expect(mockInitializePostHogIfAllowed).not.toHaveBeenCalled()
  })
})

describe('AnalyticsOptOutToggle — on→off (re-enabling analytics)', () => {
  beforeEach(() => {
    callOrder.length = 0
    jest.clearAllMocks()
    // Start with analytics disabled (toggle is on / opted-out)
    mockIsAnalyticsDisabledByUser.mockReturnValue(true)
    mockIsAnalyticsEnabled.mockReturnValue(false)
  })

  it('calls setAnalyticsDisabled(false) BEFORE initializePostHogIfAllowed()', async () => {
    mockIsPostHogInitialized.mockReturnValue(true)
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    const disableIdx = callOrder.indexOf('setAnalyticsDisabled:false')
    const initIdx = callOrder.indexOf('initializePostHogIfAllowed')

    expect(disableIdx).toBeGreaterThanOrEqual(0)
    expect(initIdx).toBeGreaterThanOrEqual(0)
    expect(disableIdx).toBeLessThan(initIdx)
  })

  it('calls posthogOptInCapturingIfLoaded() AFTER initializePostHogIfAllowed() when init succeeds', async () => {
    mockIsPostHogInitialized.mockReturnValue(true)
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    const initIdx = callOrder.indexOf('initializePostHogIfAllowed')
    const optInIdx = callOrder.indexOf('posthogOptInCapturingIfLoaded')

    expect(initIdx).toBeGreaterThanOrEqual(0)
    expect(optInIdx).toBeGreaterThanOrEqual(0)
    expect(initIdx).toBeLessThan(optInIdx)
  })

  it('fires captureEvent(ADMIN_ANALYTICS_ENABLED) after opt-in when init succeeds', async () => {
    mockIsPostHogInitialized.mockReturnValue(true)
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    const optInIdx = callOrder.indexOf('posthogOptInCapturingIfLoaded')
    const captureIdx = callOrder.indexOf('captureEvent:admin_analytics_enabled')

    expect(optInIdx).toBeGreaterThanOrEqual(0)
    expect(captureIdx).toBeGreaterThanOrEqual(0)
    expect(optInIdx).toBeLessThan(captureIdx)
  })

  it('skips posthogOptInCapturingIfLoaded and ADMIN_ANALYTICS_ENABLED when init is blocked (env missing)', async () => {
    // isPostHogInitialized returns false — env/consent blocked init
    mockIsPostHogInitialized.mockReturnValue(false)
    renderToggle()
    const user = userEvent.setup()

    await act(async () => {
      await user.click(getToggleButton())
    })

    expect(mockPosthogOptInCapturingIfLoaded).not.toHaveBeenCalled()
    expect(mockCaptureEvent).not.toHaveBeenCalledWith('admin_analytics_enabled')
    // setAnalyticsDisabled(false) and initializePostHogIfAllowed must still be called
    expect(mockSetAnalyticsDisabled).toHaveBeenCalledWith(false)
    expect(mockInitializePostHogIfAllowed).toHaveBeenCalledTimes(1)
  })
})
