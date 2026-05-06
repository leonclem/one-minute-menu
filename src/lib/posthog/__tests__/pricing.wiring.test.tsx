/**
 * Integration test: pricing_viewed wiring
 * Asserts that PricingPageContent fires captureEvent once with 'pricing_viewed' on mount.
 * Implements: 5.1
 */

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

// Mock supabase to avoid real auth calls
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}))

// Mock pricing config
jest.mock('@/lib/pricing-config', () => ({
  PRICING_TIERS: [
    {
      id: 'creator_pack',
      name: 'Creator Pack',
      description: 'Get started',
      price: '$0',
      period: 'Free',
      features: ['Feature 1'],
      cta: 'Get Started',
      recommended: false,
      prices: { USD: 0 },
      freeFeatures: ['Feature 1'],
    },
  ],
  formatPrice: jest.fn((price: number) => `$${price}`),
}))

// Mock BillingCurrencySelector
jest.mock('@/components/BillingCurrencySelector', () => ({
  __esModule: true,
  default: () => null,
}))

// Mock ConfirmDialog
jest.mock('@/components/ui', () => ({
  ConfirmDialog: () => null,
}))

// Mock UX components
jest.mock('@/components/ux', () => ({
  UXWrapper: ({ children }: any) => <div>{children}</div>,
  UXCard: ({ children }: any) => <div>{children}</div>,
  UXButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}))

import React from 'react'
import { render } from '@testing-library/react'
import UXPricingPageContent from '@/app/(marketing)/pricing/PricingPageContent'
import { captureEvent } from '@/lib/posthog'

const mockCaptureEvent = captureEvent as jest.MockedFunction<typeof captureEvent>

describe('pricing_viewed wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires captureEvent once with pricing_viewed on mount', () => {
    render(<UXPricingPageContent />)

    expect(mockCaptureEvent).toHaveBeenCalledWith('pricing_viewed')
  })

  it('fires pricing_viewed exactly once (not on re-render)', () => {
    const { rerender } = render(<UXPricingPageContent />)
    rerender(<UXPricingPageContent />)

    const pricingViewedCalls = mockCaptureEvent.mock.calls.filter(
      (call) => call[0] === 'pricing_viewed'
    )
    expect(pricingViewedCalls).toHaveLength(1)
  })
})
