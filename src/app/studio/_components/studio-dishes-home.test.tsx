import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import type { StudioDishListItem } from '@/lib/studio/types'
import { StudioDishesHome } from './studio-dishes-home'

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/lib/studio/analytics/studio-analytics', () => ({
  trackStudioEvent: jest.fn(),
}))

function listedDish(overrides: Partial<StudioDishListItem> = {}): StudioDishListItem {
  return {
    id: 'd1',
    user_id: 'u1',
    name: 'Chicken Burger',
    description: null,
    current_image_id: 'img-2',
    generation_failure_count: 0,
    generation_blocked_at: null,
    generation_blocked_reason: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
    current_image_url: 'https://cdn.example/2.png',
    shotCount: 7,
    readyExportCount: 6,
    ...overrides,
  }
}

const homeProps = {
  accessMode: 'open' as const,
  accessReason: 'granted_open' as const,
  isAdmin: false,
  studioFirstRunDismissed: true,
}

describe('StudioDishesHome', () => {
  beforeEach(() => {
    mockPush.mockReset()
    global.fetch = jest.fn()
  })

  it('lists dishes with shot and export counts', () => {
    render(
      <StudioDishesHome
        {...homeProps}
        dishes={[
          listedDish(),
          listedDish({
            id: 'd2',
            name: 'Mushroom Risotto',
            current_image_id: null,
            current_image_url: null,
            shotCount: 0,
            readyExportCount: 0,
          }),
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Your dishes' })).toBeInTheDocument()
    expect(screen.getByTestId('studio-dishes-grid')).toHaveClass(
      'lg:grid-cols-4',
      'xl:grid-cols-5',
    )
    expect(screen.getByRole('link', { name: /Chicken Burger/ })).toHaveAttribute(
      'href',
      '/studio/d1',
    )
    expect(screen.getByText('7 shots · 6 files ready')).toBeInTheDocument()
    expect(screen.getByText('No photo yet')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('uses the first-run panel as the empty home, without Your dishes chrome', () => {
    render(<StudioDishesHome {...homeProps} studioFirstRunDismissed={false} dishes={[]} />)

    expect(screen.getByTestId('studio-first-run-panel')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your dishes' })).not.toBeInTheDocument()
    expect(screen.queryByText(/open a dish to edit/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Don't show this again")).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '+ New dish' })).toHaveLength(1)
  })

  it('keeps Your dishes chrome and lets a returning user dismiss first-run', () => {
    render(
      <StudioDishesHome
        {...homeProps}
        studioFirstRunDismissed={false}
        dishes={[listedDish()]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Your dishes' })).toBeInTheDocument()
    expect(screen.getByTestId('studio-dishes-grid')).toBeInTheDocument()
    expect(screen.getByLabelText("Don't show this again")).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '+ New dish' }).length).toBeGreaterThanOrEqual(2)
  })

  it('creates a dish and opens its workbench', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ dish: { id: 'd-new' } }),
    })

    render(<StudioDishesHome {...homeProps} dishes={[]} />)

    fireEvent.click(screen.getByRole('button', { name: '+ New dish' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'What is the dish?' }), {
      target: { value: 'Tacos' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/studio/d-new')
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/studio/dishes',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
