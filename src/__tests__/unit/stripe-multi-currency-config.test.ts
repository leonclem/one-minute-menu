/**
 * Unit Tests for Multi-Currency Stripe Configuration
 * Feature: currency-support
 * 
 * Tests multi-currency Stripe Price ID configuration
 * Validates: Requirements 3.1, 3.2, 11.2
 */

import type { ProductType, BillingCurrency } from '@/lib/stripe-config'

describe('Multi-Currency Stripe Configuration', () => {
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

  describe('validateStripeConfig', () => {
    it('should not throw when all multi-currency Price IDs are configured', () => {
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).not.toThrow()
    })

    it('should throw error when STRIPE_PRICE_ID_GRID_PLUS_SGD is missing', () => {
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_SGD
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_GRID_PLUS_SGD')
      expect(() => validateStripeConfig()).toThrow('Missing required Stripe Price ID environment variables')
    })

    it('should throw error when STRIPE_PRICE_ID_GRID_PLUS_USD is missing', () => {
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_USD
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_GRID_PLUS_USD')
    })

    it('should throw error when STRIPE_PRICE_ID_GRID_PLUS_GBP is missing', () => {
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_GBP
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_GRID_PLUS_GBP')
    })

    it('should throw error when STRIPE_PRICE_ID_GRID_PLUS_AUD is missing', () => {
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_AUD
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_GRID_PLUS_AUD')
    })

    it('should throw error when STRIPE_PRICE_ID_GRID_PLUS_EUR is missing', () => {
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_EUR
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_GRID_PLUS_EUR')
    })

    it('should throw error when STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_SGD is missing', () => {
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_SGD
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_GRID_PLUS_PREMIUM_SGD')
    })

    it('should throw error when STRIPE_PRICE_ID_CREATOR_PACK_EUR is missing', () => {
      delete process.env.STRIPE_PRICE_ID_CREATOR_PACK_EUR
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow('STRIPE_PRICE_ID_CREATOR_PACK_EUR')
    })

    it('should throw descriptive error message', () => {
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_SGD
      delete process.env.STRIPE_PRICE_ID_GRID_PLUS_USD
      
      jest.resetModules()
      const { validateStripeConfig } = require('@/lib/stripe-config')
      
      expect(() => validateStripeConfig()).toThrow(
        'Missing required Stripe Price ID environment variables: STRIPE_PRICE_ID_GRID_PLUS_SGD, STRIPE_PRICE_ID_GRID_PLUS_USD'
      )
    })
  })

  describe('getPriceIdForCurrency', () => {
    it('should return correct Price ID for grid_plus and SGD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus', 'SGD')
      
      expect(priceId).toBe('price_grid_plus_sgd')
    })

    it('should return correct Price ID for grid_plus and USD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus', 'USD')
      
      expect(priceId).toBe('price_grid_plus_usd')
    })

    it('should return correct Price ID for grid_plus and GBP', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus', 'GBP')
      
      expect(priceId).toBe('price_grid_plus_gbp')
    })

    it('should return correct Price ID for grid_plus and AUD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus', 'AUD')
      
      expect(priceId).toBe('price_grid_plus_aud')
    })

    it('should return correct Price ID for grid_plus and EUR', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus', 'EUR')
      
      expect(priceId).toBe('price_grid_plus_eur')
    })

    it('should return correct Price ID for grid_plus_premium and SGD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus_premium', 'SGD')
      
      expect(priceId).toBe('price_grid_plus_premium_sgd')
    })

    it('should return correct Price ID for grid_plus_premium and USD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus_premium', 'USD')
      
      expect(priceId).toBe('price_grid_plus_premium_usd')
    })

    it('should return correct Price ID for grid_plus_premium and GBP', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus_premium', 'GBP')
      
      expect(priceId).toBe('price_grid_plus_premium_gbp')
    })

    it('should return correct Price ID for grid_plus_premium and AUD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus_premium', 'AUD')
      
      expect(priceId).toBe('price_grid_plus_premium_aud')
    })

    it('should return correct Price ID for grid_plus_premium and EUR', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('grid_plus_premium', 'EUR')
      
      expect(priceId).toBe('price_grid_plus_premium_eur')
    })

    it('should return correct Price ID for creator_pack and SGD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('creator_pack', 'SGD')
      
      expect(priceId).toBe('price_creator_pack_sgd')
    })

    it('should return correct Price ID for creator_pack and USD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('creator_pack', 'USD')
      
      expect(priceId).toBe('price_creator_pack_usd')
    })

    it('should return correct Price ID for creator_pack and GBP', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('creator_pack', 'GBP')
      
      expect(priceId).toBe('price_creator_pack_gbp')
    })

    it('should return correct Price ID for creator_pack and AUD', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('creator_pack', 'AUD')
      
      expect(priceId).toBe('price_creator_pack_aud')
    })

    it('should return correct Price ID for creator_pack and EUR', () => {
      const { getPriceIdForCurrency } = require('@/lib/stripe-config')
      
      const priceId = getPriceIdForCurrency('creator_pack', 'EUR')
      
      expect(priceId).toBe('price_creator_pack_eur')
    })
  })

  describe('getAllPriceIds', () => {
    it('should return all 5 currencies for grid_plus', () => {
      const { getAllPriceIds } = require('@/lib/stripe-config')
      
      const priceIds = getAllPriceIds('grid_plus')
      
      expect(Object.keys(priceIds)).toHaveLength(5)
      expect(priceIds).toHaveProperty('SGD', 'price_grid_plus_sgd')
      expect(priceIds).toHaveProperty('USD', 'price_grid_plus_usd')
      expect(priceIds).toHaveProperty('GBP', 'price_grid_plus_gbp')
      expect(priceIds).toHaveProperty('AUD', 'price_grid_plus_aud')
      expect(priceIds).toHaveProperty('EUR', 'price_grid_plus_eur')
    })

    it('should return all 5 currencies for grid_plus_premium', () => {
      const { getAllPriceIds } = require('@/lib/stripe-config')
      
      const priceIds = getAllPriceIds('grid_plus_premium')
      
      expect(Object.keys(priceIds)).toHaveLength(5)
      expect(priceIds).toHaveProperty('SGD', 'price_grid_plus_premium_sgd')
      expect(priceIds).toHaveProperty('USD', 'price_grid_plus_premium_usd')
      expect(priceIds).toHaveProperty('GBP', 'price_grid_plus_premium_gbp')
      expect(priceIds).toHaveProperty('AUD', 'price_grid_plus_premium_aud')
      expect(priceIds).toHaveProperty('EUR', 'price_grid_plus_premium_eur')
    })

    it('should return all 5 currencies for creator_pack', () => {
      const { getAllPriceIds } = require('@/lib/stripe-config')
      
      const priceIds = getAllPriceIds('creator_pack')
      
      expect(Object.keys(priceIds)).toHaveLength(5)
      expect(priceIds).toHaveProperty('SGD', 'price_creator_pack_sgd')
      expect(priceIds).toHaveProperty('USD', 'price_creator_pack_usd')
      expect(priceIds).toHaveProperty('GBP', 'price_creator_pack_gbp')
      expect(priceIds).toHaveProperty('AUD', 'price_creator_pack_aud')
      expect(priceIds).toHaveProperty('EUR', 'price_creator_pack_eur')
    })

    it('should return all Price IDs as non-empty strings', () => {
      const { getAllPriceIds } = require('@/lib/stripe-config')
      
      const products: ProductType[] = ['grid_plus', 'grid_plus_premium', 'creator_pack']
      
      products.forEach(product => {
        const priceIds = getAllPriceIds(product) as Record<BillingCurrency, string>
        
        Object.values(priceIds).forEach(priceId => {
          expect(typeof priceId).toBe('string')
          expect(priceId.length).toBeGreaterThan(0)
        })
      })
    })
  })
})
