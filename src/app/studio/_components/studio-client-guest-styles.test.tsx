import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import type { StudioDishRecord, StudioImageRecord } from '@/lib/studio/types'

import { StudioCreditsProvider } from './studio-credits-context'
import { StudioClient } from './studio-client'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
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

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => '',
  }
}

describe('StudioClient guest styles', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/studio/styles')) {
        return jsonResponse({
          lighting: [
            {
              id: 'light-1',
              key: 'bright-clean',
              name: 'Bright & Clean',
              short_description: null,
              thumbnail_path: null,
              sort_order: 1,
            },
          ],
          background: [
            {
              id: 'surface-1',
              key: 'natural-oak',
              name: 'Natural Oak',
              short_description: null,
              category: 'surface',
              thumbnail_path: 'surfaces/surface-natural-oak.jpg',
              is_premium: false,
              sort_order: 1,
            },
            {
              id: 'backdrop-1',
              key: 'soft-neutral',
              name: 'Soft Neutral',
              short_description: null,
              category: 'backdrop',
              thumbnail_path: null,
              is_premium: false,
              sort_order: 1,
            },
          ],
        })
      }
      if (url.includes('/api/studio/images/') && init?.method === 'PATCH') {
        return jsonResponse({ image: original })
      }
      return jsonResponse({ balance: 0, costs: { nb2: 1, nbPro: 2 } })
    }) as jest.Mock
  })

  it('loads surface tiles for a guest session', async () => {
    render(
      <StudioCreditsProvider initialBalance={0}>
        <StudioClient
          isGuest
          initialDishes={[dish]}
          initialGallery={[original]}
          initialActiveDishId={dish.id}
        />
      </StudioCreditsProvider>,
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/studio/styles')
    })

    fireEvent.click(await screen.findByTestId('studio-scene-section-surface'))

    expect(await screen.findByRole('radio', { name: 'Natural Oak' })).toBeInTheDocument()
    expect(screen.queryByText('No surfaces available yet.')).not.toBeInTheDocument()
  })
})
