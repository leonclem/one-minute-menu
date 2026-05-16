import { ANALYTICS_EVENTS, AnalyticsEventName } from '../events'

describe('ANALYTICS_EVENTS registry', () => {
  const entries = Object.entries(ANALYTICS_EVENTS)
  const values = Object.values(ANALYTICS_EVENTS)

  it('has exactly 24 entries', () => {
    expect(entries).toHaveLength(24)
  })

  it('contains every required key from Req 3.1', () => {
    const requiredKeys = [
      'HOMEPAGE_VIEWED',
      'CTA_CLICKED',
      'PRICING_VIEWED',
      'SIGNUP_STARTED',
      'SIGNUP_COMPLETED',
      'LOGIN_COMPLETED',
      'MENU_CREATION_STARTED',
      'MENU_IMAGE_UPLOADED',
      'MENU_EXTRACTION_STARTED',
      'MENU_EXTRACTION_COMPLETED',
      'MENU_EXTRACTION_FAILED',
      'MENU_ITEM_EDITED',
      'TEMPLATE_SELECTED',
      'FOOD_PHOTO_GENERATION_STARTED',
      'FOOD_PHOTO_GENERATED',
      'FOOD_PHOTO_GENERATION_FAILED',
      'PDF_EXPORT_STARTED',
      'PDF_EXPORTED',
      'PDF_EXPORT_FAILED',
      'CHECKOUT_STARTED',
      'SUBSCRIPTION_STARTED',
      'ADMIN_ANALYTICS_DISABLED',
      'ADMIN_ANALYTICS_ENABLED',
    ] as const

    for (const key of requiredKeys) {
      expect(ANALYTICS_EVENTS).toHaveProperty(key)
    }
  })

  it('all values are lowercase snake_case matching /^[a-z][a-z0-9_]*$/', () => {
    const snakeCaseRegex = /^[a-z][a-z0-9_]*$/
    for (const value of values) {
      expect(value).toMatch(snakeCaseRegex)
    }
  })

  it('values match expected strings character-for-character', () => {
    expect(ANALYTICS_EVENTS.HOMEPAGE_VIEWED).toBe('homepage_viewed')
    expect(ANALYTICS_EVENTS.CTA_CLICKED).toBe('cta_clicked')
    expect(ANALYTICS_EVENTS.PRICING_VIEWED).toBe('pricing_viewed')
    expect(ANALYTICS_EVENTS.SIGNUP_STARTED).toBe('signup_started')
    expect(ANALYTICS_EVENTS.SIGNUP_COMPLETED).toBe('signup_completed')
    expect(ANALYTICS_EVENTS.LOGIN_COMPLETED).toBe('login_completed')
    expect(ANALYTICS_EVENTS.MENU_CREATION_STARTED).toBe('menu_creation_started')
    expect(ANALYTICS_EVENTS.MENU_IMAGE_UPLOADED).toBe('menu_image_uploaded')
    expect(ANALYTICS_EVENTS.MENU_EXTRACTION_STARTED).toBe('menu_extraction_started')
    expect(ANALYTICS_EVENTS.MENU_EXTRACTION_COMPLETED).toBe('menu_extraction_completed')
    expect(ANALYTICS_EVENTS.MENU_EXTRACTION_FAILED).toBe('menu_extraction_failed')
    expect(ANALYTICS_EVENTS.MENU_ITEM_EDITED).toBe('menu_item_edited')
    expect(ANALYTICS_EVENTS.TEMPLATE_SELECTED).toBe('template_selected')
    expect(ANALYTICS_EVENTS.FOOD_PHOTO_GENERATION_STARTED).toBe('food_photo_generation_started')
    expect(ANALYTICS_EVENTS.FOOD_PHOTO_GENERATED).toBe('food_photo_generated')
    expect(ANALYTICS_EVENTS.FOOD_PHOTO_GENERATION_FAILED).toBe('food_photo_generation_failed')
    expect(ANALYTICS_EVENTS.PDF_EXPORT_STARTED).toBe('pdf_export_started')
    expect(ANALYTICS_EVENTS.PDF_EXPORTED).toBe('pdf_exported')
    expect(ANALYTICS_EVENTS.PDF_EXPORT_FAILED).toBe('pdf_export_failed')
    expect(ANALYTICS_EVENTS.CHECKOUT_STARTED).toBe('checkout_started')
    expect(ANALYTICS_EVENTS.SUBSCRIPTION_STARTED).toBe('subscription_started')
    expect(ANALYTICS_EVENTS.ADMIN_ANALYTICS_DISABLED).toBe('admin_analytics_disabled')
    expect(ANALYTICS_EVENTS.ADMIN_ANALYTICS_ENABLED).toBe('admin_analytics_enabled')
    expect(ANALYTICS_EVENTS.FIRST_TEMPLATE_VISIT).toBe('first_template_visit')
  })

  it('AnalyticsEventName type covers all values (compile-time check)', () => {
    // This is a compile-time check: assigning each value to AnalyticsEventName must compile.
    // If the type is wrong, TypeScript will error here.
    const allValues: AnalyticsEventName[] = Object.values(ANALYTICS_EVENTS)
    expect(allValues).toHaveLength(24)
  })

  it('all values are unique (no duplicates)', () => {
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)
  })
})
