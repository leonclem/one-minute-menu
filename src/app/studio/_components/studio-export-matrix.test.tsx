import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import type { StudioDishExportShot, StudioExportTile, StudioImageRecord } from '@/lib/studio/types'
import { StudioExportMatrix } from './studio-export-matrix'
import { EXPORT_PRESETS } from '@/lib/studio/export-presets'

const mockDownload = jest.fn()
jest.mock('@/lib/studio/client-download', () => ({
  downloadImage: (...args: unknown[]) => mockDownload(...args),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: function MockNextImage({
    fill: _fill,
    sizes: _sizes,
    ...props
  }: Record<string, unknown>) {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
  },
}))

function image(id: string): StudioImageRecord {
  return {
    id,
    dish_id: 'dish-1',
    user_id: 'u1',
    role: 'source',
    source_image_id: null,
    storage_path: `${id}.png`,
    public_url: `https://example.com/${id}.png`,
    mime_type: 'image/png',
    width: 1200,
    height: 1200,
    prompt: null,
    model: null,
    metadata: {},
    is_favourite: false,
    archived_at: null,
    created_at: '2026-08-15T00:00:00.000Z',
  }
}

function tiles(overrides: Partial<Record<string, Partial<StudioExportTile>>> = {}): StudioExportTile[] {
  return EXPORT_PRESETS.map((preset) => ({
    variantType: preset.key,
    label: preset.label,
    hint: preset.hint,
    width: preset.width,
    height: preset.height,
    aspectRatio: preset.aspectRatio,
    fileType: preset.fileType,
    status: 'empty',
    generationMethod: preset.baseMethod,
    estimatedCredits: preset.baseMethod === 'cutout' ? 1 : 0,
    creditsCharged: null,
    previewUrl: null,
    errorMessage: null,
    available: true,
    unavailableReason: null,
    updatedAt: null,
    ...overrides[preset.key],
  }))
}

describe('StudioExportMatrix', () => {
  beforeEach(() => {
    mockDownload.mockReset()
    global.fetch = jest.fn()
  })

  it('posts an export when an empty cell is clicked', async () => {
    const onReplace = jest.fn()
    const nextTiles = tiles({ pdf_menu_tile: { status: 'ready', previewUrl: 'https://cdn.example/x.jpg' } })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ tiles: nextTiles, pending: false }),
    })

    render(
      <StudioExportMatrix
        dishName="Burger"
        images={[image('og')]}
        shots={[{ imageId: 'og', tiles: tiles() }]}
        onReplaceShotTiles={onReplace}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Make Delivery Square' }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/studio/exports',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(onReplace).toHaveBeenCalledWith('og', nextTiles, false)
  })

  it('uses quiet dashed cells and a credit star instead of teal labels', () => {
    render(
      <StudioExportMatrix
        dishName="Burger"
        images={[image('og')]}
        shots={[
          {
            imageId: 'og',
            tiles: tiles({
              delivery_landscape: { estimatedCredits: 1, generationMethod: 'ai_expand' },
            }),
          },
        ]}
        onReplaceShotTiles={jest.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'included' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 credit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make Delivery Square' })).toHaveAttribute(
      'data-state',
      'empty',
    )
    expect(screen.getByRole('button', { name: 'Make Delivery Landscape, 1 credit' })).toHaveAttribute(
      'data-state',
      'credit',
    )
    expect(screen.getByRole('button', { name: 'Make Cut-Out (PNG), 1 credit' })).toHaveAttribute(
      'data-state',
      'credit',
    )
    expect(screen.getByText('1200 × 1200')).toBeInTheDocument()
    expect(screen.getByText('1600 × 900')).toBeInTheDocument()
    expect(screen.getAllByText('free').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1 credit').length).toBeGreaterThan(0)
    expect(screen.getByText('Delivery Square').parentElement).toHaveClass(
      'items-center',
      'text-center',
    )
    expect(screen.getByTestId('studio-export-shot-heading')).toHaveClass('text-white')
    expect(screen.getByTestId('studio-export-cutout-glyph')).toBeInTheDocument()
  })

  it('downloads every ready preview from icon-only yellow buttons', async () => {
    mockDownload.mockResolvedValue(undefined)
    const shots: StudioDishExportShot[] = [
      {
        imageId: 'og',
        tiles: tiles({
          pdf_menu_tile: { status: 'ready', previewUrl: 'https://cdn.example/a.jpg' },
          delivery_square: { status: 'ready', previewUrl: 'https://cdn.example/b.jpg' },
        }),
      },
    ]

    render(
      <StudioExportMatrix
        dishName="Burger"
        images={[image('og')]}
        shots={shots}
        onReplaceShotTiles={jest.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download Delivery Square' })).toHaveAttribute(
      'data-state',
      'ready',
    )

    fireEvent.click(screen.getByRole('button', { name: /Download all ready/ }))
    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledTimes(2)
    })
  })

  it('shows a shot thumbnail that expands in a lightbox', () => {
    render(
      <StudioExportMatrix
        dishName="Burger"
        images={[image('og')]}
        shots={[{ imageId: 'og', tiles: tiles() }]}
        onReplaceShotTiles={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Preview Original' }))
    expect(screen.getByRole('dialog', { name: 'Original preview' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Original' })).toBeInTheDocument()
  })
})
