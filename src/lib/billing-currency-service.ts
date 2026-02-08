/**
 * Billing Currency Service (Domain A)
 * 
 * Manages billing currency selection, persistence, and Stripe integration.
 * This service handles how restaurateurs pay GridMenu subscription fees.
 * 
 * CRITICAL: This service is completely independent from Menu Currency Service (Domain B).
 * Billing and menu currencies must never cross-pollinate.
 * 
 * Currency precedence hierarchy:
 * 1. Active subscription currency (immutable, highest priority)
 * 2. Account preference (profiles.billing_currency)
 * 3. localStorage (anonymous users)
 * 
 * Requirements: 1.4, 1.5, 1.6, 3.1, 3.5, 4.1, 4.4, 15.4, 15.5
 */

import type { BillingCurrency } from './currency-config';
import { SUPPORTED_BILLING_CURRENCIES } from './currency-config';
import { getPriceIdForCurrency } from './stripe-config';
import type { ProductType } from './stripe-config';
import {
  getLocalStorageBillingCurrency as getStoredBillingCurrency,
  setLocalStorageBillingCurrency as setStoredBillingCurrency,
} from './billing-currency-storage';

/**
 * Billing currency preference with metadata
 */
export interface BillingCurrencyPreference {
  currency: BillingCurrency;
  source: 'geo' | 'manual' | 'subscription';
  lastUpdated: Date;
}

/**
 * Result of checking if billing currency can be changed
 */
export interface CanChangeBillingCurrencyResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Get current billing currency preference
 * 
 * Precedence order:
 * 1. Active subscription currency (if exists)
 * 2. Account preference (if authenticated)
 * 3. localStorage (if anonymous)
 * 4. Default to USD
 * 
 * @param userId - Optional user ID for authenticated users
 * @returns Promise resolving to billing currency
 * 
 * Requirements: 1.4, 1.5, 1.6, 3.5
 */
export async function getBillingCurrency(userId?: string): Promise<BillingCurrency> {
  // 1. Check for active subscription currency (highest priority)
  if (userId) {
    const subscriptionCurrency = await getSubscriptionBillingCurrency(userId);
    if (subscriptionCurrency) {
      return subscriptionCurrency;
    }

    // 2. Check account preference
    const accountCurrency = await getAccountBillingCurrency(userId);
    if (accountCurrency) {
      return accountCurrency;
    }
  }

  // 3. Check localStorage for anonymous users (client-safe module)
  const localStorageCurrency = getStoredBillingCurrency();
  if (localStorageCurrency) {
    return localStorageCurrency;
  }

  // 4. Default to USD
  return 'USD';
}

/**
 * Set billing currency preference
 * 
 * For authenticated users: Persists to profiles.billing_currency
 * For anonymous users: Persists to localStorage
 * 
 * IMPORTANT: This does NOT change subscription currency.
 * Active subscriptions maintain their original currency.
 * 
 * @param currency - Billing currency to set
 * @param userId - Optional user ID for authenticated users
 * @throws Error if currency is not supported
 * 
 * Requirements: 1.4, 1.5, 1.6, 15.4, 15.5
 */
export async function setBillingCurrency(
  currency: BillingCurrency,
  userId?: string
): Promise<void> {
  // Validate currency is supported
  if (!isValidBillingCurrency(currency)) {
    throw new Error(
      `Invalid billing currency: ${currency}. ` +
      `Supported currencies are: ${SUPPORTED_BILLING_CURRENCIES.join(', ')}`
    );
  }

  if (userId) {
    // Authenticated user: persist to database
    await setAccountBillingCurrency(userId, currency);
  } else {
    // Anonymous user: persist to localStorage (client-safe module)
    setStoredBillingCurrency(currency);
  }
}

/**
 * Get Stripe Price ID for checkout
 * 
 * Combines product type and billing currency to retrieve the correct
 * Stripe Price ID for creating a checkout session.
 * 
 * @param productType - The product type (grid_plus, grid_plus_premium, creator_pack)
 * @param currency - The billing currency
 * @returns Stripe Price ID
 * @throws Error if product type or currency is invalid
 * 
 * Requirements: 3.1, 3.2
 */
