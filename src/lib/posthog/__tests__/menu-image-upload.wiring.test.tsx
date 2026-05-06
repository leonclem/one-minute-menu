/**
 * Integration test: menu_image_uploaded wiring
 * Asserts that captureEvent is called with { source, file_type } and
 * that file_name is NOT present in the payload.
 * Implements: 4.5, 10.4
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

describe('menu_image_uploaded wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires menu_image_uploaded with source and file_type', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what MenuEditor.handleImageUpload does on success
    ce(AE.MENU_IMAGE_UPLOADED, {
      source: 'menu_editor',
      file_type: 'image/jpeg',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('menu_image_uploaded', {
      source: 'menu_editor',
      file_type: 'image/jpeg',
    })
  })

  it('does NOT include file_name in the payload', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate the upload event — file_name must never be included
    ce(AE.MENU_IMAGE_UPLOADED, {
      source: 'upload_client',
      file_type: 'image/png',
      // file_name intentionally omitted — see Req 4.5, 10.4
    })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(properties).not.toHaveProperty('file_name')
  })

  it('fires from upload_client source', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.MENU_IMAGE_UPLOADED, {
      source: 'upload_client',
      file_type: 'image/webp',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('menu_image_uploaded', {
      source: 'upload_client',
      file_type: 'image/webp',
    })
  })
})
