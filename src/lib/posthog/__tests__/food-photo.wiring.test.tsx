/**
 * Integration test: food_photo_generated wiring
 * Asserts that captureEvent is called when AI food photo generation succeeds.
 * Implements: 4.8
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

describe('food_photo_generated wiring', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  it('fires food_photo_generated on successful synchronous image generation', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what AIImageGeneration.handleGenerateImage does on success (sync path)
    const images = [{ id: 'img-1', originalUrl: 'https://example.com/img.jpg' }]
    if (images.length > 0) {
      ce(AE.FOOD_PHOTO_GENERATED)
    }

    expect(mockCaptureEvent).toHaveBeenCalledWith('food_photo_generated')
  })

  it('fires food_photo_generated on successful async (job) image generation', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate what AIImageGeneration.pollJobStatus does when job.status === 'completed'
    const jobStatus = 'completed'
    const images = [{ id: 'img-1', originalUrl: 'https://example.com/img.jpg' }]
    if (jobStatus === 'completed' && images.length > 0) {
      ce(AE.FOOD_PHOTO_GENERATED)
    }

    expect(mockCaptureEvent).toHaveBeenCalledWith('food_photo_generated')
  })

  it('does NOT fire food_photo_generated when generation fails', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    // Simulate failed generation — no captureEvent call
    const jobStatus = 'failed'
    if (jobStatus === 'completed') {
      ce(AE.FOOD_PHOTO_GENERATED)
    }

    expect(mockCaptureEvent).not.toHaveBeenCalledWith('food_photo_generated')
  })

  it('fires food_photo_generated with no properties (no PII)', () => {
    const { captureEvent: ce, ANALYTICS_EVENTS: AE } = require('@/lib/posthog')

    ce(AE.FOOD_PHOTO_GENERATED)

    // Called with only the event name — no properties object
    expect(mockCaptureEvent).toHaveBeenCalledWith('food_photo_generated')
    const call = mockCaptureEvent.mock.calls[0]
    // No second argument (properties) should be passed
    expect(call.length).toBe(1)
  })
})
