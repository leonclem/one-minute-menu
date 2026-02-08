/**
 * Renewal Currency Display Component
 * 
 * Displays the currency that will be used for subscription renewals.
 * This component explicitly shows users what currency their next renewal
 * will be charged in, emphasizing that subscription currency is immutable.
 * 
 * Requirements: 3.4, 3.5 (Task 15.1)
 */

'use client'

import { useEffect, useState } from 'react'
import { getRenewalCurrency } from '@/lib/billing-currency-service'
import type { BillingCurrency } from '@/lib/currency-config'
import { getCurrencyMetadata } from '@/lib/currency-config'

interface RenewalCurrencyInfo {
  currency: BillingCurrency
  isSubscriptionCurrency: boolean
  message: string
}

interface RenewalCurrencyDisplayProps {
  userId: string
  className?: string
}

export default function RenewalCurrencyDisplay({ 
  userId, 
  className = '' 
}: RenewalCurrencyDisplayProps) {
  const [renewalInfo, setRenewalInfo] = useState<RenewalCurrencyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRenewalCurrency() {
      try {
        setLoading(true)
        setError(null)
        const info = await getRenewalCurrency(userId)
        setRenewalInfo(info)
      } catch (err) {
        console.error('Failed to load renewal currency:', err)
        setError('Failed to load renewal currency information')
      } finally {
        setLoading(false)
      }
    }

    loadRenewalCurrency()
  }, [userId])

  if (loading) {
    return (
      <div className={`renewal-currency-display ${className}`}>
        <p className="text-sm text-gray-500">Loading renewal information...</p>
      </div>
    )
  }

  if (error || !renewalInfo) {
    return (
      <div className={`renewal-currency-display ${className}`}>
        <p className="text-sm text-red-600">{error || 'Unable to load renewal information'}</p>
      </div>
    )
  }

  const currencyMetadata = getCurrencyMetadata(renewalInfo.currency)

  return (
    <div className={`renewal-currency-display ${className}`}>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg 
              className="w-5 h-5 text-blue-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Renewal Currency
            </h3>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold text-blue-700">
                {currencyMetadata.symbol} {renewalInfo.currency}
              </span>
              <span className="text-sm text-blue-600">
                {currencyMetadata.name}
              </span>
            </div>
            <p className="text-sm text-blue-800">
              {renewalInfo.message}
            </p>
            {renewalInfo.isSubscriptionCurrency && (
              <p className="text-xs text-blue-600 mt-2 italic">
                Note: To change your billing currency, you must cancel your current 
                subscription and create a new one with your preferred currency.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
