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

import UXMenuExportClient from '@/app/menus/[menuId]/export/export-client'

// Template selection mock data
const mockTemplateSelection = {
  menuId: 'demo-xyz',
  templateId: 'classic-grid-cards',
  templateVersion: '1.0.0',
  configuration: {
    textOnly: false,
    useLogo: false,
  },
}

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
    
    // Seed template selection in sessionStorage (required for export page)
    window.sessionStorage.setItem(`templateSelection-demo-xyz`, JSON.stringify(mockTemplateSelection))

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
    window.sessionStorage.clear()
    // @ts-ignore
    global.fetch = undefined
  })

  it('fetches menu info and renders heading for authenticated users', async () => {
    const menuId = '123e4567-e89b-12d3-a456-426614174000'
    
    // Mock fetch to handle multiple API calls
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === `/api/menus/${menuId}`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: menuId,
              name: 'Auth Menu',
              items: [{ id: '1', name: 'Burger' }],
              theme: { name: 'Modern' },
              imageUrl: '/auth.jpg',
            },
          }),
        })
      }
      if (url === `/api/menus/${menuId}/template-selection`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              ...mockTemplateSelection,
              menuId,
            },
          }),
        })
      }
      return Promise.reject(new Error('Unmocked endpoint: ' + url))
    }) as jest.Mock

    render(<UXMenuExportClient menuId={menuId} />)

    await waitFor(() => {
      expect(screen.getByText(/Export Your Menu/i)).toBeInTheDocument()
      expect(screen.getByText(/Choose Your Export Format/i)).toBeInTheDocument()
    })
  })
})


