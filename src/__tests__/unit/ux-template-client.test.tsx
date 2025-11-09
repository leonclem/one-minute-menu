import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock next/navigation for client component navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock toast hook
jest.mock('@/components/ui', () => ({
  useToast: () => ({ showToast: jest.fn() }),
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
  })

  afterEach(() => {
    window.sessionStorage.clear()
    jest.clearAllMocks()
  })

  it('shows "Select and Export" for demo users', async () => {
    render(<UXMenuTemplateClient menuId="demo-123" />)
    expect(await screen.findByText('Select and Export')).toBeInTheDocument()
  })
})


