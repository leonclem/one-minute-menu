import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock next/navigation for client component navigation
const mockRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock toast hook
const mockShowToast = jest.fn()
jest.mock('@/components/ui', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

import UXMenuTemplateClient from '@/app/ux/menus/[menuId]/template/template-client'

describe('UXMenuTemplateClient (demo flow)', () => {
  beforeEach(() => {
    // Seed demo menu in sessionStorage
    const demoMenu = {
      id: 'demo-123',
      name: 'Demo Brunch',
      items: [{ id: 'i1', name: 'Pancakes', price: 8.5, available: true }],
      theme: {},
    }
    window.sessionStorage.setItem('demoMenu', JSON.stringify(demoMenu))

    // Ensure no real network call is attempted in demo flow
    // @ts-ignore
    global.fetch = jest.fn().mockRejectedValue(new Error('network'))
  })

  afterEach(() => {
    window.sessionStorage.clear()
    jest.clearAllMocks()
    // @ts-ignore
    global.fetch = undefined
  })

  it('shows "Select and Export" for demo users', async () => {
    const { unmount } = render(<UXMenuTemplateClient menuId="demo-123" />)
    expect(await screen.findByText('Select and Export')).toBeInTheDocument()
    unmount()
  })
})


