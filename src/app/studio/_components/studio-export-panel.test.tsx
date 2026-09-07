import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import { EXPORT_PRESETS } from '@/lib/studio/export-presets'
import type { StudioExportTile } from '@/lib/studio/types'

import { StudioExportPanel } from './studio-export-panel'

jest.mock('./studio-expandable-preview', () => ({
  StudioExpandablePreview: () => <div>preview</div>,
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
      />,
    )

    expect(
      await screen.findByText(/Files made from/, { exact: false }),
    ).toBeInTheDocument()
    expect(screen.getByText('this')).toBeInTheDocument()
    expect(screen.queryByText(/Export variants/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('studio-export-grid')).not.toBeInTheDocument()

    const list = await screen.findByTestId('studio-export-list')
    expect(list).toBeInTheDocument()
    expect(list.className).not.toMatch(/grid-cols-2/)
    expect(screen.getByTestId('studio-export-panel').className).not.toMatch(
      /studio-export-context-flash/,
    )
    expect(screen.getAllByRole('button', { name: 'Make, free' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Make, 1 cr' })).toBeInTheDocument()
    await waitFor(() => {
      expect(onReadyCountChange).toHaveBeenCalledWith(0)
    })
  })
})
