import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import type { StudioImageRecord } from '@/lib/studio/types'
import { StudioShotCard } from './studio-shot-card'
import { StudioShotTree } from './studio-shot-tree'

function image(
  overrides: Partial<StudioImageRecord> & Pick<StudioImageRecord, 'id' | 'role'>,
): StudioImageRecord {
  return {
    dish_id: 'dish-1',
    user_id: 'u1',
    storage_path: `${overrides.id}.png`,
    public_url: `https://example.com/${overrides.id}.png`,
    mime_type: 'image/png',
    width: 1024,
    height: 1024,
    prompt: null,
    model: null,
    source_image_id: null,
    metadata: {},
    is_favourite: false,
    archived_at: null,
    created_at: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

const original = image({ id: 'og', role: 'source' })
const child = image({
  id: 'v1',
  role: 'generated',
  source_image_id: 'og',
  created_at: '2026-08-15T01:00:00.000Z',
  metadata: { changeSummary: ['Lighting → Golden Hour'] },
})
const uploadTwo = image({ id: 'og2', role: 'source', created_at: '2026-08-16T00:00:00.000Z' })
const gallery = [original, child, uploadTwo]

describe('StudioShotCard', () => {
  it('links Branch here to the workbench for that shot', () => {
    render(<StudioShotCard dishId="dish-1" image={child} images={gallery} />)
    expect(screen.getByRole('link', { name: 'Branch here' })).toHaveAttribute(
      'href',
      '/studio/dish-1/v1',
    )
    expect(screen.getByText('GEN 1')).toBeInTheDocument()
    expect(screen.getByText('Lighting → Golden Hour')).toBeInTheDocument()
  })

  it('keeps GEN on a lossless reframe and adds a LOSSLESS chip', () => {
    const crop = image({
      id: 'crop',
      role: 'generated',
      source_image_id: 'v1',
      created_at: '2026-08-15T02:00:00.000Z',
      metadata: { mode: 'crop', crop: { aspectPreset: '4:5' } },
    })
    render(<StudioShotCard dishId="dish-1" image={crop} images={[...gallery, crop]} />)
    expect(screen.getByText('GEN 1')).toBeInTheDocument()
    expect(screen.getByText('LOSSLESS')).toBeInTheDocument()
    expect(screen.getByText('Cropped 4:5')).toBeInTheDocument()
  })

  it('reserves a one-line subtitle slot so cards stay the same height', () => {
    render(
      <>
        <StudioShotCard dishId="dish-1" image={original} images={gallery} />
        <StudioShotCard dishId="dish-1" image={child} images={gallery} />
      </>,
    )

    const slots = screen.getAllByTestId('studio-shot-card-subtitle')
    expect(slots).toHaveLength(2)
    expect(slots[0]).toHaveTextContent('Uploaded photo')
    expect(slots[1]).toHaveTextContent('')
    for (const slot of slots) {
      expect(slot).toHaveClass('h-4', 'truncate')
    }
  })
})

describe('StudioShotTree', () => {
  it('renders a branch for each upload root', () => {
    render(
      <StudioShotTree dishId="dish-1" images={gallery} tilesByImageId={new Map()} />,
    )
    expect(screen.getByTestId('studio-shot-tree')).toBeInTheDocument()
    expect(screen.getAllByText('ORIGINAL').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('UPLOAD 2')).toBeInTheDocument()
    expect(screen.getByText('GEN 1')).toBeInTheDocument()
    const thumbs = screen.getAllByTestId('studio-shot-tree-thumb')
    expect(thumbs).toHaveLength(3)
    expect(thumbs[0]).toHaveClass('h-14', 'w-14')
  })
})
