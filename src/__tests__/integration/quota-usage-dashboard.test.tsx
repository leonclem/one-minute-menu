import { render, screen, waitFor } from '@testing-library/react'
import QuotaUsageDashboard from '@/components/QuotaUsageDashboard'

describe('QuotaUsageDashboard', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch as any
    jest.restoreAllMocks()
  })

  it('renders happy path with remaining quota', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          quota: {
            plan: 'free',
            limit: 10,
            used: 5,
            remaining: 5,
            resetDate: new Date().toISOString(),
            warningThreshold: 8,
            needsUpgrade: false,
          },
          usage: {
            currentMonth: { total: 5, successful: 4, failed: 1, variations: 6 },
            previousMonth: { total: 3, successful: 3 },
            allTime: { total: 8, estimatedCost: 0.16 },
          },
        },
      }),
    } as any)

    render(<QuotaUsageDashboard />)

    await waitFor(() => {
      expect(screen.getByText('AI Image Generation Quota')).toBeInTheDocument()
      expect(screen.getByText('5/10')).toBeInTheDocument()
      expect(screen.getByText('Remaining')).toBeInTheDocument()
      expect(screen.getByText('This month')).toBeInTheDocument()
      expect(screen.queryByText('Upgrade required')).not.toBeInTheDocument()
    })
  })

  it('renders upgrade prompt when exceeded', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          quota: {
            plan: 'free',
            limit: 10,
            used: 10,
            remaining: 0,
            resetDate: new Date().toISOString(),
            warningThreshold: 8,
            needsUpgrade: true,
          },
          usage: {
            currentMonth: { total: 10, successful: 9, failed: 1, variations: 12 },
            previousMonth: { total: 3, successful: 3 },
            allTime: { total: 13, estimatedCost: 0.26 },
          },
        },
      }),
    } as any)

    render(<QuotaUsageDashboard />)

    await waitFor(() => {
      expect(screen.getByText('AI image generation limit reached')).toBeInTheDocument()
      expect(screen.getByText('Upgrade to continue')).toBeInTheDocument()
    })
  })
})


