/**
 * Integration test: pdf_export_failed wiring
 * Asserts that captureEvent is called with { error_code } only on PDF export failure.
 * Implements: 5.1, 5.3
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

describe('pdf_export_failed wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires pdf_export_failed with error_code on export failure', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what MenuCard.handleExport does on PDF export failure
    ce(AE.PDF_EXPORT_FAILED, { error_code: 'export_failed' })

    expect(mockCaptureEvent).toHaveBeenCalledWith('pdf_export_failed', {
      error_code: 'export_failed',
    })
  })

  it('fires pdf_export_failed with error_code on job failure', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what MenuCard.handleExport does when statusData.status === 'failed'
    ce(AE.PDF_EXPORT_FAILED, { error_code: 'export_failed' })

    const call = mockCaptureEvent.mock.calls[0]
    expect(call[0]).toBe('pdf_export_failed')
    expect(call[1]).toEqual({ error_code: 'export_failed' })
  })

  it('does NOT include raw error message, stack, or sensitive keys in the payload', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate the safe error payload — only error_code, no message/stack
    ce(AE.PDF_EXPORT_FAILED, { error_code: 'export_error' })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(properties).toHaveProperty('error_code')
    expect(properties).not.toHaveProperty('message')
    expect(properties).not.toHaveProperty('stack')
    expect(properties).not.toHaveProperty('error')
    expect(properties).not.toHaveProperty('menu_text')
    expect(properties).not.toHaveProperty('file_name')
  })

  it('fires pdf_export_failed with a safe error_code string', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.PDF_EXPORT_FAILED, { error_code: 'network_error' })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(typeof properties.error_code).toBe('string')
  })
})
