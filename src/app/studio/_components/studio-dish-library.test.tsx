import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import type { StudioDishRecord, StudioImageRecord } from '@/lib/studio/types'
import { StudioDishLibrary } from './studio-dish-library'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

jest.mock('./use-studio-dish-exports', () => ({
  useStudioDishExports: () => ({
    shots: [],
    pending: false,
    error: null,
    loaded: true,
    refresh: jest.fn(),
    replaceShotTiles: jest.fn(),
  }),
}))

jest.mock('@/lib/product-mode', () => ({
  isStudioReshootEnabled: () => false,
}))

const dish: StudioDishRecord = {
  id: 'd1',
  user_id: 'u1',
  name: 'Chicken Burger',
  description: null,
  current_image_id: 'og',
  generation_failure_count: 0,
  generation_blocked_at: null,
  generation_blocked_reason: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-02T00:00:00.000Z',
}

const original: StudioImageRecord = {
  id: 'og',
  dish_id: 'd1',
  user_id: 'u1',
  role: 'source',
  source_image_id: null,
  storage_path: 'og.png',
  public_url: 'https://example.com/og.png',
  mime_type: 'image/png',
  width: 1024,
  height: 1024,
  prompt: null,
  model: null,
  metadata: {},
  is_favourite: false,
  archived_at: null,
  created_at: '2026-08-15T00:00:00.000Z',
}

describe('StudioDishLibrary', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockReplace.mockReset()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [original] }),
    })
  })

  it('shows the shot grid and switches to the tree URL', async () => {
    render(
      <StudioDishLibrary dish={dish} images={[original]} dishCount={2} />,
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/studio/images?dishId=d1',
        expect.objectContaining({ cache: 'no-store' }),
      )
    })

    expect(screen.getByRole('heading', { name: 'Chicken Burger' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All dishes' })).toHaveAttribute('href', '/studio')
    expect(screen.getByTestId('studio-shot-grid')).toHaveClass(
      'lg:grid-cols-4',
      'xl:grid-cols-5',
    )
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/studio/d1/og',
    )
    expect(screen.queryByRole('link', { name: 'Branch here' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tree' }))
    expect(mockReplace).toHaveBeenCalledWith('/studio/d1?view=tree', { scroll: false })
    expect(screen.getByTestId('studio-shot-tree')).toBeInTheDocument()
    expect(screen.getByTestId('studio-shot-tree-thumb')).toHaveClass('h-14', 'w-14')
    expect(screen.getByRole('link', { name: 'Branch here' })).toHaveAttribute(
      'href',
      '/studio/d1/og',
    )
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('hides Grid and Tree view controls for guests', () => {
    render(
      <StudioDishLibrary
        dish={dish}
        images={[original]}
        dishCount={1}
        isGuest
      />,
    )

    expect(screen.getByTestId('studio-shot-grid')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Grid' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tree' })).not.toBeInTheDocument()
  })

  it('refetches shots when the library is shown', async () => {
    const generated: StudioImageRecord = {
      ...original,
      id: 'g1',
      role: 'generated',
      source_image_id: 'og',
      public_url: 'https://example.com/g1.png',
      created_at: '2026-08-16T00:00:00.000Z',
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [original, generated] }),
    })

    render(<StudioDishLibrary dish={dish} images={[original]} dishCount={1} />)

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Edit' })).toHaveLength(2)
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/studio/images?dishId=d1',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('makes the first upload action prominent in the empty state', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [] }),
    })

    render(
      <StudioDishLibrary
        dish={{ ...dish, current_image_id: null }}
        images={[]}
        dishCount={1}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Upload your first dish photo' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/adjust lighting, surface, backdrop, and crop/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ New shot' })).not.toBeInTheDocument()
  })

  it('confirms and deletes a shot from the grid', async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ images: [original] }) })
    })

    render(<StudioDishLibrary dish={dish} images={[original]} dishCount={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete shot' }))
    expect(screen.getByText('Delete this image?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/studio/images/og', { method: 'DELETE' })
    })
    await waitFor(() => {
      expect(screen.queryByTestId('studio-shot-grid')).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('heading', { name: 'Upload your first dish photo' }),
    ).toBeInTheDocument()
  })

  it('opens the exports tab', async () => {
    render(<StudioDishLibrary dish={dish} images={[original]} dishCount={1} />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/studio/images?dishId=d1',
        expect.objectContaining({ cache: 'no-store' }),
      )
    })
    fireEvent.click(screen.getByRole('tab', { name: /Exports/ }))
    expect(screen.getByTestId('studio-export-matrix')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete dish' })).not.toBeInTheDocument()
  })
})
