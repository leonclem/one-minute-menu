import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import UXMenuExtractedClient from '../../app/ux/menus/[menuId]/extracted/extracted-client'

const mockRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

const mockShowToast = jest.fn()
jest.mock('../../components/ui', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

describe('UX Extracted Page', () => {
  beforeEach(() => {
    // Reset sessionStorage and fetch mocks
    sessionStorage.clear()
    // Prevent accidental network in demo flow by default
    // @ts-ignore
    global.fetch = jest.fn().mockRejectedValue(new Error('network'))
  })

  afterEach(() => {
    jest.clearAllMocks()
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

    const { unmount } = render(<UXMenuExtractedClient menuId="demo-1" />)

    expect(await screen.findByText(/Review Extracted Items/i)).toBeInTheDocument()
    expect(screen.getByText(/Proceed to GridMenu layout/i)).toBeInTheDocument()
    // There are two occurrences ("We found 2 items..." and a summary badge). Accept either.
    expect(screen.getAllByText(/2\s*items/i).length).toBeGreaterThan(0)
    // Should show category headers
    expect(screen.getByText('Starters')).toBeInTheDocument()
    expect(screen.getByText('Mains')).toBeInTheDocument()

    unmount()
  })

  it('opens zoom modal when clicking a demo item thumbnail image', async () => {
    const demoMenuWithImages = {
      id: 'demo-zoom',
      name: 'Demo Zoom Menu',
      items: [
        {
          id: '1',
          name: 'Zoom Soup',
          price: 7.5,
          description: 'Tomato soup',
          category: 'Starters',
          customImageUrl: '/ux/sample-menus/generated/test/zoom-soup.webp',
        },
      ],
    }

    sessionStorage.setItem('demoMenu', JSON.stringify(demoMenuWithImages))

    const { unmount } = render(<UXMenuExtractedClient menuId="demo-zoom" />)

    // Wait for the extracted page heading
    expect(await screen.findByText(/Review Extracted Items/i)).toBeInTheDocument()

    // Click the thumbnail button for the demo item
    const thumbButton = screen.getByRole('button', { name: /photos for Zoom Soup/i })
    fireEvent.click(thumbButton)

    // Zoomable modal should appear
    expect(
      screen.getByRole('dialog', { name: /Image preview/i })
    ).toBeInTheDocument()

    unmount()
  })

  it('fetches and renders authenticated extraction results and control panel', async () => {
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

    const { unmount } = render(<UXMenuExtractedClient menuId="abc123" />)

    await waitFor(() => {
      expect(screen.getByText('Starters')).toBeInTheDocument()
      expect(screen.getByText('Soup')).toBeInTheDocument()
      expect(screen.getByText(/Menu control panel/i)).toBeInTheDocument()
    })

    unmount()
  })
})


