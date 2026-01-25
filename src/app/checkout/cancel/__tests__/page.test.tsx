/**
 * Checkout Cancel Page Component Tests
 * 
 * Tests for the cancel page including message display and navigation options
 * Requirements: 3.2, 3.3
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import CheckoutCancelPage from '../page'

// Mock next/navigation
const mockSearchParams = {
  get: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

describe('CheckoutCancelPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page title', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('Payment Cancelled')).toBeInTheDocument()
    })

    it('should display cancellation icon', () => {
      render(<CheckoutCancelPage />)
      
      const icon = document.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('should show cancellation message', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('Your payment was cancelled')).toBeInTheDocument()
    })

    it('should show no charges message', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('No charges were made to your account.')).toBeInTheDocument()
    })

    it('should show retry encouragement message', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText(/You can try again whenever you're ready to upgrade/)).toBeInTheDocument()
    })
  })

  describe('Navigation Options', () => {
    it('should display try again button', () => {
      render(<CheckoutCancelPage />)
      
      const tryAgainButton = screen.getByText('Try Again')
      expect(tryAgainButton).toBeInTheDocument()
    })

    it('should link try again button to upgrade page', () => {
      render(<CheckoutCancelPage />)
      
      const tryAgainButton = screen.getByText('Try Again')
      const link = tryAgainButton.closest('a')
      expect(link).toHaveAttribute('href', '/upgrade')
    })

    it('should display dashboard button', () => {
      render(<CheckoutCancelPage />)
      
      const dashboardButton = screen.getByText('Go to Dashboard')
      expect(dashboardButton).toBeInTheDocument()
    })

    it('should link dashboard button to dashboard page', () => {
      render(<CheckoutCancelPage />)
      
      const dashboardButton = screen.getByText('Go to Dashboard')
      const link = dashboardButton.closest('a')
      expect(link).toHaveAttribute('href', '/dashboard')
    })
  })

  describe('Upgrade Benefits Section', () => {
    it('should display upgrade benefits heading', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('Why upgrade?')).toBeInTheDocument()
    })

    it('should list unlimited menus benefit', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText(/Create unlimited menus with Grid\+ Premium/)).toBeInTheDocument()
    })

    it('should list AI image generation benefit', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText(/Generate AI images for your menu items/)).toBeInTheDocument()
    })

    it('should list premium templates benefit', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText(/Access premium templates and themes/)).toBeInTheDocument()
    })

    it('should list priority support benefit', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('Priority support')).toBeInTheDocument()
    })
  })

  describe('Support Information', () => {
    it('should display support contact prompt', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText(/Have questions/)).toBeInTheDocument()
    })

    it('should display support email link', () => {
      render(<CheckoutCancelPage />)
      
      const supportLink = screen.getByText('Contact support')
      expect(supportLink).toBeInTheDocument()
      expect(supportLink).toHaveAttribute('href', 'mailto:support@gridmenu.app')
    })
  })

  describe('Session ID Display', () => {
    it('should display session ID when provided', () => {
      mockSearchParams.get.mockReturnValue('cs_test_cancelled_123')
      
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText(/Reference ID: cs_test_cancelled_123/)).toBeInTheDocument()
    })

    it('should not display reference ID section when no session ID', () => {
      mockSearchParams.get.mockReturnValue(null)
      
      render(<CheckoutCancelPage />)
      
      expect(screen.queryByText(/Reference ID:/)).not.toBeInTheDocument()
    })

    it('should display full session ID', () => {
      const longSessionId = 'cs_test_a1b2c3d4e5f6g7h8i9j0'
      mockSearchParams.get.mockReturnValue(longSessionId)
      
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText(`Reference ID: ${longSessionId}`)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<CheckoutCancelPage />)
      
      const mainHeading = screen.getByText('Payment Cancelled')
      expect(mainHeading.tagName).toBe('H3')
    })

    it('should have accessible links', () => {
      render(<CheckoutCancelPage />)
      
      const links = screen.getAllByRole('link')
      links.forEach(link => {
        expect(link).toHaveAccessibleName()
      })
    })

    it('should have proper button styling', () => {
      render(<CheckoutCancelPage />)
      
      const tryAgainButton = screen.getByText('Try Again')
      expect(tryAgainButton.closest('button')).toBeInTheDocument()
    })
  })

  describe('Visual Design', () => {
    it('should display icon with proper styling', () => {
      render(<CheckoutCancelPage />)
      
      const iconContainer = document.querySelector('.rounded-full.bg-secondary-100')
      expect(iconContainer).toBeInTheDocument()
    })

    it('should have proper spacing between sections', () => {
      render(<CheckoutCancelPage />)
      
      const card = document.querySelector('.max-w-2xl')
      expect(card).toBeInTheDocument()
    })

    it('should display benefits as a list', () => {
      render(<CheckoutCancelPage />)
      
      const list = document.querySelector('ul.list-disc')
      expect(list).toBeInTheDocument()
    })
  })

  describe('User Experience', () => {
    it('should provide clear next steps', () => {
      render(<CheckoutCancelPage />)
      
      // Should have both retry and dashboard options
      expect(screen.getByText('Try Again')).toBeInTheDocument()
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    })

    it('should reassure user about no charges', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('No charges were made to your account.')).toBeInTheDocument()
    })

    it('should encourage user to upgrade with benefits', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('Why upgrade?')).toBeInTheDocument()
      const benefits = screen.getAllByRole('listitem')
      expect(benefits.length).toBeGreaterThan(0)
    })

    it('should provide support contact for questions', () => {
      render(<CheckoutCancelPage />)
      
      expect(screen.getByText('Contact support')).toBeInTheDocument()
    })
  })
})
