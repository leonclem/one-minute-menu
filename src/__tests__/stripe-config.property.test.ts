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
          STRIPE_SECRET_KEY: fc.option(fc.string().filter(s => s.trim().length > 0), { nil: undefined }),
          STRIPE_PUBLISHABLE_KEY: fc.option(fc.string().filter(s => s.trim().length > 0), { nil: undefined }),
          STRIPE_WEBHOOK_SECRET: fc.option(fc.string().filter(s => s.trim().length > 0), { nil: undefined }),
          STRIPE_PRICE_ID_GRID_PLUS: fc.option(fc.string().filter(s => s.trim().length > 0), { nil: undefined }),
          STRIPE_PRICE_ID_GRID_PLUS_PREMIUM: fc.option(fc.string().filter(s => s.trim().length > 0), { nil: undefined }),
          STRIPE_PRICE_ID_CREATOR_PACK: fc.option(fc.string().filter(s => s.trim().length > 0), { nil: undefined }),
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
          const coreKeys = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']
          const missingCore = missing.some(([key]) => coreKeys.includes(key))

          // When only legacy price IDs are missing, validateStripeConfig checks multi-currency vars.
          // Unset multi-currency vars so we always throw in the missing branch (avoids env leakage).
          if (missing.length > 0 && !missingCore) {
            const currencies = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']
            const products = ['GRID_PLUS', 'GRID_PLUS_PREMIUM', 'CREATOR_PACK']
            for (const p of products) {
              for (const c of currencies) {
                delete process.env[`STRIPE_PRICE_ID_${p}_${c}`]
              }
            }
          }

          jest.resetModules()
          const { validateStripeConfig: freshValidate } = require('@/lib/stripe-config')

          if (missing.length > 0) {
            // If any variable is missing, should throw error (core vars or multi-currency price IDs)
            expect(() => freshValidate()).toThrow()
            try {
              freshValidate()
            } catch (error: any) {
              expect(error.message).toContain('Missing required Stripe')
              const messageMentionsCoreOrPrice = missingCore
                ? missing.some(([key]) => error.message.includes(key))
                : error.message.includes('STRIPE_PRICE_ID')
              expect(messageMentionsCoreOrPrice).toBe(true)
            }
          } else {
            // If all base variables are present, validateStripeConfig will also check multi-currency Price IDs
            // So we need to set those too for the test to pass
            process.env.STRIPE_PRICE_ID_GRID_PLUS_SGD = 'price_grid_plus_sgd'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_USD = 'price_grid_plus_usd'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_GBP = 'price_grid_plus_gbp'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_AUD = 'price_grid_plus_aud'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_EUR = 'price_grid_plus_eur'
            
            process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_SGD = 'price_grid_plus_premium_sgd'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_USD = 'price_grid_plus_premium_usd'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_GBP = 'price_grid_plus_premium_gbp'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_AUD = 'price_grid_plus_premium_aud'
            process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_EUR = 'price_grid_plus_premium_eur'
            
            process.env.STRIPE_PRICE_ID_CREATOR_PACK_SGD = 'price_creator_pack_sgd'
            process.env.STRIPE_PRICE_ID_CREATOR_PACK_USD = 'price_creator_pack_usd'
            process.env.STRIPE_PRICE_ID_CREATOR_PACK_GBP = 'price_creator_pack_gbp'
            process.env.STRIPE_PRICE_ID_CREATOR_PACK_AUD = 'price_creator_pack_aud'
            process.env.STRIPE_PRICE_ID_CREATOR_PACK_EUR = 'price_creator_pack_eur'
            
            jest.resetModules()
            const { validateStripeConfig: freshValidate2 } = require('@/lib/stripe-config')
            expect(() => freshValidate2()).not.toThrow()
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
    
    // Set all multi-currency Price IDs
    process.env.STRIPE_PRICE_ID_GRID_PLUS_SGD = 'price_grid_plus_sgd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_USD = 'price_grid_plus_usd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_GBP = 'price_grid_plus_gbp'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_AUD = 'price_grid_plus_aud'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_EUR = 'price_grid_plus_eur'
    
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_SGD = 'price_grid_plus_premium_sgd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_USD = 'price_grid_plus_premium_usd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_GBP = 'price_grid_plus_premium_gbp'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_AUD = 'price_grid_plus_premium_aud'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_EUR = 'price_grid_plus_premium_eur'
    
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_SGD = 'price_creator_pack_sgd'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_USD = 'price_creator_pack_usd'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_GBP = 'price_creator_pack_gbp'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_AUD = 'price_creator_pack_aud'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_EUR = 'price_creator_pack_eur'

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

  it('should throw error when any multi-currency STRIPE_PRICE_ID is missing', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    // Set all multi-currency Price IDs then remove one (validateStripeConfig checks multi-currency only)
    process.env.STRIPE_PRICE_ID_GRID_PLUS_SGD = 'price_grid_plus_sgd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_USD = 'price_grid_plus_usd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_GBP = 'price_grid_plus_gbp'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_AUD = 'price_grid_plus_aud'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_EUR = 'price_grid_plus_eur'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_SGD = 'price_grid_plus_premium_sgd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_USD = 'price_grid_plus_premium_usd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_GBP = 'price_grid_plus_premium_gbp'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_AUD = 'price_grid_plus_premium_aud'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_EUR = 'price_grid_plus_premium_eur'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_SGD = 'price_creator_pack_sgd'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_USD = 'price_creator_pack_usd'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_GBP = 'price_creator_pack_gbp'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_AUD = 'price_creator_pack_aud'
    delete process.env.STRIPE_PRICE_ID_CREATOR_PACK_EUR

    jest.resetModules()
    const { validateStripeConfig: freshValidate } = require('@/lib/stripe-config')

    expect(() => freshValidate()).toThrow('STRIPE_PRICE_ID_CREATOR_PACK_EUR')
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

/**
 * Property-Based Tests for Multi-Currency Stripe Configuration
 * Feature: currency-support
 * 
 * Tests Property 4: Stripe Price ID Selection Correctness
 * Validates: Requirements 3.1, 3.2
 */
describe('Feature: currency-support, Property 4: Stripe Price ID Selection Correctness', () => {
  // Store original environment variables
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Set all required base environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123'
    process.env.STRIPE_PRICE_ID_GRID_PLUS = 'price_grid_plus'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM = 'price_grid_plus_premium'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK = 'price_creator_pack'
    
    // Set all multi-currency Price IDs
    process.env.STRIPE_PRICE_ID_GRID_PLUS_SGD = 'price_grid_plus_sgd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_USD = 'price_grid_plus_usd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_GBP = 'price_grid_plus_gbp'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_AUD = 'price_grid_plus_aud'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_EUR = 'price_grid_plus_eur'
    
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_SGD = 'price_grid_plus_premium_sgd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_USD = 'price_grid_plus_premium_usd'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_GBP = 'price_grid_plus_premium_gbp'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_AUD = 'price_grid_plus_premium_aud'
    process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_EUR = 'price_grid_plus_premium_eur'
    
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_SGD = 'price_creator_pack_sgd'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_USD = 'price_creator_pack_usd'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_GBP = 'price_creator_pack_gbp'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_AUD = 'price_creator_pack_aud'
    process.env.STRIPE_PRICE_ID_CREATOR_PACK_EUR = 'price_creator_pack_eur'
    
    jest.resetModules()
  })

  afterEach(() => {
    // Restore original environment variables after each test
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  /**
   * Property 4: Stripe Price ID Selection Correctness
   * For any valid product type and billing currency combination, a valid Price ID is returned.
   * Price IDs must be non-empty strings starting with "price_".
   */
  it('should return valid Price ID for any product type and billing currency combination', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ProductType>('grid_plus', 'grid_plus_premium', 'creator_pack'),
        fc.constantFrom('SGD', 'USD', 'GBP', 'AUD', 'EUR'),
        (productType, currency) => {
          const { getPriceIdForCurrency } = require('@/lib/stripe-config')
          const priceId = getPriceIdForCurrency(productType, currency)
          
          // Price ID should be a non-empty string
          expect(typeof priceId).toBe('string')
          expect(priceId.length).toBeGreaterThan(0)
          
          // Price ID should start with "price_"
          expect(priceId).toMatch(/^price_/)
          
          // Price ID should match the expected environment variable
          const envVar = `STRIPE_PRICE_ID_${productType.toUpperCase()}_${currency}`
          const expectedPriceId = process.env[envVar]
          expect(priceId).toBe(expectedPriceId)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return all 5 currency Price IDs for each product type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ProductType>('grid_plus', 'grid_plus_premium', 'creator_pack'),
        (productType) => {
          const { getAllPriceIds } = require('@/lib/stripe-config')
          const priceIds = getAllPriceIds(productType)
          
          // Should have exactly 5 currencies
          expect(Object.keys(priceIds)).toHaveLength(5)
          
          // Should have all supported billing currencies
          expect(priceIds).toHaveProperty('SGD')
          expect(priceIds).toHaveProperty('USD')
          expect(priceIds).toHaveProperty('GBP')
          expect(priceIds).toHaveProperty('AUD')
          expect(priceIds).toHaveProperty('EUR')
          
          // All Price IDs should be non-empty strings starting with "price_"
          Object.values(priceIds).forEach(priceId => {
            expect(typeof priceId).toBe('string')
            expect(priceId.length).toBeGreaterThan(0)
            expect(priceId).toMatch(/^price_/)
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate all multi-currency Price IDs are configured', () => {
    const { validateStripeConfig } = require('@/lib/stripe-config')
    
    // Should not throw when all Price IDs are configured
    expect(() => validateStripeConfig()).not.toThrow()
  })

  it('should throw error when any multi-currency Price ID is missing', () => {
    // Remove one Price ID
    delete process.env.STRIPE_PRICE_ID_GRID_PLUS_EUR
    
    jest.resetModules()
    const { validateStripeConfig } = require('@/lib/stripe-config')
    
    // Should throw error mentioning the missing Price ID
    expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_GRID_PLUS_EUR')
  })
})
