/**
 * Client-safe billing currency localStorage.
 * Used by BillingCurrencySelector so it never imports server-only modules (supabase-server).
 * Keep this file free of server-only imports (no next/headers, supabase-server, etc.).
 */

import type { BillingCurrency } from './currency-config'
import { SUPPORTED_BILLING_CURRENCIES } from './currency-config'

const BILLING_CURRENCY_STORAGE_KEY = 'gridmenu_billing_currency'

function isValid(currency: string): currency is BillingCurrency {
  return (SUPPORTED_BILLING_CURRENCIES as readonly string[]).includes(currency)
}

/**
 * Get billing currency from localStorage (client-only; returns null on server).
 */
export function getLocalStorageBillingCurrency(): BillingCurrency | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(BILLING_CURRENCY_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    const currency = parsed.billingCurrency
    if (isValid(currency)) return currency
    localStorage.removeItem(BILLING_CURRENCY_STORAGE_KEY)
    return null
  } catch {
    return null
  }
}

/**
 * Set billing currency in localStorage (client-only; no-op on server).
 */
export function setLocalStorageBillingCurrency(currency: BillingCurrency): void {
  if (typeof window === 'undefined') return
  try {
    const data = {
      billingCurrency: currency,
      billingCurrencySource: 'manual',
      lastUpdated: new Date().toISOString(),
    }
    localStorage.setItem(BILLING_CURRENCY_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}
