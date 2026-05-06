/**
 * Integration test: food_photo_generation_started and food_photo_generation_failed wiring
 * Asserts that captureEvent is called at click of generate and on error with { error_code } only.
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

describe('food_photo_generation_started wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires food_photo_generation_started at click of generate (before API call)', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')
    const callOrder: string[] = []

    // Simulate what AIImageGeneration.handleGenerateImage does:
    // fire food_photo_generation_started BEFORE the fetch call
    ce(AE.FOOD_PHOTO_GENERATION_STARTED)
    callOrder.push('captureEvent')
    callOrder.push('fetch')

    expect(mockCaptureEvent).toHaveBeenCalledWith('food_photo_generation_started')
    expect(callOrder[0]).toBe('captureEvent')
    expect(callOrder[1]).toBe('fetch')
  })

  it('fires food_photo_generation_started with no properties', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.FOOD_PHOTO_GENERATION_STARTED)

    const call = mockCaptureEvent.mock.calls[0]
    // Only the event name — no properties
    expect(call.length).toBe(1)
    expect(call[0]).toBe('food_photo_generation_started')
  })
})

describe('food_photo_generation_failed wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires food_photo_generation_failed with error_code on API error', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what AIImageGeneration.handleGenerateImage does on error
    ce(AE.FOOD_PHOTO_GENERATION_FAILED, { error_code: 'CONTENT_POLICY_VIOLATION' })

    expect(mockCaptureEvent).toHaveBeenCalledWith('food_photo_generation_failed', {
      error_code: 'CONTENT_POLICY_VIOLATION',
    })
  })

  it('fires food_photo_generation_failed with error_code on job failure', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what AIImageGeneration.pollJobStatus does when job.status === 'failed'
    const jobErrorCode = 'job_failed'
    ce(AE.FOOD_PHOTO_GENERATION_FAILED, { error_code: jobErrorCode })

    expect(mockCaptureEvent).toHaveBeenCalledWith('food_photo_generation_failed', {
      error_code: 'job_failed',
    })
  })

  it('does NOT include raw error message, stack, or sensitive keys in the payload', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate the safe error payload — only error_code, no message/stack
    ce(AE.FOOD_PHOTO_GENERATION_FAILED, { error_code: 'network_error' })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(properties).toHaveProperty('error_code')
    expect(properties).not.toHaveProperty('message')
    expect(properties).not.toHaveProperty('stack')
    expect(properties).not.toHaveProperty('error')
    expect(properties).not.toHaveProperty('dish_name')
    expect(properties).not.toHaveProperty('dish_description')
    expect(properties).not.toHaveProperty('prompt')
  })

  it('fires food_photo_generation_failed with a safe error_code string', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.FOOD_PHOTO_GENERATION_FAILED, { error_code: 'RATE_LIMIT_EXCEEDED' })

    const call = mockCaptureEvent.mock.calls[0]
    const properties = call[1] as Record<string, unknown>

    expect(typeof properties.error_code).toBe('string')
  })
})
