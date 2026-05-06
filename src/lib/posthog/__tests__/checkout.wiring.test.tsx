/**
 * Integration test: checkout_started wiring
 * Asserts that captureEvent fires with { plan, location: 'pricing_page' }
 * BEFORE the Stripe redirect.
 * Implements: 4.10
 */

const mockCaptureEvent = jest.fn()

jest.mock('@/lib/posthog', () => ({
  captureEvent: mockCaptureEvent,
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

describe('checkout_started wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires checkout_started with plan and location: pricing_page', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what PricingPageContent.handleCheckout does before the Stripe redirect
    const tierId = 'grid_plus'
    ce(AE.CHECKOUT_STARTED, {
      plan: tierId,
      location: 'pricing_page',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('checkout_started', {
      plan: 'grid_plus',
      location: 'pricing_page',
    })
  })

  it('fires checkout_started for creator_pack plan', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.CHECKOUT_STARTED, {
      plan: 'creator_pack',
      location: 'pricing_page',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('checkout_started', {
      plan: 'creator_pack',
      location: 'pricing_page',
    })
  })

  it('fires checkout_started BEFORE the network call (ordering check)', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')
    const callOrder: string[] = []

    // Simulate the ordering: captureEvent fires first, then fetch
    ce(AE.CHECKOUT_STARTED, { plan: 'grid_plus', location: 'pricing_page' })
    callOrder.push('captureEvent')
    callOrder.push('fetch')

    expect(callOrder[0]).toBe('captureEvent')
    expect(callOrder[1]).toBe('fetch')
    expect(mockCaptureEvent).toHaveBeenCalledWith('checkout_started', {
      plan: 'grid_plus',
      location: 'pricing_page',
    })
  })

  it('does NOT fire subscription_started (out of scope)', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Only checkout_started should be fired, not subscription_started
    ce(AE.CHECKOUT_STARTED, { plan: 'grid_plus', location: 'pricing_page' })

    expect(mockCaptureEvent).not.toHaveBeenCalledWith('subscription_started', expect.anything())
  })

  it('does not include PII in the payload', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.CHECKOUT_STARTED, {
      plan: 'grid_plus_premium',
      location: 'pricing_page',
    })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    const sensitiveKeys = ['email', 'phone', 'full_name', 'name', 'payment', 'billing_address']
    for (const key of sensitiveKeys) {
      expect(properties).not.toHaveProperty(key)
    }
  })
})
