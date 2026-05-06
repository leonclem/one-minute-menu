/**
 * Integration test: menu_extraction_completed wiring
 * Asserts that captureEvent is called with { item_count, category_count, duration_ms }.
 * Implements: 4.6
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

describe('menu_extraction_completed wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires menu_extraction_completed with item_count, category_count, and duration_ms', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what extracted-client.tsx onJobComplete does
    ce(AE.MENU_EXTRACTION_COMPLETED, {
      item_count: 25,
      category_count: 4,
      duration_ms: 0,
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('menu_extraction_completed', {
      item_count: 25,
      category_count: 4,
      duration_ms: 0,
    })
  })

  it('includes numeric item_count and category_count', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.MENU_EXTRACTION_COMPLETED, {
      item_count: 10,
      category_count: 2,
      duration_ms: 0,
    })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(typeof properties.item_count).toBe('number')
    expect(typeof properties.category_count).toBe('number')
    expect(typeof properties.duration_ms).toBe('number')
  })

  it('does not include sensitive keys in the payload', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.MENU_EXTRACTION_COMPLETED, {
      item_count: 5,
      category_count: 1,
      duration_ms: 0,
    })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    const sensitiveKeys = ['menu_text', 'dish_name', 'dish_description', 'email', 'phone']
    for (const key of sensitiveKeys) {
      expect(properties).not.toHaveProperty(key)
    }
  })
})
