/**
 * Component test: AnalyticsOptOutToggle — exact copy strings (Req 7.4)
 *
 * Asserts the verbatim label and description text required by the spec.
 *
 * Implements: 7.4
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/lib/posthog', () => ({
  __esModule: true,
  ANALYTICS_EVENTS: {
    ADMIN_ANALYTICS_DISABLED: 'admin_analytics_disabled',
    ADMIN_ANALYTICS_ENABLED: 'admin_analytics_enabled',
  },
  captureEvent: jest.fn(),
  setAnalyticsDisabled: jest.fn(),
  initializePostHogIfAllowed: jest.fn().mockResolvedValue(undefined),
  isAnalyticsEnabled: jest.fn().mockReturnValue(true),
  isPostHogInitialized: jest.fn().mockReturnValue(false),
  isAnalyticsDisabledByUser: jest.fn().mockReturnValue(false),
  posthogOptInCapturingIfLoaded: jest.fn(),
}))

import { AnalyticsOptOutToggle } from '../../../components/admin/AnalyticsOptOutToggle'

describe('AnalyticsOptOutToggle — copy strings (Req 7.4)', () => {
  it('renders the exact label text', () => {
    render(<AnalyticsOptOutToggle />)
    expect(
      screen.getByText('Exclude my activity from analytics')
    ).toBeInTheDocument()
  })

  it('renders the exact description text', () => {
    render(<AnalyticsOptOutToggle />)
    expect(
      screen.getByText(
        'Prevents this browser from sending GridMenu analytics events. Useful for internal testing and admin work.'
      )
    ).toBeInTheDocument()
  })

  it('renders a switch button with the correct accessible label', () => {
    render(<AnalyticsOptOutToggle />)
    expect(
      screen.getByRole('switch', { name: /exclude my activity from analytics/i })
    ).toBeInTheDocument()
  })
})
