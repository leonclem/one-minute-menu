import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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

import UXMenuExportClient from '@/app/ux/menus/[menuId]/export/export-client'

describe('UXMenuExportClient (demo flow)', () => {
  beforeEach(() => {
    // Seed demo menu in sessionStorage
    const demoMenu = {
      id: 'demo-xyz',
      name: 'Demo Menu',
      items: [{ id: 'i1', name: 'Pasta' }, { id: 'i2', name: 'Salad' }],
      theme: { name: 'Modern' },
      imageUrl: '/test.jpg',
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

  it('renders export options and CTA for demo users', async () => {
    render(<UXMenuExportClient menuId="demo-xyz" />)

    expect(await screen.findByText(/Export Your Menu/i)).toBeInTheDocument()
    expect(screen.getByText(/Choose Your Export Format/i)).toBeInTheDocument()

    // Export options
    expect(screen.getByText('PDF Menu')).toBeInTheDocument()
    expect(screen.getByText('Menu Image')).toBeInTheDocument()
    expect(screen.getByText('Web Menu')).toBeInTheDocument()
    expect(screen.getByText('Menu Images Zip')).toBeInTheDocument()

    // Conversion CTA
    expect(screen.getByText('Try it with your own menu →')).toBeInTheDocument()
  })
})

describe('UXMenuExportClient (authenticated flow)', () => {
  afterEach(() => {
    // @ts-ignore
    global.fetch = undefined
  })

  it('fetches menu info and renders heading for authenticated users', async () => {
    // Mock GET /api/menus/:id
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Auth Menu',
          items: [{ id: '1', name: 'Burger' }],
          theme: { name: 'Modern' },
          imageUrl: '/auth.jpg',
        },
      }),
    })

    render(<UXMenuExportClient menuId="123e4567-e89b-12d3-a456-426614174000" />)

    await waitFor(() => {
      expect(screen.getByText(/Export Your Menu/i)).toBeInTheDocument()
      expect(screen.getByText(/Choose Your Export Format/i)).toBeInTheDocument()
    })
  })
})


