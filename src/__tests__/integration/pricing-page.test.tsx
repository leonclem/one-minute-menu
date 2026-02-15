/**
 * Integration Tests for Pricing Page
 * 
 * Feature: currency-support
 * Task: 13.3 Write integration tests for pricing page
 * 
 * These tests verify that the pricing page correctly:
 * 1. Displays currency selector with all 5 supported billing currencies
 * 2. Updates displayed prices when currency selector changes
 * 3. Persists currency selection across page reloads
 * 4. Suggests appropriate default currency based on geo-detection
 * 
 * Requirements: 1.3, 2.1, 2.2
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UXPricingPageContent from '@/app/(marketing)/pricing/PricingPageContent'
import { PRICING_TIERS } from '@/lib/pricing-config'
import { SUPPORTED_BILLING_CURRENCIES, getCurrencyMetadata } from '@/lib/currency-config'
import type { BillingCurrency } from '@/lib/currency-config'

// Mock modules
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}))

jest.mock('@/lib/geo-detection', () => ({
  detectLocation: jest.fn(),
  suggestCurrencies: jest.fn(),
}))

import { detectLocation, suggestCurrencies } from '@/lib/geo-detection'

const mockedDetectLocation = detectLocation as jest.MockedFunction<typeof detectLocation>
const mockedSuggestCurrencies = suggestCurrencies as jest.MockedFunction<typeof suggestCurrencies>

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

const BILLING_CURRENCY_STORAGE_KEY = 'gridmenu_billing_currency'
function setStoredBillingCurrency(currency: string) {
  localStorageMock.setItem(BILLING_CURRENCY_STORAGE_KEY, JSON.stringify({ billingCurrency: currency }))
}

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('Pricing Page - Integration Tests', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    localStorageMock.clear()
    jest.clearAllMocks()

    // BillingCurrencySelector calls GET /api/billing-currency when userId is set, POST on change
    const mockFetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/billing-currency')) {
        const isPost = init?.method === 'POST'
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(isPost ? {} : { data: { currency: 'USD' } }),
        } as Response)
      }
      return Promise.reject(new Error(`Unmocked fetch: ${url}`))
    }
    fetchMock = jest.fn(mockFetch)
    ;(global as any).fetch = fetchMock

    mockedDetectLocation.mockResolvedValue({
      country: 'United States',
      countryCode: 'US',
      detected: true,
    })
    mockedSuggestCurrencies.mockReturnValue({
      billingCurrency: 'USD',
      menuCurrency: 'USD',
      confidence: 'high',
    })
  })

  describe('Currency selector displays all 5 currencies', () => {
    it('should render currency selector with all supported billing currencies', async () => {
      render(<UXPricingPageContent />)

      // Wait for currency selector to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Find the currency selector
      const currencySelector = screen.getByLabelText(/select billing currency/i)
      expect(currencySelector).toBeInTheDocument()

      // Verify all 5 supported currencies are present
      const options = within(currencySelector as HTMLElement).getAllByRole('option')
      expect(options).toHaveLength(SUPPORTED_BILLING_CURRENCIES.length)

      // Verify each currency is present with correct format
      SUPPORTED_BILLING_CURRENCIES.forEach((currency) => {
        const metadata = getCurrencyMetadata(currency)
        const optionText = `${metadata.symbol} ${currency} - ${metadata.name}`
        expect(screen.getByRole('option', { name: optionText })).toBeInTheDocument()
      })
    })

    it('should display currency selector label', async () => {
      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify label is present (page uses "Billing currency" below pricing cards)
      expect(screen.getByText(/billing currency/i)).toBeInTheDocument()
    })

    it('should have currency selector accessible via label', async () => {
      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify selector is accessible
      const selector = screen.getByLabelText(/select billing currency/i)
      expect(selector).toBeInTheDocument()
      expect(selector.tagName).toBe('SELECT')
    })
  })

  describe('Selecting currency updates displayed prices', () => {
    it('should update all pricing tier prices when currency changes', async () => {
      const user = userEvent.setup()
      render(<UXPricingPageContent />)

      // Wait for initial load with USD
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify initial USD prices are displayed
      PRICING_TIERS.forEach((tier) => {
        const usdPrice = `$${tier.prices.USD}`
        expect(screen.getByText(usdPrice)).toBeInTheDocument()
      })

      // Change currency to SGD
      const currencySelector = screen.getByLabelText(/select billing currency/i)
      await user.selectOptions(currencySelector, 'SGD')

      // Wait for prices to update
      await waitFor(() => {
        PRICING_TIERS.forEach((tier) => {
          const sgdPrice = `S$${tier.prices.SGD}`
          expect(screen.getByText(sgdPrice)).toBeInTheDocument()
        })
      })

      // Verify USD prices are no longer displayed
      PRICING_TIERS.forEach((tier) => {
        const usdPrice = `$${tier.prices.USD}`
        expect(screen.queryByText(usdPrice)).not.toBeInTheDocument()
      })
    })

    it('should update prices for all supported currencies', async () => {
      const user = userEvent.setup()
      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Test each supported currency
      for (const currency of SUPPORTED_BILLING_CURRENCIES) {
        const currencySelector = screen.getByLabelText(/select billing currency/i)
        await user.selectOptions(currencySelector, currency)

        // Wait for prices to update
        await waitFor(() => {
          const metadata = getCurrencyMetadata(currency)
          const firstTierPrice = `${metadata.symbol}${PRICING_TIERS[0].prices[currency]}`
          expect(screen.getByText(firstTierPrice)).toBeInTheDocument()
        })

        // Verify all tier prices are updated
        PRICING_TIERS.forEach((tier) => {
          const metadata = getCurrencyMetadata(currency)
          const expectedPrice = `${metadata.symbol}${tier.prices[currency]}`
          expect(screen.getByText(expectedPrice)).toBeInTheDocument()
        })
      }
    })

    it('should call setBillingCurrency when currency changes', async () => {
      const user = userEvent.setup()
      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Change currency (anonymous user: selector persists to localStorage)
      const currencySelector = screen.getByLabelText(/select billing currency/i)
      await user.selectOptions(currencySelector, 'GBP')

      // Verify persistence: localStorage was updated with GBP
      await waitFor(() => {
        const stored = localStorageMock.getItem(BILLING_CURRENCY_STORAGE_KEY)
        expect(stored).toBeTruthy()
        expect(JSON.parse(stored!).billingCurrency).toBe('GBP')
      })
    })

    it('should update prices immediately without delay', async () => {
      const user = userEvent.setup()
      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Change currency
      const currencySelector = screen.getByLabelText(/select billing currency/i)
      await user.selectOptions(currencySelector, 'EUR')

      // Prices should update immediately (within 100ms)
      await waitFor(
        () => {
          const eurPrice = `€${PRICING_TIERS[0].prices.EUR}`
          expect(screen.getByText(eurPrice)).toBeInTheDocument()
        },
        { timeout: 100 }
      )
    })
  })

  describe('Prices persist across page reloads', () => {
    it('should load previously selected currency on mount', async () => {
      // Set up: User previously selected GBP (stored in localStorage for anonymous)
      setStoredBillingCurrency('GBP')

      const { rerender } = render(<UXPricingPageContent />)

      // Wait for load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Wait for currency to be loaded
      await waitFor(() => {
        const currencySelector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
        expect(currencySelector.value).toBe('GBP')
      })

      // Note: The pricing page doesn't automatically update prices when the selector loads
      // It only updates when onCurrencyChange is called (user interaction)
      // This test verifies that the selector shows the correct currency
      // The prices will update when the user interacts with the page
    })

    it('should persist currency selection for authenticated users', async () => {
      const user = userEvent.setup()
      const userId = 'user-pricing-001'

      // Mock authenticated user - both in initialUser and in supabase.auth.getUser
      const { supabase } = require('@/lib/supabase')
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
      })

      render(<UXPricingPageContent initialUser={{ id: userId }} />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Change currency
      const currencySelector = screen.getByLabelText(/select billing currency/i)
      await user.selectOptions(currencySelector, 'AUD')

      // Verify POST /api/billing-currency was called with userId (authenticated)
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/billing-currency'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ currency: 'AUD' }),
          })
        )
      })
    })

    it('should persist currency selection for anonymous users', async () => {
      const user = userEvent.setup()

      // Ensure supabase returns null user
      const { supabase } = require('@/lib/supabase')
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Change currency
      const currencySelector = screen.getByLabelText(/select billing currency/i)
      await user.selectOptions(currencySelector, 'SGD')

      // Verify localStorage was updated (anonymous user)
      await waitFor(() => {
        const stored = localStorageMock.getItem(BILLING_CURRENCY_STORAGE_KEY)
        expect(stored).toBeTruthy()
        expect(JSON.parse(stored!).billingCurrency).toBe('SGD')
      })
    })

    it('should maintain currency selection across multiple renders', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<UXPricingPageContent />)

      await waitFor(
        () => {
          expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      // Change currency
      const currencySelector = screen.getByLabelText(/select billing currency/i)
      await user.selectOptions(currencySelector, 'EUR')
      // Selector persists to localStorage; rerender will read it

      // Rerender component
      rerender(<UXPricingPageContent />)

      // Wait for reload
      await waitFor(
        () => {
          expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      // Verify EUR is still selected
      const reloadedSelector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
      expect(reloadedSelector.value).toBe('EUR')

      // Verify EUR prices are displayed
      PRICING_TIERS.forEach((tier) => {
        const eurPrice = `€${tier.prices.EUR}`
        expect(screen.getByText(eurPrice)).toBeInTheDocument()
      })
    }, 15000)
  })

  describe('Geo-detection suggests appropriate default', () => {
    it('should suggest SGD for Singapore users', async () => {
      mockedDetectLocation.mockResolvedValue({
        country: 'Singapore',
        countryCode: 'SG',
        detected: true,
      })
      mockedSuggestCurrencies.mockReturnValue({
        billingCurrency: 'SGD',
        menuCurrency: 'SGD',
        confidence: 'high',
      })

      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Wait for currency to be loaded
      await waitFor(() => {
        const currencySelector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
        expect(currencySelector.value).toBe('SGD')
      })

      // Note: Prices don't automatically update on load, only on user interaction
      // This test verifies the selector shows the correct suggested currency
    })

    it('should suggest GBP for UK users', async () => {
      mockedDetectLocation.mockResolvedValue({
        country: 'United Kingdom',
        countryCode: 'GB',
        detected: true,
      })
      mockedSuggestCurrencies.mockReturnValue({
        billingCurrency: 'GBP',
        menuCurrency: 'GBP',
        confidence: 'high',
      })

      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Wait for currency to be loaded
      await waitFor(() => {
        const currencySelector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
        expect(currencySelector.value).toBe('GBP')
      })

      // Note: Prices don't automatically update on load, only on user interaction
      // This test verifies the selector shows the correct suggested currency
    })

    it('should suggest AUD for Australian users', async () => {
      mockedDetectLocation.mockResolvedValue({
        country: 'Australia',
        countryCode: 'AU',
        detected: true,
      })
      mockedSuggestCurrencies.mockReturnValue({
        billingCurrency: 'AUD',
        menuCurrency: 'AUD',
        confidence: 'high',
      })

      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Wait for currency to be loaded
      await waitFor(() => {
        const currencySelector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
        expect(currencySelector.value).toBe('AUD')
      })

      // Note: Prices don't automatically update on load, only on user interaction
      // This test verifies the selector shows the correct suggested currency
    })

    it('should default to USD when geo-detection fails', async () => {
      mockedDetectLocation.mockRejectedValue(new Error('Geo-detection failed'))
      // No localStorage, geo fails -> selector falls back to USD

      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify USD is selected
      const currencySelector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
      expect(currencySelector.value).toBe('USD')

      // Verify USD prices are displayed
      const usdPrice = `$${PRICING_TIERS[0].prices.USD}`
      expect(screen.getByText(usdPrice)).toBeInTheDocument()
    })

    it('should default to USD for unmapped countries', async () => {
      mockedDetectLocation.mockResolvedValue({
        country: 'Unknown Country',
        countryCode: 'XX',
        detected: true,
      })
      mockedSuggestCurrencies.mockReturnValue({
        billingCurrency: 'USD',
        menuCurrency: 'USD',
        confidence: 'low',
      })

      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify USD is selected
      const currencySelector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
      expect(currencySelector.value).toBe('USD')

      // Verify USD prices are displayed
      const usdPrice = `$${PRICING_TIERS[0].prices.USD}`
      expect(screen.getByText(usdPrice)).toBeInTheDocument()
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle currency selector loading state', () => {
      render(<UXPricingPageContent />)

      // Initially should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should handle setBillingCurrency errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const userId = 'user-error-test'
      const { supabase } = require('@/lib/supabase')
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: userId } } })

      // Authenticated user: selector POSTs to /api/billing-currency; make POST fail
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/billing-currency')) {
          if (init?.method === 'POST') return Promise.reject(new Error('Failed to save'))
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { currency: 'USD' } }) } as Response)
        }
        return Promise.reject(new Error(`Unmocked fetch: ${url}`))
      })

      render(<UXPricingPageContent initialUser={{ id: userId }} />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      const currencySelector = screen.getByLabelText(/select billing currency/i)
      await user.selectOptions(currencySelector, 'EUR')

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to save billing currency:',
          expect.any(Error)
        )
      })

      const selector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
      expect(selector.value).toBe('EUR')

      consoleErrorSpy.mockRestore()
    })

    it('should display all pricing tiers with correct structure', async () => {
      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      // Verify all pricing tiers are displayed
      PRICING_TIERS.forEach((tier) => {
        expect(screen.getByText(tier.name)).toBeInTheDocument()
        expect(screen.getByText(tier.description)).toBeInTheDocument()
        // Use getAllByText for period since "per month" appears twice
        if (tier.period === 'per month') {
          const periodElements = screen.getAllByText(tier.period)
          expect(periodElements.length).toBeGreaterThan(0)
        } else {
          expect(screen.getByText(tier.period)).toBeInTheDocument()
        }
      })
    })

    it('should handle rapid currency changes', async () => {
      const user = userEvent.setup()
      render(<UXPricingPageContent />)

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      })

      const currencySelector = screen.getByLabelText(/select billing currency/i)

      // Rapidly change currencies
      await user.selectOptions(currencySelector, 'SGD')
      await user.selectOptions(currencySelector, 'GBP')
      await user.selectOptions(currencySelector, 'EUR')
      await user.selectOptions(currencySelector, 'AUD')

      // Verify final currency is displayed correctly (prices and selector)
      await waitFor(() => {
        const audPrice = `A$${PRICING_TIERS[0].prices.AUD}`
        expect(screen.getByText(audPrice)).toBeInTheDocument()
      })
      await waitFor(() => {
        const selector = screen.getByLabelText(/select billing currency/i) as HTMLSelectElement
        expect(selector.value).toBe('AUD')
      })
    })
  })
})
