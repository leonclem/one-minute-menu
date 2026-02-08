'use client'

/**
 * Billing Currency Change Validator Component
 * 
 * Feature: currency-support
 * Task: 16.1
 * 
 * This component validates billing currency changes and displays appropriate
 * messages based on subscription status.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useState, useEffect } from 'react'
import { canChangeBillingCurrency, setBillingCurrency, getBillingCurrency } from '@/lib/billing-currency-service'
import { getSupportedBillingCurrencies, getCurrencyMetadata } from '@/lib/currency-config'
import type { BillingCurrency } from '@/lib/currency-config'

interface BillingCurrencyChangeValidatorProps {
  userId: string
  onCurrencyChanged?: (currency: BillingCurrency) => void
  className?: string
}

export default function BillingCurrencyChangeValidator({
  userId,
  onCurrencyChanged,
  className = ''
}: BillingCurrencyChangeValidatorProps) {
  const [currentCurrency, setCurrentCurrency] = useState<BillingCurrency>('USD')
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>('USD')
  const [canChange, setCanChange] = useState(true)
  const [restrictionReason, setRestrictionReason] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function checkChangePermission() {
      try {
        setLoading(true)
        
        // Get current billing currency
        const currency = await getBillingCurrency(userId)
        setCurrentCurrency(currency)
        setSelectedCurrency(currency)
        
        // Check if user can change billing currency
        const result = await canChangeBillingCurrency(userId)
        setCanChange(result.allowed)
        setRestrictionReason(result.reason || '')
      } catch (err) {
        console.error('Failed to check billing currency change permission:', err)
        setError('Failed to load billing currency settings')
      } finally {
        setLoading(false)
      }
    }

    checkChangePermission()
  }, [userId])

  const handleCurrencySelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = event.target.value as BillingCurrency
    setSelectedCurrency(newCurrency)
    setSuccess(false)
    setError('')
  }

  const handleSaveChange = async () => {
    if (!canChange) {
      setError('Cannot change billing currency while subscription is active')
      return
    }

    if (selectedCurrency === currentCurrency) {
      setError('Please select a different currency')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess(false)

      await setBillingCurrency(selectedCurrency, userId)
      
      setCurrentCurrency(selectedCurrency)
      setSuccess(true)
      onCurrencyChanged?.(selectedCurrency)
    } catch (err) {
      console.error('Failed to change billing currency:', err)
      setError(err instanceof Error ? err.message : 'Failed to change billing currency')
    } finally {
      setSaving(false)
    }
  }

  const supportedCurrencies = getSupportedBillingCurrencies()

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded-lg w-64"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Currency Display */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current Billing Currency
        </label>
        <div className="text-lg font-semibold text-gray-900">
          {getCurrencyMetadata(currentCurrency).symbol} {currentCurrency} - {getCurrencyMetadata(currentCurrency).name}
        </div>
      </div>

      {/* Currency Selector */}
      <div>
        <label htmlFor="billing-currency-select" className="block text-sm font-medium text-gray-700 mb-2">
          {canChange ? 'Change Billing Currency' : 'Billing Currency (Locked)'}
        </label>
        <select
          id="billing-currency-select"
          value={selectedCurrency}
          onChange={handleCurrencySelect}
          disabled={!canChange || saving}
          className={`w-full px-4 py-2 border rounded-lg transition-colors ${
            canChange && !saving
              ? 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer'
              : 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
          }`}
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

      {/* Restriction Message (Active Subscription) */}
      {!canChange && restrictionReason && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Cannot Change Billing Currency
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                {restrictionReason}
              </p>
              <div className="text-sm text-yellow-700 space-y-2">
                <p className="font-medium">To change your billing currency:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Cancel your current subscription</li>
                  <li>Your subscription will remain active until the end of the current billing period</li>
                  <li>After cancellation, you can change your billing currency</li>
                  <li>Subscribe again with your new preferred currency</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button (Only shown when change is allowed) */}
      {canChange && (
        <div>
          <button
            onClick={handleSaveChange}
            disabled={saving || selectedCurrency === currentCurrency}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              saving || selectedCurrency === currentCurrency
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {saving ? 'Saving...' : 'Save Currency Change'}
          </button>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-green-800">
                Billing Currency Updated
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Your billing currency has been changed to {selectedCurrency}. This will be used for your next subscription.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Error
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Information Box (No Active Subscription) */}
      {canChange && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800 mb-1">
                About Billing Currency
              </h3>
              <p className="text-sm text-blue-700">
                Your billing currency determines how you pay GridMenu subscription fees. 
                You can change this freely when you don't have an active subscription. 
                Once you subscribe, the currency is locked for the duration of your subscription.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
