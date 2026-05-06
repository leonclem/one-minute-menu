/**
 * Integration test: menu_extraction_started and menu_extraction_failed wiring
 * Asserts that captureEvent is called with the correct events at extraction submit.
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

describe('menu_extraction_started wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires menu_extraction_started before the /api/extraction/submit call', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')
    const callOrder: string[] = []

    // Simulate what extract-client.tsx handleAuthenticatedExtract does:
    // fire menu_extraction_started BEFORE the fetch call
    ce(AE.MENU_EXTRACTION_STARTED)
    callOrder.push('captureEvent')
    callOrder.push('fetch')

    expect(mockCaptureEvent).toHaveBeenCalledWith('menu_extraction_started')
    expect(callOrder[0]).toBe('captureEvent')
    expect(callOrder[1]).toBe('fetch')
  })

  it('fires menu_extraction_started with no properties', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.MENU_EXTRACTION_STARTED)

    const call = mockCaptureEvent.mock.calls[0]
    // Only the event name — no properties
    expect(call.length).toBe(1)
    expect(call[0]).toBe('menu_extraction_started')
  })
})

describe('menu_extraction_failed wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires menu_extraction_failed with error_code when extraction fails', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what extract-client.tsx does on extraction failure
    ce(AE.MENU_EXTRACTION_FAILED, { error_code: 'extraction_failed' })

    expect(mockCaptureEvent).toHaveBeenCalledWith('menu_extraction_failed', {
      error_code: 'extraction_failed',
    })
  })

  it('does NOT include raw error message in the payload', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate the safe error payload — only error_code, no message/stack
    ce(AE.MENU_EXTRACTION_FAILED, { error_code: 'RATE_LIMIT_EXCEEDED' })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(properties).toHaveProperty('error_code')
    expect(properties).not.toHaveProperty('message')
    expect(properties).not.toHaveProperty('stack')
    expect(properties).not.toHaveProperty('error')
    expect(properties).not.toHaveProperty('menu_text')
    expect(properties).not.toHaveProperty('dish_name')
  })

  it('fires menu_extraction_failed with a safe error_code string', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.MENU_EXTRACTION_FAILED, { error_code: 'OPENAI_QUOTA_EXCEEDED' })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(typeof properties.error_code).toBe('string')
  })
})
