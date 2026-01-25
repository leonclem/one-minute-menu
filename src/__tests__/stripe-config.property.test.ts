/**
 * Property-Based Tests for Stripe Configuration
 * Feature: stripe-payment-integration
 * 
 * Tests Property 40: Environment Variable Validation
 * Validates: Requirements 1.5
 */

import fc from 'fast-check'
import type { ProductType } from '@/lib/stripe-config'

describe('Feature: stripe-payment-integration, Property 40: Environment Variable Validation', () => {
  // Store original environment variables
  const originalEnv = { ...process.env }

  afterEach(() => {
    // Restore original environment variables after each test
    process.env = { ...originalEnv }
    // Clear the module cache to force re-initialization
    jest.resetModules()
  })

  /**
   * Property 40: Environment Variable Validation
   * For any missing required environment variable (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, 
   * STRIPE_PUBLISHABLE_KEY, or any STRIPE_PRICE_ID), the system SHALL throw a descriptive 
   * error at initialization time.
   */
  it('should throw descriptive error for any missing required environment variable', () => {
    fc.assert(
      fc.property(
        fc.record({
          STRIPE_SECRET_KEY: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          STRIPE_PUBLISHABLE_KEY: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          STRIPE_WEBHOOK_SECRET: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          STRIPE_PRICE_ID_GRID_PLUS: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          STRIPE_PRICE_ID_GRID_PLUS_PREMIUM: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
          STRIPE_PRICE_ID_CREATOR_PACK: fc.option(fc.string().filter(s => s.length > 0), { nil: undefined }),
        }),
        (envVars) => {
          // Set environment variables
          if (envVars.STRIPE_SECRET_KEY) {
            process.env.STRIPE_SECRET_KEY = envVars.STRIPE_SECRET_KEY
          } else {
            delete process.env.STRIPE_SECRET_KEY
          }
          if (envVars.STRIPE_PUBLISHABLE_KEY) {
            process.env.STRIPE_PUBLISHABLE_KEY = envVars.STRIPE_PUBLISHABLE_KEY
          } else {
            delete process.env.STRIPE_PUBLISHABLE_KEY
          }
          if (envVars.STRIPE_WEBHOOK_SECRET) {
            process.env.STRIPE_WEBHOOK_SECRET = envVars.STRIPE_WEBHOOK_SECRET
          } else {
            delete process.env.STRIPE_WEBHOOK_SECRET
          }
          if (envVars.STRIPE_PRICE_ID_GRID_PLUS) {
            process.env.STRIPE_PRICE_ID_GRID_PLUS = envVars.STRIPE_PRICE_ID_GRID_PLUS
          } else {
            delete process.env.STRIPE_PRICE_ID_GRID_PLUS
          }
          if (envVars.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM) {
            process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = envVars.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM
          } else {
            delete process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM
          }
          if (envVars.STRIPE_PRICE_ID_CREATOR_PACK) {
            process.env.STRIPE_PRICE_ID_CREATOR_PACK = envVars.STRIPE_PRICE_ID_CREATOR_PACK
          } else {
            delete process.env.STRIPE_PRICE_ID_CREATOR_PACK
          }

          // Count missing variables
          const missing = Object.entries(envVars).filter(([_, value]) => !value)

          // Clear module cache to force re-initialization
          jest.resetModules()
          const { validateStripeConfig: freshValidate } = require('@/lib/stripe-config')

          if (missing.length > 0) {
            // If any variable is missing, should throw error
            expect(() => freshValidate()).toThrow()
            
            // Error message should mention missing variables
            try {
              freshValidate()
            } catch (error: any) {
              expect(error.message).toContain('Missing required Stripe environment variables')
              // Check that error message contains at least one missing variable name
              const hasMissingVar = missing.some(([key]) => error.message.includes(key))
              expect(hasMissingVar).toBe(true)
            }
          } else {
            // If all variables are present, should not throw
            expect(() => freshValidate()).not.toThrow()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate all required environment variables are present', () => {
    // Set all required environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_grid_plus'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_grid_plus_premium'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_creator_pack'

    // Clear module cache
    jest.resetModules()
    const { validateStripeConfig: freshValidate } = require('@/lib/stripe-config')

    // Should not throw when all variables are present
    expect(() => freshValidate()).not.toThrow()
  })

  it('should throw error when STRIPE_SECRET_KEY is missing', () => {
    delete process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_grid_plus'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_grid_plus_premium'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_creator_pack'

    jest.resetModules()
    const { validateStripeConfig: freshValidate } = require('@/lib/stripe-config')

    expect(() => freshValidate()).toThrow('STRIPE_SECRET_KEY')
  })

  it('should throw error when STRIPE_WEBHOOK_SECRET is missing', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
    delete process.env.STRIPE_WEBHOOK_SECRET
    process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_grid_plus'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_grid_plus_premium'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_creator_pack'

    jest.resetModules()
    const { validateStripeConfig: freshValidate } = require('@/lib/stripe-config')

    expect(() => freshValidate()).toThrow('STRIPE_WEBHOOK_SECRET')
  })

  it('should throw error when any STRIPE_PRICE_ID is missing', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_grid_plus'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_grid_plus_premium'
    delete process.env.STRIPE_PRICE_ID_CREATOR_PACK

    jest.resetModules()
    const { validateStripeConfig: freshValidate } = require('@/lib/stripe-config')

    expect(() => freshValidate()).toThrow('STRIPE_PRICE_ID_CREATOR_PACK')
  })

  describe('getPriceId function', () => {
    beforeEach(() => {
      // Set all required environment variables for getPriceId tests
      process.env.STRIPE_SECRET_KEY = 'sk_test_123'
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
      process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_grid_plus'
      process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_grid_plus_premium'
      process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_creator_pack'
      jest.resetModules()
    })

    it('should return correct price ID for each product type', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<ProductType>('grid_plus', 'grid_plus_premium', 'creator_pack'),
          (productType) => {
            const { getPriceId: freshGetPriceId } = require('@/lib/stripe-config')
            const priceId = freshGetPriceId(productType)
            
            // Price ID should be a non-empty string
            expect(typeof priceId).toBe('string')
            expect(priceId.length).toBeGreaterThan(0)
            
            // Price ID should match the expected environment variable
            const expectedPriceId = process.env[`STRIPE_PRICE_ID_${productType.toUpperCase()}`]
            expect(priceId).toBe(expectedPriceId)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
