import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock next/navigation router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock toast hook
const mockShowToast = jest.fn()
jest.mock('@/components/ui', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

// Mock conversion tracking so we can assert on calls without sending network traffic
const mockTrackConversionEvent = jest.fn()
jest.mock('@/lib/conversion-tracking', () => ({
  trackConversionEvent: (...args: any[]) => mockTrackConversionEvent(...args),
}))

// Import the demo sample client component
import DemoSampleClient from '@/app/ux/demo/sample/demo-sample-client'

describe('DemoSampleClient (sample demo flow)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.sessionStorage.clear()
    // Avoid real network calls
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'menu-demo-1',
          name: 'Breakfast menu',
        },
      }),
    })
  })

  afterEach(() => {
    // @ts-ignore
    global.fetch = undefined
  })

  it('starts demo from a sample menu and tracks conversion + navigation', async () => {
    render(<DemoSampleClient />)

    const tryButtons = screen.getAllByRole('button', { name: /try this menu/i })
    expect(tryButtons.length).toBeGreaterThan(0)

    fireEvent.click(tryButtons[0])

    // Should track demo_start immediately
    expect(mockTrackConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'demo_start',
        metadata: expect.objectContaining({
          path: '/ux/demo/sample',
        }),
      }),
    )

    await waitFor(() => {
      // After API responds, should show success toast and navigate to extract step
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
        }),
      )
      expect(mockPush).toHaveBeenCalledWith('/ux/menus/menu-demo-1/extract')
    })

    // demo_completed should also be tracked with menuId
    expect(mockTrackConversionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'demo_completed',
        metadata: expect.objectContaining({
          menuId: 'menu-demo-1',
        }),
      }),
    )

    // demoMenu should be persisted in sessionStorage
    const stored = window.sessionStorage.getItem('demoMenu')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored as string)
    expect(parsed.id).toBe('menu-demo-1')
    expect(parsed.imageUrl).toBeDefined()
  })

  it('shows an error toast if demo menu creation fails', async () => {
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to create demo menu' }),
    })

    render(<DemoSampleClient />)

    const tryButtons = screen.getAllByRole('button', { name: /try this menu/i })
    fireEvent.click(tryButtons[0])

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        }),
      )
    })

    // Should not navigate on failure
    expect(mockPush).not.toHaveBeenCalled()
  })
}


