/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'

const mockCaptureEvent = jest.fn()

jest.mock('@/lib/posthog', () => ({
  captureEvent: (...args: unknown[]) => mockCaptureEvent(...args),
  ANALYTICS_EVENTS: {
    SIGNUP_COMPLETED: 'signup_completed',
  },
}))

import { SignupConversionBeacon } from '../SignupConversionBeacon'

describe('SignupConversionBeacon', () => {
  const originalAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const originalAdsLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL
  let gtag: jest.Mock

  beforeEach(() => {
    mockCaptureEvent.mockClear()
    gtag = jest.fn()
    ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag = gtag
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = 'AW-18081721279'
    process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL = 'JihqCIbtgJ0cEL_XhK5D'
  })

  afterEach(() => {
    delete (window as unknown as { gtag?: unknown }).gtag
    if (originalAdsId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = originalAdsId
    }
    if (originalAdsLabel === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL = originalAdsLabel
    }
  })

  it('does nothing when disabled', async () => {
    render(<SignupConversionBeacon enabled={false} />)

    await waitFor(() => {
      expect(mockCaptureEvent).not.toHaveBeenCalled()
    })
    expect(gtag).not.toHaveBeenCalled()
  })

  it('fires Google Ads conversion and PostHog signup_completed when enabled', async () => {
    render(<SignupConversionBeacon enabled />)

    await waitFor(() => {
      expect(mockCaptureEvent).toHaveBeenCalledWith('signup_completed')
    })
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: 'AW-18081721279/JihqCIbtgJ0cEL_XhK5D',
    })
  })

  it('still records PostHog when gtag is missing', async () => {
    delete (window as unknown as { gtag?: unknown }).gtag
    render(<SignupConversionBeacon enabled />)

    await waitFor(() => {
      expect(mockCaptureEvent).toHaveBeenCalledWith('signup_completed')
    })
  })

  it('skips gtag when the Ads label env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL
    render(<SignupConversionBeacon enabled />)

    await waitFor(() => {
      expect(mockCaptureEvent).toHaveBeenCalledWith('signup_completed')
    })
    expect(gtag).not.toHaveBeenCalled()
  })
})
