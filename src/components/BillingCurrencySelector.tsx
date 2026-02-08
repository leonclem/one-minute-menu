'use client'

import { useState, useEffect } from 'react'
import { getSupportedBillingCurrencies, getCurrencyMetadata } from '@/lib/currency-config'
import { detectLocation, suggestCurrencies } from '@/lib/geo-detection'
import { getLocalStorageBillingCurrency, setLocalStorageBillingCurrency } from '@/lib/billing-currency-storage'
import type { BillingCurrency } from '@/lib/currency-config'

/** Optional service for init/persist; when provided (e.g. in tests), used so mocks can be asserted. */
export type GetBillingCurrencyFn = (userId?: string) => Promise<BillingCurrency>
export type SetBillingCurrencyFn = (currency: BillingCurrency, userId?: string) => Promise<void>

interface BillingCurrencySelectorProps {
  userId?: string
  onCurrencyChange?: (currency: BillingCurrency) => void
  className?: string
  /** When provided (e.g. test env), used for initial load so integration tests can mock it. */
  getBillingCurrency?: GetBillingCurrencyFn
  /** When provided (e.g. test env), used on change so integration tests can assert persistence. */
  setBillingCurrency?: SetBillingCurrencyFn
}

export default function BillingCurrencySelector({
  userId,
  onCurrencyChange,
  className = '',
  getBillingCurrency: injectGetBillingCurrency,
  setBillingCurrency: injectSetBillingCurrency,
}: BillingCurrencySelectorProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>('USD')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function initializeCurrency() {
      const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      const geoDebug = searchParams?.get('geo_debug') === '1'
      const countryOverride = searchParams?.get('country')?.toUpperCase()
      const hasCountryOverride = !!countryOverride && countryOverride.length === 2
      const geoQuery = typeof window !== 'undefined' ? window.location.search : ''

      if (geoDebug) {
        console.log('[BillingCurrencySelector] geo_debug=1 | URL params:', { countryOverride: countryOverride || null, hasCountryOverride })
        console.log('[BillingCurrencySelector] Test other countries: ?country=SG | ?country=US | ?country=GB | ?country=AU | ?country=DE (dev only)')
      }

      // When injectGetBillingCurrency is provided (e.g. tests), use it for initial currency so mocks can be asserted
      if (injectGetBillingCurrency) {
        try {
          const currency = await injectGetBillingCurrency(userId)
          setSelectedCurrency(currency)
          onCurrencyChange?.(currency)
          setLoading(false)
          return
        } catch {
          // fall through to fetch/localStorage/geo
        }
      }

      // Call /api/geo when: debugging, dev override, or when we may need it for default currency
      // (IP-based geo only works when this API is called; Vercel sets x-vercel-ip-country in production)
      let geoCurrency: BillingCurrency | null = null
      const shouldFetchGeo = geoDebug || hasCountryOverride
      if (shouldFetchGeo) {
        try {
          const geoRes = await fetch(`/api/geo${geoQuery}`)
          const geoJson = await geoRes.json().catch(() => ({}))
          const data = geoJson?.data
          if (geoDebug) {
            console.log('[BillingCurrencySelector] /api/geo response:', { status: geoRes.status, data })
          }
          if (data?.detected && data?.billingCurrency) {
            geoCurrency = data.billingCurrency
          }
        } catch (e) {
          if (geoDebug) console.warn('[BillingCurrencySelector] /api/geo failed:', e)
        }
      }

      try {
        // Dev override: ?country=SG (or US, GB, AU, etc.) forces that currency for testing
        if (hasCountryOverride && geoCurrency) {
          setSelectedCurrency(geoCurrency)
          onCurrencyChange?.(geoCurrency)
          if (userId === undefined) setLocalStorageBillingCurrency(geoCurrency)
          if (geoDebug) console.log('[BillingCurrencySelector] Using dev override:', { country: countryOverride, currency: geoCurrency })
          setLoading(false)
          return
        }

        if (userId !== undefined) {
          const response = await fetch('/api/billing-currency')
          if (response.ok) {
            const result = await response.json()
            const currency = result.data.currency
            setSelectedCurrency(currency)
            onCurrencyChange?.(currency)
            if (geoDebug) console.log('[BillingCurrencySelector] Using billing-currency API (logged in):', currency)
            setLoading(false)
            return
          }
        }

        // Use geo result when we have it (from debug or country override fetch) so it isn't overridden by localStorage
        if (geoCurrency) {
          setSelectedCurrency(geoCurrency)
          onCurrencyChange?.(geoCurrency)
          if (userId === undefined) setLocalStorageBillingCurrency(geoCurrency)
          if (geoDebug) console.log('[BillingCurrencySelector] Using geo result:', geoCurrency)
          setLoading(false)
          return
        }

        const stored = getLocalStorageBillingCurrency()
        if (stored && !hasCountryOverride) {
          setSelectedCurrency(stored)
          onCurrencyChange?.(stored)
          if (geoDebug) console.log('[BillingCurrencySelector] Using localStorage:', stored)
          setLoading(false)
          return
        }

        // Use geo result if we have it; otherwise try /api/geo once (IP-based in production), then client fallback
        let currency: BillingCurrency
        if (geoCurrency) {
          currency = geoCurrency
        } else {
          // In production, IP-based geo only works if we call /api/geo (Vercel sets x-vercel-ip-country)
          try {
            const geoRes = await fetch('/api/geo')
            const geoJson = await geoRes.json().catch(() => ({}))
            const data = geoJson?.data
            if (geoDebug && data) {
              console.log('[BillingCurrencySelector] /api/geo (default path):', { status: geoRes.status, data })
            }
            if (data?.detected && data?.billingCurrency) {
              currency = data.billingCurrency
            } else {
              const location = await detectLocation()
              const suggestion = suggestCurrencies(location)
              if (geoDebug) {
                console.log('[BillingCurrencySelector] Client fallback:', {
                  location: { country: location.country, countryCode: location.countryCode, detected: location.detected },
                  suggestion: { billingCurrency: suggestion.billingCurrency, confidence: suggestion.confidence },
                  navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : undefined,
                })
                if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
                  console.log('[BillingCurrencySelector] On localhost, IP geo is never set. Use ?country=SG to test SGD, or set browser language to English (Singapore).')
                }
              }
              currency = suggestion.billingCurrency
            }
          } catch {
            const location = await detectLocation()
            const suggestion = suggestCurrencies(location)
            currency = suggestion.billingCurrency
          }
        }

        setSelectedCurrency(currency)
        setLocalStorageBillingCurrency(currency)
        onCurrencyChange?.(currency)
      } catch {
        const stored = getLocalStorageBillingCurrency()
        if (stored) {
          setSelectedCurrency(stored)
          onCurrencyChange?.(stored)
        } else {
          setSelectedCurrency('USD')
          onCurrencyChange?.('USD')
        }
      } finally {
        setLoading(false)
      }
    }

    initializeCurrency()
  }, [userId, injectGetBillingCurrency])

  const handleCurrencyChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = event.target.value as BillingCurrency
    setSelectedCurrency(newCurrency)
    onCurrencyChange?.(newCurrency)

    if (injectSetBillingCurrency) {
      try {
        await injectSetBillingCurrency(newCurrency, userId)
      } catch (error) {
        console.error('Failed to save billing currency:', error)
      }
      return
    }

    if (userId === undefined) {
      setLocalStorageBillingCurrency(newCurrency)
      return
    }
    try {
      const response = await fetch('/api/billing-currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency })
      })
      if (!response.ok) {
        console.error('Failed to save billing currency:', response.status)
      }
    } catch (error) {
      console.error('Failed to save billing currency:', error)
    }
  }

  const supportedCurrencies = getSupportedBillingCurrencies()

  if (loading) {
    return (
      <div className={`inline-block ${className}`}>
        <select 
          disabled 
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-400 cursor-not-allowed"
        >
          <option>Loading...</option>
        </select>
      </div>
    )
  }

  return (
    <div className={`inline-block ${className}`}>
      <select
        value={selectedCurrency}
        onChange={handleCurrencyChange}
        className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-ux-primary focus:border-transparent transition-colors cursor-pointer"
        aria-label="Select billing currency"
      >
        {supportedCurrencies.map((currency) => {
          const metadata = getCurrencyMetadata(currency)
          return (
            <option key={currency} value={currency}>
              {metadata.symbol} {currency} - {metadata.name}
            </option>
          )
        })}
      </select>
    </div>
  )
}
