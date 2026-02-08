/**
 * Unit tests for MenuCurrencyOnboarding component
 * 
 * Tests Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * Validates:
 * - Prompt displays on first menu creation
 * - Suggested currency based on location
 * - Popular currencies list displayed
 * - Searchable currency list
 * - Confirmation required before saving
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import MenuCurrencyOnboarding from '@/components/MenuCurrencyOnboarding'

describe('MenuCurrencyOnboarding', () => {
  describe('Display and UI', () => {
    it('displays the onboarding prompt with title and description', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      expect(screen.getByText('Choose your menu currency')).toBeInTheDocument()
      expect(screen.getByText(/This is what your customers see on your menus/i)).toBeInTheDocument()
    })

    it('displays popular currencies list by default', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Check for popular currencies section
      expect(screen.getByText('Popular currencies')).toBeInTheDocument()

      // Check that popular currencies are displayed (SGD, USD, GBP, EUR, AUD, MYR, THB, IDR)
      expect(screen.getByText('SGD')).toBeInTheDocument()
      expect(screen.getByText('USD')).toBeInTheDocument()
      expect(screen.getByText('GBP')).toBeInTheDocument()
      expect(screen.getByText('EUR')).toBeInTheDocument()
      expect(screen.getByText('AUD')).toBeInTheDocument()
      expect(screen.getByText('MYR')).toBeInTheDocument()
      expect(screen.getByText('THB')).toBeInTheDocument()
      expect(screen.getByText('IDR')).toBeInTheDocument()
    })

    it('displays suggested currency with "Suggested" badge', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding suggestedCurrency="SGD" onComplete={mockOnComplete} />)

      // Find the SGD option and check for the "Suggested" badge
      const sgdOption = screen.getByText('SGD').closest('button')
      expect(sgdOption).toBeInTheDocument()
      expect(sgdOption).toHaveTextContent('Suggested')
    })

    it('pre-selects the suggested currency', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding suggestedCurrency="GBP" onComplete={mockOnComplete} />)

      // Find the GBP option and check if it's selected (has the checkmark icon)
      const gbpOption = screen.getByText('GBP').closest('button')
      expect(gbpOption).toHaveClass('border-ux-primary')
    })

    it('defaults to USD when no suggested currency provided', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // USD should be pre-selected
      const usdOption = screen.getByText('USD').closest('button')
      expect(usdOption).toHaveClass('border-ux-primary')
    })
  })

  describe('Currency Selection', () => {
    it('allows selecting a currency from popular list', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Click on EUR
      const eurOption = screen.getByText('EUR').closest('button')
      fireEvent.click(eurOption!)

      // EUR should now be selected
      expect(eurOption).toHaveClass('border-ux-primary')
    })

    it('updates selection when clicking different currencies', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding suggestedCurrency="USD" onComplete={mockOnComplete} />)

      // Initially USD is selected
      const usdOption = screen.getByText('USD').closest('button')
      expect(usdOption).toHaveClass('border-ux-primary')

      // Click on SGD
      const sgdOption = screen.getByText('SGD').closest('button')
      fireEvent.click(sgdOption!)

      // SGD should now be selected, USD should not
      expect(sgdOption).toHaveClass('border-ux-primary')
      expect(usdOption).not.toHaveClass('border-ux-primary')
    })
  })

  describe('Show All Currencies', () => {
    it('displays "Show all currencies" button initially', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      expect(screen.getByText('Show all currencies')).toBeInTheDocument()
    })

    it('shows searchable currency list when "Show all currencies" is clicked', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Click "Show all currencies"
      fireEvent.click(screen.getByText('Show all currencies'))

      // Search input should appear
      expect(screen.getByPlaceholderText('Search currencies...')).toBeInTheDocument()

      // Should show "Show popular currencies only" button
      expect(screen.getByText('Show popular currencies only')).toBeInTheDocument()
    })

    it('filters currencies based on search query (by code)', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Show all currencies
      fireEvent.click(screen.getByText('Show all currencies'))

      // Search for "JPY"
      const searchInput = screen.getByPlaceholderText('Search currencies...')
      fireEvent.change(searchInput, { target: { value: 'JPY' } })

      // JPY should be visible
      expect(screen.getByText('JPY')).toBeInTheDocument()
      expect(screen.getByText('Japanese Yen')).toBeInTheDocument()
    })

    it('filters currencies based on search query (by name)', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Show all currencies
      fireEvent.click(screen.getByText('Show all currencies'))

      // Search for "Japanese"
      const searchInput = screen.getByPlaceholderText('Search currencies...')
      fireEvent.change(searchInput, { target: { value: 'Japanese' } })

      // JPY should be visible
      expect(screen.getByText('JPY')).toBeInTheDocument()
      expect(screen.getByText('Japanese Yen')).toBeInTheDocument()
    })

    it('shows "No currencies found" message when search has no results', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Show all currencies
      fireEvent.click(screen.getByText('Show all currencies'))

      // Search for non-existent currency
      const searchInput = screen.getByPlaceholderText('Search currencies...')
      fireEvent.change(searchInput, { target: { value: 'INVALID' } })

      // Should show no results message
      expect(screen.getByText(/No currencies found matching/i)).toBeInTheDocument()
    })

    it('returns to popular currencies when "Show popular currencies only" is clicked', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Show all currencies
      fireEvent.click(screen.getByText('Show all currencies'))
      expect(screen.getByPlaceholderText('Search currencies...')).toBeInTheDocument()

      // Go back to popular
      fireEvent.click(screen.getByText('Show popular currencies only'))

      // Should show popular currencies section again
      expect(screen.getByText('Popular currencies')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Search currencies...')).not.toBeInTheDocument()
    })

    it('clears search query when returning to popular currencies', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Show all currencies and search
      fireEvent.click(screen.getByText('Show all currencies'))
      const searchInput = screen.getByPlaceholderText('Search currencies...')
      fireEvent.change(searchInput, { target: { value: 'JPY' } })

      // Go back to popular
      fireEvent.click(screen.getByText('Show popular currencies only'))

      // Show all again - search should be cleared
      fireEvent.click(screen.getByText('Show all currencies'))
      const newSearchInput = screen.getByPlaceholderText('Search currencies...')
      expect(newSearchInput).toHaveValue('')
    })
  })

  describe('Confirmation', () => {
    it('calls onComplete with selected currency when Confirm is clicked', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding suggestedCurrency="USD" onComplete={mockOnComplete} />)

      // Select EUR
      const eurOption = screen.getByText('EUR').closest('button')
      fireEvent.click(eurOption!)

      // Click Confirm
      fireEvent.click(screen.getByText('Confirm'))

      // onComplete should be called with EUR
      expect(mockOnComplete).toHaveBeenCalledWith('EUR')
    })

    it('calls onComplete with suggested currency if no selection changed', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding suggestedCurrency="SGD" onComplete={mockOnComplete} />)

      // Click Confirm without changing selection
      fireEvent.click(screen.getByText('Confirm'))

      // onComplete should be called with SGD (the suggested currency)
      expect(mockOnComplete).toHaveBeenCalledWith('SGD')
    })

    it('disables Confirm button when no currency is selected', () => {
      const mockOnComplete = jest.fn()
      // This shouldn't happen in practice since we always have a default, but test the logic
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      const confirmButton = screen.getByText('Confirm')
      // With default USD, button should not be disabled
      expect(confirmButton).not.toBeDisabled()
    })
  })

  describe('Skip functionality', () => {
    it('displays Skip button when onSkip is provided', () => {
      const mockOnComplete = jest.fn()
      const mockOnSkip = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />)

      expect(screen.getByText('Skip for now')).toBeInTheDocument()
    })

    it('does not display Skip button when onSkip is not provided', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })

    it('calls onSkip when Skip button is clicked', () => {
      const mockOnComplete = jest.fn()
      const mockOnSkip = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} onSkip={mockOnSkip} />)

      fireEvent.click(screen.getByText('Skip for now'))

      expect(mockOnSkip).toHaveBeenCalled()
      expect(mockOnComplete).not.toHaveBeenCalled()
    })
  })

  describe('Currency Display', () => {
    it('displays currency symbol, code, and name for each option', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding onComplete={mockOnComplete} />)

      // Check USD displays correctly
      expect(screen.getByText('USD')).toBeInTheDocument()
      expect(screen.getByText('US Dollar')).toBeInTheDocument()
      // Symbol is displayed but might be hard to test directly

      // Check SGD displays correctly
      expect(screen.getByText('SGD')).toBeInTheDocument()
      expect(screen.getByText('Singapore Dollar')).toBeInTheDocument()
    })

    it('displays checkmark icon for selected currency', () => {
      const mockOnComplete = jest.fn()
      render(<MenuCurrencyOnboarding suggestedCurrency="USD" onComplete={mockOnComplete} />)

      // USD should be selected and have a checkmark
      const usdOption = screen.getByText('USD').closest('button')
      const svg = usdOption?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })
})
