import React from 'react'
import { render, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { DASHBOARD_REFRESH_KEY } from '@/lib/dashboard-refresh'

const mockRouter = { refresh: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

import { DashboardAutoRefresh } from '@/components/dashboard/DashboardAutoRefresh'

describe('DashboardAutoRefresh', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    jest.clearAllMocks()
  })

  it('refreshes once when the flag is set', async () => {
    window.sessionStorage.setItem(DASHBOARD_REFRESH_KEY, '1')
    render(<DashboardAutoRefresh />)

    await waitFor(() => {
      expect(mockRouter.refresh).toHaveBeenCalledTimes(1)
    })

    expect(window.sessionStorage.getItem(DASHBOARD_REFRESH_KEY)).toBeNull()
  })

  it('does nothing when the flag is not set', async () => {
    render(<DashboardAutoRefresh />)
    await waitFor(() => {
      expect(mockRouter.refresh).toHaveBeenCalledTimes(0)
    })
  })
})

