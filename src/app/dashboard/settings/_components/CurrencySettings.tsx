'use client'

import { useState, useEffect } from 'react'
import { UXCard } from '@/components/ux'
import { ConfirmDialog } from '@/components/ui'
import type { BillingCurrency, ISO4217CurrencyCode } from '@/lib/currency-config'
import { SUPPORTED_BILLING_CURRENCIES, getCurrencyMetadata, getPopularMenuCurrencies, getAllCurrencies } from '@/lib/currency-config'

interface CurrencySettingsProps {
  userId: string
}

export function CurrencySettings({ userId }: CurrencySettingsProps) {
  // Billing currency state
  const [billingCurrency, setBillingCurrency] = useState<BillingCurrency>('USD')
  const [canChangeBilling, setCanChangeBilling] = useState(true)
  const [billingChangeReason, setBillingChangeReason] = useState<string>()
  
  // Menu currency state
  const [menuCurrency, setMenuCurrency] = useState<ISO4217CurrencyCode>('USD')
  const [pendingCurrency, setPendingCurrency] = useState<ISO4217CurrencyCode | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [menuSearchQuery, setMenuSearchQuery] = useState('')
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Collapsible state
  const [menuExpanded, setMenuExpanded] = useState(false)
  const [billingExpanded, setBillingExpanded] = useState(false)

  // Load current settings
  useEffect(() => {
    loadSettings()
  }, [userId])

  async function loadSettings() {
    try {
      setLoading(true)
      
      // Fetch current billing currency
      const billingRes = await fetch('/api/currency/billing')
      if (billingRes.ok) {
        const billingData = await billingRes.json()
        setBillingCurrency(billingData.currency)
      }
      
      // Check if billing currency can be changed
      const canChangeRes = await fetch('/api/currency/billing/can-change')
      if (canChangeRes.ok) {
        const canChangeData = await canChangeRes.json()
        setCanChangeBilling(canChangeData.allowed)
        setBillingChangeReason(canChangeData.reason)
      }
      
      // Fetch current menu currency
      const menuRes = await fetch('/api/currency/menu')
      if (menuRes.ok) {
        const menuData = await menuRes.json()
        setMenuCurrency(menuData.currency)
      }
    } catch (error) {
      console.error('Failed to load currency settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings. Please refresh the page.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleBillingCurrencyChange(newCurrency: BillingCurrency) {
    if (!canChangeBilling) {
      setMessage({ type: 'error', text: billingChangeReason || 'Cannot change billing currency at this time.' })
      return
    }

    try {
      setSaving(true)
      setMessage(null)
      
      const res = await fetch('/api/currency/billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency })
      })
      
      if (res.ok) {
        setBillingCurrency(newCurrency)
        setMessage({ type: 'success', text: 'Billing currency updated successfully!' })
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.message || 'Failed to update billing currency.' })
      }
    } catch (error) {
      console.error('Failed to update billing currency:', error)
      setMessage({ type: 'error', text: 'Failed to update billing currency. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleMenuCurrencyChange(newCurrency: ISO4217CurrencyCode) {
    // First, check if confirmation is required
    try {
      const checkRes = await fetch('/api/currency/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency, confirmed: false })
      })
      
      const checkData = await checkRes.json()
      
      if (checkData.requiresConfirmation) {
        // Show modal for confirmation
        setPendingCurrency(newCurrency)
        setShowConfirmModal(true)
      } else if (checkData.success) {
        // No confirmation needed, update immediately
        setMenuCurrency(newCurrency)
        setMessage({ type: 'success', text: 'Menu currency updated successfully!' })
      } else {
        setMessage({ type: 'error', text: checkData.message || 'Failed to update menu currency.' })
      }
    } catch (error) {
      console.error('Failed to check menu currency:', error)
      setMessage({ type: 'error', text: 'Failed to update menu currency. Please try again.' })
    }
  }

  async function confirmMenuCurrencyChange() {
    if (!pendingCurrency) return
    
    try {
      setSaving(true)
      setMessage(null)
      
      const res = await fetch('/api/currency/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: pendingCurrency, confirmed: true })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setMenuCurrency(pendingCurrency)
        setShowConfirmModal(false)
        setPendingCurrency(null)
        setMessage({ type: 'success', text: 'Menu currency updated successfully!' })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update menu currency.' })
      }
    } catch (error) {
      console.error('Failed to update menu currency:', error)
      setMessage({ type: 'error', text: 'Failed to update menu currency. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  function cancelMenuCurrencyChange() {
    setShowConfirmModal(false)
    setPendingCurrency(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-ux-text-secondary">Loading settings...</div>
      </div>
    )
  }

  const popularCurrencies = getPopularMenuCurrencies()
  const allCurrencies = getAllCurrencies()
  const filteredCurrencies = menuSearchQuery
    ? allCurrencies.filter(c => 
        c.code.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(menuSearchQuery.toLowerCase())
      )
    : allCurrencies

  return (
    <>
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Menu Currency Card */}
      <UXCard>
        <div className="p-6">
          {/* Collapsible Header */}
          <button
            onClick={() => setMenuExpanded(!menuExpanded)}
            className="w-full flex items-center justify-between text-left group"
          >
            <div>
              <h2 className="text-xl font-semibold text-ux-text group-hover:text-ux-primary transition-colors">
                Menu Currency
              </h2>
              <p className="text-sm text-ux-text-secondary mt-1">
                What your customers see on your menus
              </p>
            </div>
            <svg
              className={`h-6 w-6 text-ux-text-secondary transition-transform duration-200 ${
                menuExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Collapsible Content */}
          {menuExpanded && (
            <div className="mt-6 space-y-4">

        {/* Current Selection */}
        <div className="p-4 bg-ux-background-secondary rounded-md border border-ux-border">
          <div className="text-sm text-ux-text-secondary mb-1">Current menu currency</div>
          <div className="font-medium text-ux-text">
            {getCurrencyMetadata(menuCurrency).symbol} {menuCurrency} - {getCurrencyMetadata(menuCurrency).name}
          </div>
        </div>

        {/* Popular Currencies */}
        <div>
          <div className="text-sm font-medium text-ux-text mb-2">Popular currencies</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {popularCurrencies.map((currency) => {
              const metadata = getCurrencyMetadata(currency)
              const isSelected = menuCurrency === currency
              
              return (
                <button
                  key={currency}
                  onClick={() => handleMenuCurrencyChange(currency)}
                  disabled={saving}
                  className={`p-3 rounded-md border text-center transition-all ${
                    isSelected
                      ? 'border-ux-primary bg-ux-primary/5 font-medium'
                      : 'border-ux-border hover:border-ux-primary/50'
                  }`}
                >
                  <div className="text-sm">{metadata.symbol} {currency}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search All Currencies */}
        <div>
          <div className="text-sm font-medium text-ux-text mb-2">All currencies</div>
          <input
            type="text"
            placeholder="Search currencies..."
            value={menuSearchQuery}
            onChange={(e) => setMenuSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-ux-border rounded-md focus:outline-none focus:ring-2 focus:ring-ux-primary"
          />
          <div className="mt-2 h-64 overflow-y-auto border border-ux-border rounded-md">
            {filteredCurrencies.map((currency) => {
              const isSelected = menuCurrency === currency.code
              
              return (
                <button
                  key={currency.code}
                  onClick={() => handleMenuCurrencyChange(currency.code)}
                  disabled={saving}
                  className={`w-full p-3 text-left border-b border-ux-border last:border-b-0 transition-all ${
                    isSelected
                      ? 'bg-ux-primary/5'
                      : 'hover:bg-ux-background-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-ux-text">
                        {currency.symbol} {currency.code}
                      </div>
                      <div className="text-sm text-ux-text-secondary">
                        {currency.name}
                      </div>
                    </div>
                    {isSelected && (
                      <svg className="h-5 w-5 text-ux-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
            </div>
          )}
        </div>
      </UXCard>

      {/* Billing Currency Card - show selector if allowed, or explanation if locked by subscription */}
      {canChangeBilling ? (
        <UXCard>
          <div className="p-6">
            {/* Collapsible Header */}
            <button
              onClick={() => setBillingExpanded(!billingExpanded)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div>
                <h2 className="text-xl font-semibold text-ux-text group-hover:text-ux-primary transition-colors">
                  Billing Currency
                </h2>
                <p className="text-sm text-ux-text-secondary mt-1">
                  How you pay GridMenu for your subscription
                </p>
              </div>
              <svg
                className={`h-6 w-6 text-ux-text-secondary transition-transform duration-200 ${
                  billingExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Collapsible Content */}
            {billingExpanded && (
              <div className="mt-6 space-y-3">
              {SUPPORTED_BILLING_CURRENCIES.map((currency) => {
                const metadata = getCurrencyMetadata(currency)
                const isSelected = billingCurrency === currency
                
                return (
                  <button
                    key={currency}
                    onClick={() => handleBillingCurrencyChange(currency)}
                    disabled={saving}
                    className={`w-full p-4 rounded-md border-2 text-left transition-all ${
                      isSelected
                        ? 'border-ux-primary bg-ux-primary/5'
                        : 'border-ux-border hover:border-ux-primary/50'
                    } cursor-pointer`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-ux-text">
                          {metadata.symbol} {currency}
                        </div>
                        <div className="text-sm text-ux-text-secondary">
                          {metadata.name}
                        </div>
                      </div>
                      {isSelected && (
                        <svg className="h-5 w-5 text-ux-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
              </div>
            )}
          </div>
        </UXCard>
      ) : (
        <UXCard>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-ux-text">Billing Currency</h2>
            <p className="text-sm text-ux-text-secondary mt-1">
              How you pay GridMenu for your subscription
            </p>
            <div className="mt-4 p-4 bg-ux-background-secondary rounded-md border border-ux-border">
              <p className="text-ux-text">
                {billingChangeReason ?? 'You must cancel your current subscription before changing billing currency. Your subscription will remain active until the end of the current billing period.'}
              </p>
              <p className="text-sm text-ux-text-secondary mt-2">
                Current billing currency: <strong>{getCurrencyMetadata(billingCurrency).symbol} {billingCurrency}</strong>
              </p>
            </div>
          </div>
        </UXCard>
      )}

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={showConfirmModal}
        title="Confirm Currency Change"
        description="Changing your menu currency will not automatically convert existing prices. Your menu prices will keep their current numeric values, but will display with the new currency symbol. You'll need to manually update prices if needed."
        confirmText="Change Currency"
        cancelText="Cancel"
        onConfirm={confirmMenuCurrencyChange}
        onCancel={cancelMenuCurrencyChange}
        variant="primary"
      />
    </>
  )
}
