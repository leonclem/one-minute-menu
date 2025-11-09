import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import UXMenuExtractedClient from '../../app/ux/menus/[menuId]/extracted/extracted-client'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('../../components/ui', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}))

describe('UX Extracted Page', () => {
  beforeEach(() => {
    // Reset sessionStorage and fetch mocks
    sessionStorage.clear()
    // @ts-ignore
    global.fetch = undefined
  })

  it('renders demo extracted items and CTA text', async () => {
    const demoMenu = {
      id: 'demo-1',
      name: 'Demo Bistro',
      items: [
        { id: '1', name: 'Soup', price: 5.5, description: 'Tomato soup', category: 'Starters' },
        { id: '2', name: 'Steak', price: 19.99, description: 'Sirloin', category: 'Mains' },
      ],
    }

    sessionStorage.setItem('demoMenu', JSON.stringify(demoMenu))

    render(<UXMenuExtractedClient menuId="demo-1" />)

    expect(await screen.findByText(/Review Extracted Items/i)).toBeInTheDocument()
    expect(screen.getByText(/Proceed to Image Generation and GridMenu layout/i)).toBeInTheDocument()
    expect(screen.getByText(/2 items/)).toBeInTheDocument()
    // Should show category headers
    expect(screen.getByText('Starters')).toBeInTheDocument()
    expect(screen.getByText('Mains')).toBeInTheDocument()
  })

  it('fetches and renders authenticated extraction results', async () => {
    sessionStorage.setItem('extractionJob:abc123', 'job-1')
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          status: 'completed',
          result: {
            menu: {
              categories: [
                {
                  name: 'Starters',
                  items: [{ name: 'Soup', price: 6.0, description: 'Tomato', confidence: 0.98 }],
                },
              ],
            },
            currency: 'USD',
            uncertainItems: [],
            superfluousText: [],
          },
        },
      }),
    })

    render(<UXMenuExtractedClient menuId="abc123" />)

    await waitFor(() => {
      expect(screen.getByText('Starters')).toBeInTheDocument()
      expect(screen.getByText('Soup')).toBeInTheDocument()
    })
  })
})


