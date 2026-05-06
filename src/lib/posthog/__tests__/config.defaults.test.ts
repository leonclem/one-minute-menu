import {
  getPostHogHost,
  getPostHogUiHost,
  isAnalyticsEnabledEnv,
  getPostHogToken,
  isDev,
  SENSITIVE_KEYS,
  PERSON_PROPERTY_ALLOWLIST,
} from '../config'

describe('config.ts env-var defaults', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset env to a clean copy before each test
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    delete process.env.NEXT_PUBLIC_POSTHOG_UI_HOST
    delete process.env.NEXT_PUBLIC_ENABLE_ANALYTICS
    delete process.env.NEXT_PUBLIC_POSTHOG_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('getPostHogHost()', () => {
    it('returns the default host when NEXT_PUBLIC_POSTHOG_HOST is unset', () => {
      expect(getPostHogHost()).toBe('https://us.i.posthog.com')
    })

    it('returns the set value when NEXT_PUBLIC_POSTHOG_HOST is set', () => {
      process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://custom.proxy.example.com'
      expect(getPostHogHost()).toBe('https://custom.proxy.example.com')
    })
  })

  describe('getPostHogUiHost()', () => {
    it('returns undefined when NEXT_PUBLIC_POSTHOG_UI_HOST is unset', () => {
      expect(getPostHogUiHost()).toBeUndefined()
    })

    it('returns undefined when NEXT_PUBLIC_POSTHOG_UI_HOST is empty string', () => {
      process.env.NEXT_PUBLIC_POSTHOG_UI_HOST = ''
      expect(getPostHogUiHost()).toBeUndefined()
    })

    it('returns the set value when NEXT_PUBLIC_POSTHOG_UI_HOST is set', () => {
      process.env.NEXT_PUBLIC_POSTHOG_UI_HOST = 'https://us.posthog.com'
      expect(getPostHogUiHost()).toBe('https://us.posthog.com')
    })

    it('returns the EU host when set to EU PostHog app URL', () => {
      process.env.NEXT_PUBLIC_POSTHOG_UI_HOST = 'https://eu.posthog.com'
      expect(getPostHogUiHost()).toBe('https://eu.posthog.com')
    })
  })

  describe('isAnalyticsEnabledEnv()', () => {
    it('returns false when NEXT_PUBLIC_ENABLE_ANALYTICS is unset', () => {
      expect(isAnalyticsEnabledEnv()).toBe(false)
    })

    it('returns false for "1"', () => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = '1'
      expect(isAnalyticsEnabledEnv()).toBe(false)
    })

    it('returns false for "TRUE" (uppercase)', () => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'TRUE'
      expect(isAnalyticsEnabledEnv()).toBe(false)
    })

    it('returns false for empty string ""', () => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = ''
      expect(isAnalyticsEnabledEnv()).toBe(false)
    })

    it('returns false for "True" (mixed case)', () => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'True'
      expect(isAnalyticsEnabledEnv()).toBe(false)
    })

    it('returns false for "yes"', () => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'yes'
      expect(isAnalyticsEnabledEnv()).toBe(false)
    })

    it('returns true only for strict "true"', () => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'true'
      expect(isAnalyticsEnabledEnv()).toBe(true)
    })
  })

  describe('getPostHogToken()', () => {
    it('returns empty string when NEXT_PUBLIC_POSTHOG_TOKEN is unset', () => {
      expect(getPostHogToken()).toBe('')
    })

    it('returns the set token value', () => {
      process.env.NEXT_PUBLIC_POSTHOG_TOKEN = 'phc_test_token_123'
      expect(getPostHogToken()).toBe('phc_test_token_123')
    })
  })

  describe('isDev()', () => {
    it('returns false when NODE_ENV is "production"', () => {
      process.env.NODE_ENV = 'production'
      expect(isDev()).toBe(false)
    })

    it('returns true when NODE_ENV is "test"', () => {
      process.env.NODE_ENV = 'test'
      expect(isDev()).toBe(true)
    })

    it('returns true when NODE_ENV is "development"', () => {
      process.env.NODE_ENV = 'development'
      expect(isDev()).toBe(true)
    })
  })

  describe('SENSITIVE_KEYS', () => {
    it('contains exactly 13 keys', () => {
      expect(SENSITIVE_KEYS.size).toBe(13)
    })

    it('contains all required sensitive keys', () => {
      const requiredKeys = [
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
      for (const key of requiredKeys) {
        expect(SENSITIVE_KEYS.has(key)).toBe(true)
      }
    })
  })

  describe('PERSON_PROPERTY_ALLOWLIST', () => {
    it('contains exactly 6 keys', () => {
      expect(PERSON_PROPERTY_ALLOWLIST).toHaveLength(6)
    })

    it('contains the correct allow-listed person property keys', () => {
      expect(PERSON_PROPERTY_ALLOWLIST).toContain('role')
      expect(PERSON_PROPERTY_ALLOWLIST).toContain('plan')
      expect(PERSON_PROPERTY_ALLOWLIST).toContain('subscription_status')
      expect(PERSON_PROPERTY_ALLOWLIST).toContain('is_admin')
      expect(PERSON_PROPERTY_ALLOWLIST).toContain('is_approved')
      expect(PERSON_PROPERTY_ALLOWLIST).toContain('created_at')
    })

    it('does NOT contain account_id', () => {
      expect(PERSON_PROPERTY_ALLOWLIST).not.toContain('account_id')
    })
  })
})
