/**
 * Stripe Configuration Module
 * 
 * Centralizes Stripe initialization and configuration management.
 * Validates all required environment variables and provides type-safe access.
 * Supports multi-currency pricing for international expansion.
 */

import Stripe from 'stripe'
import type { BillingCurrency } from './currency-config'

/**
 * Stripe configuration interface
 */
export interface StripeConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
  priceIds: {
    gridPlus: string
    gridPlusPremium: string
    creatorPack: string
  }
}

/**
 * Product types supported by the system
 */
export type ProductType = 'grid_plus' | 'grid_plus_premium' | 'creator_pack'

/**
 * Multi-currency price configuration
 * Maps each product type to Price IDs for all supported billing currencies
 */
export interface MultiCurrencyPriceConfig {
  productType: ProductType
  prices: {
    [K in BillingCurrency]: string // Stripe Price ID
  }
}

/**
 * Core Stripe config required for API client, webhooks, and publishable key.
 * Does not include legacy single-currency price IDs (use multi-currency env vars instead).
 */
interface CoreStripeConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
}

function loadCoreStripeConfig(): CoreStripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  const missing: string[] = []
  if (!secretKey) missing.push('STRIPE_SECRET_KEY')
  if (!publishableKey) missing.push('STRIPE_PUBLISHABLE_KEY')
  if (!webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Stripe environment variables: ${missing.join(', ')}. ` +
        `Please ensure all Stripe configuration is set in your environment.`
    )
  }

  return {
    secretKey: secretKey!,
    publishableKey: publishableKey!,
    webhookSecret: webhookSecret!,
  }
}

/**
 * Load and validate full Stripe configuration from environment variables.
 * Includes legacy single-currency price IDs (optional if using multi-currency only).
 * @throws Error if any required environment variable is missing
 */
function loadStripeConfig(): StripeConfig {
  const core = loadCoreStripeConfig()
  const gridPlusPriceId = process.env.STRIPE_PRICE_ID_GRID_PLUS
  const gridPlusPremiumPriceId = process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM
  const creatorPackPriceId = process.env.STRIPE_PRICE_ID_CREATOR_PACK

  const missing: string[] = []
  if (!gridPlusPriceId) missing.push('STRIPE_PRICE_ID_GRID_PLUS')
  if (!gridPlusPremiumPriceId) missing.push('STRIPE_PRICE_ID_GRID_PLUS_PREMIUM')
  if (!creatorPackPriceId) missing.push('STRIPE_PRICE_ID_CREATOR_PACK')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Stripe environment variables: ${missing.join(', ')}. ` +
        `Please ensure all Stripe configuration is set in your environment.`
    )
  }

  return {
    ...core,
    priceIds: {
      gridPlus: gridPlusPriceId!,
      gridPlusPremium: gridPlusPremiumPriceId!,
      creatorPack: creatorPackPriceId!,
    },
  }
}

/**
 * Load multi-currency Price IDs from environment variables
 * @param productType - The product type to load Price IDs for
 * @returns Record mapping each billing currency to its Price ID
 * @throws Error if any required Price ID is missing
 */
function loadMultiCurrencyPriceIds(productType: ProductType): Record<BillingCurrency, string> {
  const productKey = productType.toUpperCase()
  const currencies: BillingCurrency[] = ['SGD', 'USD', 'GBP', 'AUD', 'EUR']
  const priceIds: Partial<Record<BillingCurrency, string>> = {}
  const missing: string[] = []

  for (const currency of currencies) {
    const envVar = `STRIPE_PRICE_ID_${productKey}_${currency}`
    const priceId = process.env[envVar]
    
    if (!priceId) {
      missing.push(envVar)
    } else {
      priceIds[currency] = priceId
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required Stripe Price ID environment variables: ${missing.join(', ')}. ` +
      `Please ensure all multi-currency Price IDs are configured.`
    )
  }

  return priceIds as Record<BillingCurrency, string>
}

/**
 * Validate Stripe configuration (core + multi-currency Price IDs).
 * Does not require legacy single-currency price IDs.
 * @throws Error if configuration is invalid
 */
export function validateStripeConfig(): void {
  loadCoreStripeConfig()
  const products: ProductType[] = ['grid_plus', 'grid_plus_premium', 'creator_pack']
  for (const product of products) {
    loadMultiCurrencyPriceIds(product)
  }
}

/**
 * Get the Stripe Price ID for a given product type and billing currency
 * @param productType - The product type to get the price ID for
 * @param currency - The billing currency
 * @returns The Stripe Price ID for the specified product and currency
 * @throws Error if product type is invalid
 */
export function getPriceIdForCurrency(
  productType: ProductType,
  currency: BillingCurrency
): string {
  const priceIds = loadMultiCurrencyPriceIds(productType)
  return priceIds[currency]
}

/**
 * Get all Price IDs for a given product type across all billing currencies
 * @param productType - The product type to get Price IDs for
 * @returns Record mapping each billing currency to its Price ID
 * @throws Error if product type is invalid
 */
export function getAllPriceIds(productType: ProductType): Record<BillingCurrency, string> {
  return loadMultiCurrencyPriceIds(productType)
}

/**
 * Get the Stripe Price ID for a given product type
 * @param productType - The product type to get the price ID for
 * @returns The Stripe Price ID
 * @throws Error if product type is invalid
 */
export function getPriceId(productType: ProductType): string {
  const config = loadStripeConfig()
  
  switch (productType) {
    case 'grid_plus':
      return config.priceIds.gridPlus
    case 'grid_plus_premium':
      return config.priceIds.gridPlusPremium
    case 'creator_pack':
      return config.priceIds.creatorPack
    default:
      throw new Error(`Invalid product type: ${productType}`)
  }
}

/**
 * Get the webhook secret for signature verification
 * @returns The webhook secret
 */
export function getWebhookSecret(): string {
  const config = loadCoreStripeConfig()
  return config.webhookSecret
}

/**
 * Get the publishable key for client-side usage
 * @returns The publishable key
 */
export function getPublishableKey(): string {
  const config = loadCoreStripeConfig()
  return config.publishableKey
}

/**
 * Detect if Stripe is configured in test mode
 * Test mode keys start with 'sk_test_' or 'pk_test_'
 * 
 * Requirements: 9.4, 9.5
 * @returns True if in test mode, false if in production mode
 */
export function isTestMode(): boolean {
  const config = loadCoreStripeConfig()
  return config.secretKey.startsWith('sk_test_')
}

/**
 * Singleton Stripe instance
 * Initialized with the secret key from environment variables
 */
let stripeInstance: Stripe | null = null

/**
 * Get the Stripe SDK instance
 * @returns Initialized Stripe instance
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const config = loadCoreStripeConfig()
    stripeInstance = new Stripe(config.secretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  }
  return stripeInstance
}

/**
 * Export a lazy-loaded Stripe instance for convenience
 * This avoids initialization during module import
 */
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return getStripe()[prop as keyof Stripe]
  }
})
