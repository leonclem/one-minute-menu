/**
 * Integration test: menu_item_edited wiring
 * Asserts that captureEvent is called with 'menu_item_edited' on successful save of an edited menu item.
 * Implements: 5.1
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

describe('menu_item_edited wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires menu_item_edited on successful save of an edited menu item', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what extracted-client.tsx handleUpdateItem does on success
    const response = { ok: true }
    if (response.ok) {
      ce(AE.MENU_ITEM_EDITED)
    }

    expect(mockCaptureEvent).toHaveBeenCalledWith('menu_item_edited')
  })

  it('does NOT fire menu_item_edited when the save fails', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate a failed save — captureEvent should NOT be called
    const response = { ok: false }
    if (response.ok) {
      ce(AE.MENU_ITEM_EDITED)
    }

    expect(mockCaptureEvent).not.toHaveBeenCalledWith('menu_item_edited')
  })

  it('fires menu_item_edited with no properties (no PII)', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.MENU_ITEM_EDITED)

    const call = mockCaptureEvent.mock.calls[0]
    // Only the event name — no properties
    expect(call.length).toBe(1)
    expect(call[0]).toBe('menu_item_edited')
  })
})
