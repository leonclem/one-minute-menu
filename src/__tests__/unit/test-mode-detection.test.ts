/**
 * Unit Tests for Test Mode Detection
 * Feature: stripe-payment-integration
 * Validates: Requirements 9.4, 9.5
 */

import { isTestModeTransaction } from '@/lib/purchase-logger'
import { isTestMode } from '@/lib/stripe-config'

describe('Test Mode Detection', () => {
  describe('isTestModeTransaction', () => {
    it('should detect test mode checkout sessions', () => {
      expect(isTestModeTransaction('cs_test_a1b2c3d4e5f6')).toBe(true)
    })

    it('should detect test mode subscriptions', () => {
      expect(isTestModeTransaction('sub_test_a1b2c3d4e5f6')).toBe(true)
    })

    it('should detect test mode invoices', () => {
      expect(isTestModeTransaction('in_test_a1b2c3d4e5f6')).toBe(true)
    })

    it('should detect test mode payment intents', () => {
      expect(isTestModeTransaction('pi_test_a1b2c3d4e5f6')).toBe(true)
    })

    it('should detect test mode charges', () => {
      expect(isTestModeTransaction('ch_test_a1b2c3d4e5f6')).toBe(true)
    })

    it('should detect test mode customers', () => {
      expect(isTestModeTransaction('cus_test_a1b2c3d4e5f6')).toBe(true)
    })

    it('should NOT detect production mode checkout sessions as test', () => {
      expect(isTestModeTransaction('cs_live_a1b2c3d4e5f6')).toBe(false)
    })

    it('should NOT detect production mode subscriptions as test', () => {
      expect(isTestModeTransaction('sub_1a2b3c4d5e6f')).toBe(false)
    })

    it('should NOT detect production mode invoices as test', () => {
      expect(isTestModeTransaction('in_1a2b3c4d5e6f')).toBe(false)
    })
  })

  describe('isTestMode (from API key)', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should detect test mode from test API key', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_51abc123'
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_51abc123'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
      process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_test_123'
      process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_test_456'
      process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_test_789'

      // Re-import to get fresh config
      jest.isolateModules(() => {
        const { isTestMode } = require('@/lib/stripe-config')
        expect(isTestMode()).toBe(true)
      })
    })

    it('should detect production mode from live API key', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_51abc123'
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_live_51abc123'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_live_123'
      process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_live_123'
      process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_live_456'
      process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_live_789'

      // Re-import to get fresh config
      jest.isolateModules(() => {
        const { isTestMode } = require('@/lib/stripe-config')
        expect(isTestMode()).toBe(false)
      })
    })
  })
})
