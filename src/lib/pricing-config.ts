/**
 * Pricing Configuration
 * 
 * Defines price points for each product in each supported billing currency.
 * These are psychologically sensible price points, not exact FX conversions.
 */

import type { BillingCurrency } from './currency-config'

export interface PricingTier {
  id: string
  name: string
  tagline?: string
  prices: Record<BillingCurrency, number>
  period: string
  description: string
  features: string[]
  cta: string
  subtext: string
  recommended?: boolean
}

/**
 * Pricing tiers with multi-currency support
 * Prices are in the respective currency's base unit (e.g., dollars, pounds)
 */
export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'creator_pack',
    name: 'Creator Pack',
    tagline: '*First Pack free*',
    prices: {
      SGD: 95,
      USD: 75,
      GBP: 59,
      AUD: 99,
      EUR: 65,
    },
    period: 'One-time purchase',
    description: 'Perfect for independent venues needing a single, high-quality digital menu.',
    features: [
      '1 Fully customisable menu',
      'Unlimited menu edits for 1 week',
      'Unlimited image regenerations (fair-use capped*)',
      'All templates included',
      'Print-ready PDF Menu Export',
    ],
    cta: 'Buy',
    subtext: 'Purchase additional menus and edit windows.',
  },
  {
    id: 'grid_plus',
    name: 'Grid+',
    prices: {
      SGD: 39,
      USD: 35,
      GBP: 25,
      AUD: 45,
      EUR: 29,
    },
    period: 'per month',
    recommended: true,
    description: 'Ideal for growing restaurants with multiple menus and seasonal updates.',
    features: [
      'Up to 5 active menus',
      'Unlimited menu edits',
      'Unlimited image regenerations (fair-use capped*)',
      'All templates included',
      'Priority support',
      'Print-ready PDF Menu Export',
      'Social media ready PNG Menu Export',
      'Priority rendering queue',
      'All menu items image export',
    ],
    cta: 'Subscribe to Grid+',
    subtext: 'Cancel anytime. Includes all Creator Pack benefits.',
  },
  {
    id: 'grid_plus_premium',
    name: 'Grid+Premium',
    prices: {
      SGD: 129,
      USD: 109,
      GBP: 89,
      AUD: 149,
      EUR: 99,
    },
    period: 'per month',
    description: 'For busy venues and chains requiring ultimate flexibility and early access.',
    features: [
      'Unlimited active menus',
      'Unlimited menu edits',
      'Unlimited image regenerations (fair-use capped*)',
      'All templates included',
      'Priority support',
      'Print-ready PDF Menu Export',
      'Social media ready PNG Menu Export',
      'Priority rendering queue',
      'All menu items image export',
      'Early access to new templates',
    ],
    cta: 'Get Grid+Premium',
    subtext: 'Unlimited everything for the professional restaurateur.',
  },
]

/**
 * Get pricing tier by ID
 */
export function getPricingTier(id: string): PricingTier | undefined {
  return PRICING_TIERS.find(tier => tier.id === id)
}

/**
 * Get price for a specific tier and currency
 */
export function getPrice(tierId: string, currency: BillingCurrency): number {
  const tier = getPricingTier(tierId)
  if (!tier) {
    throw new Error(`Pricing tier not found: ${tierId}`)
  }
  return tier.prices[currency]
}

/**
 * Format price with currency symbol
 */
export function formatPrice(amount: number, currency: BillingCurrency): string {
  const symbols: Record<BillingCurrency, string> = {
    SGD: 'S$',
    USD: '$',
    GBP: '£',
    AUD: 'A$',
    EUR: '€',
  }
  
  return `${symbols[currency]}${amount}`
}
