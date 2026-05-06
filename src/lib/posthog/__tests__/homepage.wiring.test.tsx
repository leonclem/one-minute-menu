/**
 * Integration test: homepage_viewed wiring
 * Asserts that HomepageAnalytics fires captureEvent once with 'homepage_viewed' and no properties.
 * Implements: 4.1
 */

import React from 'react'
import { render } from '@testing-library/react'

jest.mock('@/lib/posthog', () => ({
  captureEvent: jest.fn(),
  ANALYTICS_EVENTS: {
    HOMEPAGE_VIEWED: 'homepage_viewed',
    CTA_CLICKED: 'cta_clicked',
    PRICING_VIEWED: 'pricing_viewed',
    SIGNUP_STARTED: 'signup_started',
    SIGNUP_COMPLETED: 'signup_completed',
    LOGIN_COMPLETED: 'login_completed',
    MENU_CREATION_STARTED: 'menu_creation_started',
    MENU_IMAGE_UPLOADED: 'menu_image_uploaded',
    MENU_EXTRACTION_STARTED: 'menu_extraction_started',
    MENU_EXTRACTION_COMPLETED: 'menu_extraction_completed',
    MENU_EXTRACTION_FAILED: 'menu_extraction_failed',
    MENU_ITEM_EDITED: 'menu_item_edited',
    TEMPLATE_SELECTED: 'template_selected',
    FOOD_PHOTO_GENERATION_STARTED: 'food_photo_generation_started',
    FOOD_PHOTO_GENERATED: 'food_photo_generated',
    FOOD_PHOTO_GENERATION_FAILED: 'food_photo_generation_failed',
    PDF_EXPORT_STARTED: 'pdf_export_started',
    PDF_EXPORTED: 'pdf_exported',
    PDF_EXPORT_FAILED: 'pdf_export_failed',
    CHECKOUT_STARTED: 'checkout_started',
    SUBSCRIPTION_STARTED: 'subscription_started',
    ADMIN_ANALYTICS_DISABLED: 'admin_analytics_disabled',
    ADMIN_ANALYTICS_ENABLED: 'admin_analytics_enabled',
  },
}))

import HomepageAnalytics from '@/app/(marketing)/HomepageAnalytics'
import { captureEvent } from '@/lib/posthog'

const mockCaptureEvent = captureEvent as jest.MockedFunction<typeof captureEvent>

describe('HomepageAnalytics wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires captureEvent once with homepage_viewed and no properties on mount', () => {
    render(<HomepageAnalytics />)

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1)
    expect(mockCaptureEvent).toHaveBeenCalledWith('homepage_viewed')
  })

  it('does not fire captureEvent again on re-render', () => {
    const { rerender } = render(<HomepageAnalytics />)
    rerender(<HomepageAnalytics />)

    expect(mockCaptureEvent).toHaveBeenCalledTimes(1)
  })

  it('renders null (no DOM output)', () => {
    const { container } = render(<HomepageAnalytics />)
    expect(container.firstChild).toBeNull()
  })
})