export function getStripePriceId(
  productType: ProductType,
  currency: BillingCurrency
): string {
  return getPriceIdForCurrency(productType, currency);
}

/**
 * Check if user can change billing currency
 * 
 * Users with active subscriptions cannot change billing currency
 * without canceling and resubscribing.
 * 
 * @param userId - User ID to check
 * @returns Promise resolving to result with allowed flag and optional reason
 * 
 * Requirements: 4.1, 4.4
 */
export async function canChangeBillingCurrency(
  userId: string
): Promise<CanChangeBillingCurrencyResult> {
  const hasActiveSubscription = await checkActiveSubscription(userId);

  if (hasActiveSubscription) {
    return {
      allowed: false,
      reason: 
        'You must cancel your current subscription before changing billing currency. ' +
        'Your subscription will remain active until the end of the current billing period.',
    };
  }

  return { allowed: true };
}

/**
 * Get billing currency from active subscription
 *
 * Uses profile.stripe_subscription_id and Stripe API to get the subscription's
 * currency (from the first subscription item's price). Falls back to
 * subscription.metadata.billingCurrency if set by checkout.
 *
 * @param userId - User ID to check
 * @returns Promise resolving to billing currency or null if no active subscription
 *
 * Requirements: 3.5
 */
export async function getSubscriptionBillingCurrency(
  userId: string
): Promise<BillingCurrency | null> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockSubscriptionCurrencies) {
    return (global as any).__mockSubscriptionCurrencies.get(userId) || null;
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server');
    const supabase = createServerSupabaseClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.stripe_subscription_id) {
      return null;
    }

    const { getStripe } = await import('@/lib/stripe-config');
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
      expand: ['items.data.price'],
    });

    if (subscription.status !== 'active') {
      return null;
    }

    // Prefer metadata set at checkout (billingCurrency)
    const metaCurrency = subscription.metadata?.billingCurrency?.toUpperCase();
    if (metaCurrency && isValidBillingCurrency(metaCurrency)) {
      return metaCurrency as BillingCurrency;
    }

    // Otherwise use currency from the first subscription item's price
    const firstItem = subscription.items?.data?.[0]?.price;
    const priceCurrency = firstItem?.currency?.toUpperCase();
    if (priceCurrency && isValidBillingCurrency(priceCurrency)) {
      return priceCurrency as BillingCurrency;
    }

    return null;
  } catch (error) {
    console.error('Failed to get subscription billing currency:', error);
    return null;
  }
}

/**
 * Get renewal currency for display in billing UI
 * 
 * This function explicitly returns the currency that will be used for subscription renewals.
 * For users with active subscriptions, this is the subscription's immutable currency.
 * For users without subscriptions, this is their current billing preference.
 * 
 * IMPORTANT: This is specifically for UI display to show users what currency their
 * next renewal will be charged in. The renewal currency is ALWAYS the subscription
 * currency and never changes, even if the user updates their account preference.
 * 
 * @param userId - User ID to check
 * @returns Promise resolving to renewal currency information
 * 
 * Requirements: 3.4, 3.5
 */
export async function getRenewalCurrency(userId: string): Promise<{
  currency: BillingCurrency;
  isSubscriptionCurrency: boolean;
  message: string;
}> {
  // Check for active subscription currency first
  const subscriptionCurrency = await getSubscriptionBillingCurrency(userId);
  
  if (subscriptionCurrency) {
    return {
      currency: subscriptionCurrency,
      isSubscriptionCurrency: true,
      message: `Your subscription will renew in ${subscriptionCurrency}. This currency cannot be changed while your subscription is active.`,
    };
  }
  
  // No active subscription - use current preference
  const currentPreference = await getBillingCurrency(userId);
  
  return {
    currency: currentPreference,
    isSubscriptionCurrency: false,
    message: `Your next subscription will be charged in ${currentPreference}. You can change this before subscribing.`,
  };
}

/**
 * Validate if a currency code is a supported billing currency
 * 
 * @param currency - Currency code to validate
 * @returns true if currency is supported, false otherwise
 * 
 * Requirements: 15.4, 15.5
 */
