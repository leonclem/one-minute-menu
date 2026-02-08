'use client'

import { useState, useMemo } from 'react'
import { UXButton, UXCard } from '@/components/ux'
import { getPopularMenuCurrencies, getCurrencyMetadata, getAllCurrencies } from '@/lib/currency-config'
import type { ISO4217CurrencyCode } from '@/lib/currency-config'

interface MenuCurrencyOnboardingProps {
  suggestedCurrency?: ISO4217CurrencyCode
  onComplete: (currency: ISO4217CurrencyCode) => void
  onSkip?: () => void
}

export default function MenuCurrencyOnboarding({
  suggestedCurrency = 'USD',
  onComplete,
  onSkip,
}: MenuCurrencyOnboardingProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<ISO4217CurrencyCode>(suggestedCurrency)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllCurrencies, setShowAllCurrencies] = useState(false)

  const popularCurrencies = getPopularMenuCurrencies()
  const allCurrencies = useMemo(() => getAllCurrencies(), [])

  // Filter currencies based on search query
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery) return allCurrencies
    
    const query = searchQuery.toLowerCase()
    return allCurrencies.filter(
      (currency) =>
        currency.code.toLowerCase().includes(query) ||
        currency.name.toLowerCase().includes(query)
    )
  }, [searchQuery, allCurrencies])

  const handleConfirm = () => {
    if (selectedCurrency) {
      onComplete(selectedCurrency)
    }
  }

  const renderCurrencyOption = (currencyCode: ISO4217CurrencyCode, isSuggested: boolean = false) => {
    const metadata = getCurrencyMetadata(currencyCode)
    const isSelected = selectedCurrency === currencyCode

    return (
      <button
        key={currencyCode}
        type="button"
        onClick={() => setSelectedCurrency(currencyCode)}
        className={`
          w-full text-left px-4 py-3 rounded-lg border-2 transition-all
          ${isSelected 
            ? 'border-ux-primary bg-ux-primary/10' 
            : 'border-ux-border hover:border-ux-primary/50 bg-white'
          }
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{metadata.symbol}</span>
            <div>
              <div className="font-medium text-ux-text flex items-center gap-2">
                {metadata.code}
                {isSuggested && (
                  <span className="text-xs px-2 py-0.5 bg-ux-primary/20 text-ux-primary rounded-full">
                    Suggested
                  </span>
                )}
              </div>
              <div className="text-sm text-ux-text-secondary">{metadata.name}</div>
            </div>
          </div>
          {isSelected && (
            <svg className="w-5 h-5 text-ux-primary" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </button>
    )
  }

  return (
    <UXCard>
      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-ux-text mb-2">
            Choose your menu currency
          </h2>
          <p className="text-sm text-ux-text-secondary">
            This is what your customers see on your menus. You can change this later in settings.
          </p>
        </div>

        {/* Popular currencies section */}
        {!showAllCurrencies && (
          <div className="space-y-3 mb-4">
            <h3 className="text-sm font-medium text-ux-text-secondary">Popular currencies</h3>
            {popularCurrencies.map((code) => 
              renderCurrencyOption(code, code === suggestedCurrency)
            )}
          </div>
        )}

        {/* Show all currencies toggle */}
        {!showAllCurrencies && (
          <button
            type="button"
            onClick={() => setShowAllCurrencies(true)}
            className="w-full text-center py-2 text-sm text-ux-primary hover:text-ux-primary-hover font-medium"
          >
            Show all currencies
          </button>
        )}

        {/* All currencies with search */}
        {showAllCurrencies && (
          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Search currencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-ux w-full"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredCurrencies.length > 0 ? (
                filteredCurrencies.map((currency) =>
                  renderCurrencyOption(currency.code, currency.code === suggestedCurrency)
                )
              ) : (
                <p className="text-center text-ux-text-secondary py-8">
                  No currencies found matching &quot;{searchQuery}&quot;
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAllCurrencies(false)
                setSearchQuery('')
              }}
              className="w-full text-center py-2 text-sm text-ux-primary hover:text-ux-primary-hover font-medium"
            >
              Show popular currencies only
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          {onSkip && (
            <UXButton
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={onSkip}
            >
              Skip for now
            </UXButton>
          )}
          <UXButton
            type="button"
            variant="primary"
            size="lg"
            className={onSkip ? 'flex-1' : 'w-full'}
            onClick={handleConfirm}
            disabled={!selectedCurrency}
          >
            Confirm
          </UXButton>
        </div>
      </div>
    </UXCard>
  )
}
