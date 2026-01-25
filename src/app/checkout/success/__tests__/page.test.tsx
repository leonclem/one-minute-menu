/**
 * Checkout Success Page Component Tests
 * 
 * Tests for the success page including polling logic, status display, and error handling
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import CheckoutSuccessPage from '../page'
import { Suspense } from 'react'

// Helper to flush microtasks
const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

// Mock next/navigation
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
}

const mockSearchParams = {
  get: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}))

// Mock fetch globally
global.fetch = jest.fn()

describe('CheckoutSuccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockSearchParams.get.mockReturnValue('cs_test_123')
  })

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  const renderPage = () => render(
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutSuccessPage />
    </Suspense>
  )

  describe('Rendering', () => {
    it('should render page title', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Processing your purchase...')).toBeInTheDocument()
      })
    })

    it('should display session ID when provided', async () => {
      mockSearchParams.get.mockReturnValue('cs_test_abc123')
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/Session: cs_test_abc123/)).toBeInTheDocument()
      })
    })

    it('should show loading spinner during polling', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        const spinner = document.querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
      })
    })
  })

  describe('Polling Logic', () => {
    it('should poll profile API every 2 seconds initially', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // First poll after 2 seconds
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await act(async () => {
        await flushPromises()
      })

      await waitFor(() => {
        // 1 (initial) + 1 (verify) + 1 (profile) = 3
        expect(global.fetch).toHaveBeenCalledTimes(3)
      })

      // Second poll after another 2 seconds
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await act(async () => {
        await flushPromises()
      })

      await waitFor(() => {
        // 3 (prev) + 1 (verify) + 1 (profile) = 5
        expect(global.fetch).toHaveBeenCalledTimes(5)
      })
    })

    it('should stop polling when plan is updated', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              plan: 'free',
            },
          }),
        }) // Initial fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            processed: false,
          }),
        }) // First poll - verify
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              plan: 'free',
            },
          }),
        }) // First poll - profile
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            processed: false,
          }),
        }) // Second poll - verify
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              plan: 'grid_plus', // Plan updated!
            },
          }),
        }) // Second poll - profile

      renderPage()
      
      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // First poll - still free
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await act(async () => {
        await flushPromises()
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3)
      })

      // Second poll - plan updated
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await act(async () => {
        await flushPromises()
      })

      await waitFor(() => {
        expect(screen.getByText(/Purchase successful/)).toBeInTheDocument()
      })

      // Should not poll again
      await act(async () => {
        jest.advanceTimersByTime(5000)
      })
      await act(async () => {
        await flushPromises()
      })

      expect(global.fetch).toHaveBeenCalledTimes(5) // No additional calls
    })

    it('should show timeout message after max polling attempts', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free', // Never updates
          },
        }),
      })

      renderPage()
      
      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // Advance through all polling attempts (15 attempts)
      for (let i = 0; i < 16; i++) {
        await act(async () => {
          jest.advanceTimersByTime(5000)
        })
        await act(async () => {
          await flushPromises()
        })
      }

      await waitFor(() => {
        expect(screen.getByText(/Purchase is being processed/)).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should use progressive backoff for polling intervals', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      const callCounts: number[] = []

      // First 5 polls should be 2s intervals
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000)
        })
        await act(async () => {
          await flushPromises()
        })
        await waitFor(() => {
          callCounts.push((global.fetch as jest.Mock).mock.calls.length)
        })
      }

      // Later polls should use longer intervals (3s, 4s, 5s)
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })
      await act(async () => {
        await flushPromises()
      })
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })

  describe('Success State', () => {
    it('should show success message when plan is updated to Grid+', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              plan: 'free',
            },
          }),
        }) // Initial fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            processed: false,
          }),
        }) // First poll - verify
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              plan: 'grid_plus',
            },
          }),
        }) // First poll - profile

      renderPage()
      
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await act(async () => {
        await flushPromises()
      })

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Grid\+!/)).toBeInTheDocument()
      })
    })

    it('should show success message when plan is updated to Grid+ Premium', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              plan: 'free',
            },
          }),
        }) // Initial fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            processed: false,
          }),
        }) // First poll - verify
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              plan: 'grid_plus_premium',
            },
          }),
        }) // First poll - profile

      renderPage()
      
      await act(async () => {
        jest.advanceTimersByTime(2000)
      })
      await act(async () => {
        await flushPromises()
      })

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Grid\+ Premium!/)).toBeInTheDocument()
      })
    })

    it('should show success immediately if already on paid plan', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'grid_plus',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/Purchase successful/)).toBeInTheDocument()
      })
    })

    it('should display dashboard link on success', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'grid_plus',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        const dashboardLink = screen.getByText('Go to Dashboard')
        expect(dashboardLink).toBeInTheDocument()
        expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard')
      })
    })

    it('should show confirmation email message on success', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'grid_plus',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/You'll receive a confirmation email shortly/)).toBeInTheDocument()
      })
    })
  })

  describe('Timeout State', () => {
    it('should show timeout message after max attempts', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      // Advance through all polling attempts
      for (let i = 0; i < 16; i++) {
        await act(async () => {
          jest.advanceTimersByTime(5000)
        })
        await act(async () => {
          await flushPromises()
        })
      }

      await waitFor(() => {
        expect(screen.getByText(/Your purchase is being processed/)).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should show email confirmation message on timeout', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      // Advance through all polling attempts
      for (let i = 0; i < 16; i++) {
        await act(async () => {
          jest.advanceTimersByTime(5000)
        })
        await act(async () => {
          await flushPromises()
        })
      }

      await waitFor(() => {
        expect(screen.getByText(/You'll receive an email confirmation shortly/)).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should show verify button on timeout', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      // Advance through all polling attempts
      for (let i = 0; i < 16; i++) {
        await act(async () => {
          jest.advanceTimersByTime(5000)
        })
        await act(async () => {
          await flushPromises()
        })
      }

      await waitFor(() => {
        expect(screen.getByText('Verify Purchase Now')).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should show dashboard link on timeout', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      // Advance through all polling attempts
      for (let i = 0; i < 16; i++) {
        await act(async () => {
          jest.advanceTimersByTime(5000)
        })
        await act(async () => {
          await flushPromises()
        })
      }

      await waitFor(() => {
        const dashboardLink = screen.getByText('Go to Dashboard')
        expect(dashboardLink).toBeInTheDocument()
      }, { timeout: 10000 })
    })
  })

  describe('Error State', () => {
    it('should show error message when profile fetch fails', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/Unable to verify purchase/)).toBeInTheDocument()
      })
    })

    it('should show try again button on error', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      })
    })

    it('should show dashboard link on error', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      renderPage()
      
      await waitFor(() => {
        const dashboardLink = screen.getByText('Go to Dashboard')
        expect(dashboardLink).toBeInTheDocument()
      })
    })

    it('should show reassuring message on error', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/If you completed the payment, your account will be upgraded automatically/)).toBeInTheDocument()
      })
    })
  })

  describe('Support Information', () => {
    it('should display support email', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        const supportLink = screen.getByText('support@gridmenu.app')
        expect(supportLink).toBeInTheDocument()
        expect(supportLink).toHaveAttribute('href', 'mailto:support@gridmenu.app')
      })
    })

    it('should display reference ID when session ID is provided', async () => {
      mockSearchParams.get.mockReturnValue('cs_test_reference_123')
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            plan: 'free',
          },
        }),
      })

      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText(/Reference ID: cs_test_reference_123/)).toBeInTheDocument()
      })
    })
  })
})
