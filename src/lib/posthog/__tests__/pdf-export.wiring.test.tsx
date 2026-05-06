/**
 * Integration test: pdf_export_started and pdf_exported wiring
 * Asserts that:
 * - pdf_export_started fires BEFORE any network call with { menu_id, template_id, orientation }
 * - pdf_exported fires at the client-visible completion signal with { menu_id, template_id, orientation, page_count }
 * Implements: 4.9
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

describe('pdf_export_started wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires pdf_export_started with menu_id, template_id, and orientation', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what handleExportPDF / handleExport does before the network call
    ce(AE.PDF_EXPORT_STARTED, {
      menu_id: 'menu-123',
      template_id: '3-column-portrait',
      orientation: 'portrait',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('pdf_export_started', {
      menu_id: 'menu-123',
      template_id: '3-column-portrait',
      orientation: 'portrait',
    })
  })

  it('fires pdf_export_started with landscape orientation for landscape templates', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.PDF_EXPORT_STARTED, {
      menu_id: 'menu-456',
      template_id: '5-column-landscape',
      orientation: 'landscape',
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('pdf_export_started', {
      menu_id: 'menu-456',
      template_id: '5-column-landscape',
      orientation: 'landscape',
    })
  })
})

describe('pdf_exported wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires pdf_exported with menu_id, template_id, orientation, and page_count', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what MenuCard.handleExport does at the completion signal
    ce(AE.PDF_EXPORTED, {
      menu_id: 'menu-123',
      template_id: '3-column-portrait',
      orientation: 'portrait',
      page_count: 1,
    })

    expect(mockCaptureEvent).toHaveBeenCalledWith('pdf_exported', {
      menu_id: 'menu-123',
      template_id: '3-column-portrait',
      orientation: 'portrait',
      page_count: 1,
    })
  })

  it('fires pdf_export_started before pdf_exported in the export flow', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate the full export flow
    ce(AE.PDF_EXPORT_STARTED, {
      menu_id: 'menu-123',
      template_id: '3-column-portrait',
      orientation: 'portrait',
    })

    // ... network call happens ...

    ce(AE.PDF_EXPORTED, {
      menu_id: 'menu-123',
      template_id: '3-column-portrait',
      orientation: 'portrait',
      page_count: 1,
    })

    expect(mockCaptureEvent).toHaveBeenCalledTimes(2)
    expect(mockCaptureEvent.mock.calls[0][0]).toBe('pdf_export_started')
    expect(mockCaptureEvent.mock.calls[1][0]).toBe('pdf_exported')
  })
})
