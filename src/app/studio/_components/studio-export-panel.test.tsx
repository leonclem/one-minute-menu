import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

import { downloadImage } from '@/lib/studio/client-download'
import { EXPORT_PRESETS } from '@/lib/studio/export-presets'
import type { StudioExportTile } from '@/lib/studio/types'

import { StudioExportPanel } from './studio-export-panel'

jest.mock('@/lib/studio/client-download', () => ({
  downloadImage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./studio-expandable-preview', () => ({
  StudioExpandablePreview: ({ expandLabel }: { expandLabel: string }) => (
    <button type="button">{expandLabel}</button>
  ),
}))

jest.mock('./studio-image-lightbox', () => ({
  StudioImageLightbox: () => null,
}))

function tiles(): StudioExportTile[] {
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
  }))
}

describe('StudioExportPanel', () => {
  beforeEach(() => {
    jest.mocked(downloadImage).mockClear()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tiles: tiles() }),
    }) as jest.Mock
  })

  it('renders a dark list of Make actions instead of a white card grid', async () => {
    const onReadyCountChange = jest.fn()
    render(
      <StudioExportPanel
        sourceImageId="img-1"
        sourceImageLabel="Variant 5"
        creditBalance={10}
        onReadyCountChange={onReadyCountChange}
      />
    )

    expect(await screen.findByText(/Files made from/, { exact: false })).toBeInTheDocument()
    expect(screen.getByText('this')).toBeInTheDocument()
    expect(screen.queryByText(/Export variants/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('studio-export-grid')).not.toBeInTheDocument()

    const list = await screen.findByTestId('studio-export-list')
    expect(list).toBeInTheDocument()
    expect(list.parentElement).toHaveClass('studio-scroll', 'overflow-y-auto')
    expect(list.className).not.toMatch(/grid-cols-2/)
    expect(screen.getByTestId('studio-export-panel').className).not.toMatch(
      /studio-export-context-flash/
    )
    expect(screen.getAllByRole('button', { name: 'Make, free' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Make, 1 cr' })).toBeInTheDocument()
    await waitFor(() => {
      expect(onReadyCountChange).toHaveBeenCalledWith(0)
    })
  })

  it('reports AI export work to the generation stopwatch and ignores a free resize', async () => {
    global.fetch = jest.fn((_input: RequestInfo, init?: RequestInit) => {
      if (init?.method === 'POST') return new Promise(() => undefined)
      return Promise.resolve({
        ok: true,
        json: async () => ({ tiles: tiles() }),
      })
    }) as jest.Mock
    const onAiActiveChange = jest.fn()
    const { unmount } = render(
      <StudioExportPanel
        sourceImageId="img-1"
        creditBalance={10}
        onAiActiveChange={onAiActiveChange}
      />,
    )

    fireEvent.click((await screen.findAllByRole('button', { name: 'Make, free' }))[0])
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/studio/exports',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(onAiActiveChange).not.toHaveBeenCalledWith(true)
    unmount()

    onAiActiveChange.mockClear()
    render(
      <StudioExportPanel
        sourceImageId="img-1"
        creditBalance={10}
        onAiActiveChange={onAiActiveChange}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Make, 1 cr' }))
    await waitFor(() => {
      expect(onAiActiveChange).toHaveBeenCalledWith(true)
    })
  })

  it('shows the current photo ready to download at its own size', async () => {
    const onReadyCountChange = jest.fn()
    render(
      <StudioExportPanel
        sourceImageId="img-1"
        sourceImageLabel="Variant 5"
        dishName="Summer Curry"
        sourcePhoto={{
          url: 'https://cdn.example/shot.jpg',
          width: 1024,
          height: 1536,
          mimeType: 'image/jpeg',
        }}
        creditBalance={10}
        onReadyCountChange={onReadyCountChange}
      />
    )

    const row = await screen.findByTestId('studio-export-tile-as-is')
    expect(row).toHaveTextContent('As-is')
    expect(row).toHaveTextContent('1024 × 1536 · 2:3')
    expect(row).toHaveTextContent('Current photo')
    expect(screen.getByRole('button', { name: 'Expand As-is preview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download As-is' })).toBeEnabled()
    expect(row).not.toHaveTextContent('Make')
    await waitFor(() => {
      expect(onReadyCountChange).toHaveBeenCalledWith(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Download As-is' }))
    await waitFor(() => {
      expect(downloadImage).toHaveBeenCalledWith(
        'https://cdn.example/shot.jpg',
        'summer-curry-as-is-1024x1536.jpg'
      )
    })
  })

  it('uses the export response size when the photo record has none', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tiles: tiles(), source: { width: 1600, height: 900 } }),
    }) as jest.Mock

    render(
      <StudioExportPanel
        sourceImageId="img-1"
        sourcePhoto={{
          url: 'https://cdn.example/shot.jpg',
          width: null,
          height: null,
          mimeType: 'image/jpeg',
        }}
        creditBalance={10}
      />
    )

    const row = await screen.findByTestId('studio-export-tile-as-is')
    expect(await within(row).findByText('1600 × 900 · 16:9')).toBeInTheDocument()
  })

  it('counts the current photo in download all without counting it as a made export', async () => {
    const ready = tiles()
    ready[0] = {
      ...ready[0],
      status: 'ready',
      previewUrl: 'https://cdn.example/square.jpg',
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tiles: ready }),
    }) as jest.Mock
    const onReadyCountChange = jest.fn()

    render(
      <StudioExportPanel
        sourceImageId="img-1"
        sourcePhoto={{
          url: 'https://cdn.example/shot.jpg',
          width: 1024,
          height: 1024,
          mimeType: 'image/png',
        }}
        creditBalance={10}
        onReadyCountChange={onReadyCountChange}
      />
    )

    expect(await screen.findByRole('button', { name: 'Download all (2)' })).toBeInTheDocument()
    await waitFor(() => {
      expect(onReadyCountChange).toHaveBeenCalledWith(1)
    })
  })
})
