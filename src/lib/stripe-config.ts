/**
 * Stripe Configuration Module
 * 
 * Centralizes Stripe initialization and configuration management.
 * Validates all required environment variables and provides type-safe access.
 */

import Stripe from 'stripe'

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
 * Load and validate Stripe configuration from environment variables
 * @throws Error if any required environment variable is missing
 */
function loadStripeConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const gridPlusPriceId = process.env.STRIPE_PRICE_ID_GRID_PLUS
  const gridPlusPremiumPriceId = process.env.STRIPE_PRICE_ID_GRID_PLUS_PREMIUM
  const creatorPackPriceId = process.env.STRIPE_PRICE_ID_CREATOR_PACK

  // Validate all required environment variables
  const missing: string[] = []
  
  if (!secretKey) missing.push('STRIPE_SECRET_KEY')
  if (!publishableKey) missing.push('STRIPE_PUBLISHABLE_KEY')
  if (!webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET')
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
    secretKey: secretKey!,
    publishableKey: publishableKey!,
    webhookSecret: webhookSecret!,
    priceIds: {
      gridPlus: gridPlusPriceId!,
      gridPlusPremium: gridPlusPremiumPriceId!,
      creatorPack: creatorPackPriceId!,
    },
  }
}

/**
 * Validate Stripe configuration
 * @throws Error if configuration is invalid
 */
export function validateStripeConfig(): void {
  loadStripeConfig()
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
  const config = loadStripeConfig()
  return config.webhookSecret
}

/**
 * Get the publishable key for client-side usage
 * @returns The publishable key
 */
export function getPublishableKey(): string {
  const config = loadStripeConfig()
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
  const config = loadStripeConfig()
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
    const config = loadStripeConfig()
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
