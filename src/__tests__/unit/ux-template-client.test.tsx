import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock next/navigation for client component navigation
const mockRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/menus/demo-123/template',
}))

// Mock toast hook
const mockShowToast = jest.fn()
jest.mock('@/components/ui', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

import UXMenuTemplateClient from '@/app/menus/[menuId]/template/template-client'

// Mock template response matching the API format
const mockTemplatesResponse = {
  data: [
    {
      template: {
        id: 'classic-grid-cards',
        name: 'Classic Grid Cards',
        description: 'A classic grid layout',
        previewImageUrl: '/previews/classic.png',
        capabilities: { supportsImages: true },
        constraints: { hardMaxItems: 150 }
      },
      compatibility: { status: 'OK', message: null, warnings: [] }
    },
    {
      template: {
        id: 'two-column-text',
        name: 'Two Column Text',
        description: 'A text-based two-column layout',
        previewImageUrl: '/previews/two-col.png',
        capabilities: { supportsImages: false },
        constraints: { hardMaxItems: 150 }
      },
      compatibility: { status: 'OK', message: null, warnings: [] }
    }
  ]
}

// Mock layout preview response
const mockLayoutResponse = {
  success: true,
  data: {
    templateId: 'classic-grid-cards',
    templateVersion: '1.0.0',
    pageSpec: {
      id: 'A4_PORTRAIT',
      width: 595.28,
      height: 841.89,
      margins: { top: 36, right: 36, bottom: 36, left: 36 }
    },
    pages: [{
      pageIndex: 0,
      pageType: 'SINGLE',
      regions: [],
      tiles: [
        { 
          id: 'title', 
          type: 'TITLE', 
          regionId: 'header', 
          x: 0, 
          y: 0, 
          width: 523, 
          height: 50, 
          colSpan: 3, 
          rowSpan: 1, 
          gridRow: 0, 
          gridCol: 0, 
          layer: 'content', 
          content: { text: 'Demo Brunch' } 
        }
      ]
    }],
    totalPages: 1
  }
}

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

    // Mock fetch for API calls
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/templates/available') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTemplatesResponse)
        })
      }
      if (url.includes('/api/menus/') && url.includes('/layout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLayoutResponse)
        })
      }
      return Promise.reject(new Error('Unmocked endpoint: ' + url))
    }) as jest.Mock
  })

  afterEach(() => {
    window.sessionStorage.clear()
    jest.clearAllMocks()
    // @ts-ignore
    global.fetch = undefined
  })

  it('shows "Confirm and Export" for demo users', async () => {
    const { unmount } = render(<UXMenuTemplateClient menuId="demo-123" />)
    expect(await screen.findByText(/Confirm and Export/)).toBeInTheDocument()
    unmount()
  })
})


