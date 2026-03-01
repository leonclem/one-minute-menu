'use client'

import { useState } from 'react'
import { UXCard } from '@/components/ux'
import { ConfirmDialog } from '@/components/ui'
import type { ISO4217CurrencyCode } from '@/lib/currency-config'
import { getPopularMenuCurrencies, getAllCurrencies, getCurrencyMetadata } from '@/lib/currency-config'

interface CurrencySettingsProps {
  userId: string
  initialMenuCurrency: ISO4217CurrencyCode
}

export function CurrencySettings({ userId, initialMenuCurrency }: CurrencySettingsProps) {
  // Menu currency state — seeded from server
  const [menuCurrency, setMenuCurrency] = useState<ISO4217CurrencyCode>(initialMenuCurrency)
  const [pendingCurrency, setPendingCurrency] = useState<ISO4217CurrencyCode | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [menuSearchQuery, setMenuSearchQuery] = useState('')
  
  // UI state
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Collapsible state
  const [menuExpanded, setMenuExpanded] = useState(false)

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
