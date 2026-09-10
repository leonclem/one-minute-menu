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
  it('shows the shot grid and switches to the tree URL', () => {
    render(
      <StudioDishLibrary dish={dish} images={[original]} dishCount={2} />,
    )

    expect(screen.getByRole('heading', { name: 'Chicken Burger' })).toBeInTheDocument()
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

  it('confirms and deletes a shot from the grid', async () => {
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })

    try {
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
      expect(screen.getByText(/No shots yet/)).toBeInTheDocument()
    } finally {
      global.fetch = originalFetch
    }
  })

  it('opens the exports tab', () => {
    render(<StudioDishLibrary dish={dish} images={[original]} dishCount={1} />)
    fireEvent.click(screen.getByRole('tab', { name: /Exports/ }))
    expect(screen.getByTestId('studio-export-matrix')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete dish' })).not.toBeInTheDocument()
  })
})
