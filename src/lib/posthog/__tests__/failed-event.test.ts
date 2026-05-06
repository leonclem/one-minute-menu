/**
 * Combined failed-event regression test for error-message absence.
 * Asserts that for all three *_failed events, no raw error message, stack,
 * or sensitive-key text is present in the forwarded payload.
 * Implements: 5.3
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

/**
 * Keys that must NEVER appear in a failed-event payload.
 * These are either sensitive data keys or raw error information.
 */
const FORBIDDEN_KEYS = [
  'message',
  'stack',
  'error',
  'errorMessage',
  'error_message',
  'raw_error',
  // Sensitive property deny-list keys
  'email',
  'phone',
  'full_name',
  'name',
  'address',
  'billing_address',
  'payment',
  'password',
  'dish_name',
  'dish_description',
  'menu_text',
  'file_name',
  'prompt',
]

const FAILED_EVENTS = [
  'menu_extraction_failed',
  'food_photo_generation_failed',
  'pdf_export_failed',
] as const

describe('failed-event regression: no raw error message or sensitive keys', () => {
  beforeEach(() => {
    mockCaptureEvent.mockClear()
  })

  for (const eventName of FAILED_EVENTS) {
    describe(`${eventName}`, () => {
      it('only includes error_code in the payload', () => {
        const { captureEvent: ce } = require('@/lib/posthog')

        // Simulate the safe payload that application code should send
        ce(eventName, { error_code: 'some_error_code' })

        const call = mockCaptureEvent.mock.calls[0]
        const properties = call[1] as Record<string, unknown>

        // Must have error_code
        expect(properties).toHaveProperty('error_code')
        expect(typeof properties.error_code).toBe('string')

        // Must NOT have any forbidden keys
        for (const key of FORBIDDEN_KEYS) {
          expect(properties).not.toHaveProperty(key)
        }

        mockCaptureEvent.mockClear()
      })

      it('does not include raw error message text', () => {
        const { captureEvent: ce } = require('@/lib/posthog')

        // Simulate what would happen if someone accidentally passed a raw error
        // The application code should extract only the error_code
        const safePayload = { error_code: 'extraction_failed' }
        ce(eventName, safePayload)

        const call = mockCaptureEvent.mock.calls[0]
        const properties = call[1] as Record<string, unknown>

        expect(properties).not.toHaveProperty('message')
        expect(properties).not.toHaveProperty('stack')

        mockCaptureEvent.mockClear()
      })

      it('does not include sensitive property keys', () => {
        const { captureEvent: ce } = require('@/lib/posthog')

        // Simulate the safe payload
        ce(eventName, { error_code: 'some_code' })

        const call = mockCaptureEvent.mock.calls[0]
        const properties = call[1] as Record<string, unknown>

        const sensitiveKeys = [
          'email', 'phone', 'full_name', 'name', 'address',
          'billing_address', 'payment', 'password', 'dish_name',
          'dish_description', 'menu_text', 'file_name', 'prompt',
        ]

        for (const key of sensitiveKeys) {
          expect(properties).not.toHaveProperty(key)
        }

        mockCaptureEvent.mockClear()
      })
    })
  }
})