function isValidBillingCurrency(currency: string): currency is BillingCurrency {
  return SUPPORTED_BILLING_CURRENCIES.includes(currency as BillingCurrency);
}

/**
 * Get billing currency from account settings (database)
 * 
 * @param userId - User ID
 * @returns Promise resolving to billing currency or null
 */
async function getAccountBillingCurrency(userId: string): Promise<BillingCurrency | null> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockAccountCurrencies) {
    return (global as any).__mockAccountCurrencies.get(userId) || null;
  }
  
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server');
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('profiles')
      .select('billing_currency')
      .eq('id', userId)
      .single();
    
    if (error || !data || !data.billing_currency) {
      return null;
    }
    
    return data.billing_currency as BillingCurrency;
  } catch (error) {
    console.error('Failed to get account billing currency:', error);
    return null;
  }
}

/**
 * Set billing currency in account settings (database)
 * 
 * @param userId - User ID
 * @param currency - Billing currency to set
 */
async function setAccountBillingCurrency(
  userId: string,
  currency: BillingCurrency
): Promise<void> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockAccountCurrencies) {
    (global as any).__mockAccountCurrencies.set(userId, currency);
    return;
  }
  
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server');
    const supabase = createServerSupabaseClient();
    
    const { error } = await supabase
      .from('profiles')
      .update({
        billing_currency: currency,
        billing_currency_updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      throw new Error(`Failed to update billing currency: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Failed to set account billing currency:', error);
    throw new Error(`Failed to update billing currency: ${error.message}`);
  }
}

/** Plan values that represent recurring paid subscriptions (billing currency is locked). */
const SUBSCRIPTION_PLANS = ['grid_plus', 'grid_plus_premium'] as const;

/**
 * Check if user has an active subscription
 *
 * Uses profile.plan and profile.subscription_status (set by Stripe webhooks).
 * Grid+ and Grid+ Premium with status 'active' cannot change billing currency.
 *
 * @param userId - User ID to check
 * @returns Promise resolving to true if user has active subscription
 */
async function checkActiveSubscription(userId: string): Promise<boolean> {
  // Check if we're in test mode with mock data
  if (process.env.NODE_ENV === 'test' && (global as any).__mockActiveSubscriptions) {
    return (global as any).__mockActiveSubscriptions.has(userId);
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase-server');
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('plan, subscription_status')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    const plan = data.plan as string | null;
    const status = data.subscription_status as string | null;

    return (
      !!plan &&
      SUBSCRIPTION_PLANS.includes(plan as (typeof SUBSCRIPTION_PLANS)[number]) &&
      status === 'active'
    );
  } catch (error) {
    console.error('Failed to check active subscription:', error);
    return false;
  }
}

// Test hooks for property-based testing
// These allow tests to inject mock data without modifying the core logic
if (process.env.NODE_ENV === 'test') {
  // Initialize global mock stores
  if (!(global as any).__mockAccountCurrencies) {
    (global as any).__mockAccountCurrencies = new Map<string, BillingCurrency>();
  }
  if (!(global as any).__mockSubscriptionCurrencies) {
    (global as any).__mockSubscriptionCurrencies = new Map<string, BillingCurrency>();
  }
  if (!(global as any).__mockActiveSubscriptions) {
    (global as any).__mockActiveSubscriptions = new Set<string>();
  }
  
  // Export test helpers
  (module.exports as any).__test__ = {
    setMockAccountCurrency: (userId: string, currency: BillingCurrency) => {
      (global as any).__mockAccountCurrencies.set(userId, currency);
    },
    setMockSubscriptionCurrency: (userId: string, currency: BillingCurrency) => {
      (global as any).__mockSubscriptionCurrencies.set(userId, currency);
    },
    setMockActiveSubscription: (userId: string, isActive: boolean) => {
      if (isActive) {
        (global as any).__mockActiveSubscriptions.add(userId);
      } else {
        (global as any).__mockActiveSubscriptions.delete(userId);
      }
    },
    clearMockData: () => {
      (global as any).__mockAccountCurrencies.clear();
      (global as any).__mockSubscriptionCurrencies.clear();
      (global as any).__mockActiveSubscriptions.clear();
    },
  };
}
