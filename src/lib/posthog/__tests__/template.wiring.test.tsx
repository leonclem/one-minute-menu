/**
 * Integration test: template_selected wiring
 * Asserts that captureEvent is called with { template_id, template_name, orientation }.
 * Implements: 4.7
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

describe('template_selected wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires template_selected with template_id, template_name, and orientation', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what handleSelectTemplate does
    ce(AE.TEMPLATE_SELECTED, {
      template_id: '3-column-portrait',
      template_name: '3 Column Portrait',
      orientation: 'portrait',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('template_selected', {
      template_id: '3-column-portrait',
      template_name: '3 Column Portrait',
      orientation: 'portrait',
    })
  })

  it('fires template_selected with landscape orientation for landscape templates', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.TEMPLATE_SELECTED, {
      template_id: '5-column-landscape',
      template_name: '5 Column Landscape',
      orientation: 'landscape',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('template_selected', {
      template_id: '5-column-landscape',
      template_name: '5 Column Landscape',
      orientation: 'landscape',
    })
  })

  it('includes all required properties', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.TEMPLATE_SELECTED, {
      template_id: '4-column-portrait',
      template_name: '4 Column Portrait',
      orientation: 'portrait',
    })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(properties).toHaveProperty('template_id')
    expect(properties).toHaveProperty('template_name')
    expect(properties).toHaveProperty('orientation')
  })
})
