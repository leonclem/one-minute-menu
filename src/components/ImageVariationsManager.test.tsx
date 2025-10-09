import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ImageVariationsManager from './ImageVariationsManager'

// Mock ImageUpload to avoid dealing with real file inputs
jest.mock('@/components/ImageUpload', () => ({ __esModule: true, default: ({ onImageSelected, onCancel }: any) => (
  <div>
    <button onClick={() => onImageSelected(new File(['x'], 'test.png', { type: 'image/png' }))}>Mock Upload</button>
    <button onClick={onCancel}>Cancel</button>
  </div>
) }))

describe('ImageVariationsManager', () => {
  const itemId = '00000000-0000-4000-8000-000000000001'

  beforeEach(() => {
    jest.resetAllMocks()
    // @ts-ignore
    global.fetch = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes(`/api/menu-items/${itemId}/variations`)) {
        return {
          ok: true,
          json: async () => ({ success: true, data: {
            menuItemId: itemId,
            selectedImageId: null,
            variations: [
              { id: 'img1', menuItemId: itemId, originalUrl: 'o1', thumbnailUrl: 't1', mobileUrl: 'm1', desktopUrl: 'd1', prompt: 'p', aspectRatio: '1:1', selected: false, createdAt: new Date().toISOString() },
              { id: 'img2', menuItemId: itemId, originalUrl: 'o2', thumbnailUrl: 't2', mobileUrl: 'm2', desktopUrl: 'd2', prompt: 'p', aspectRatio: '1:1', selected: false, createdAt: new Date().toISOString() },
            ]
          }})
        } as any
      }
      if (url.includes(`/api/menu-items/${itemId}/select-image`) && init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true }) } as any
      }
      if (url.includes('/api/images/img1') && init?.method === 'DELETE') {
        return { ok: true, json: async () => ({ success: true }) } as any
      }
      if (url.includes(`/api/menu-items/${itemId}/image`) && init?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true, data: { imageUrl: 'https://example.com/custom.png' } }) } as any
      }
      return { ok: true, json: async () => ({}) } as any
    })
  })

  it('loads and displays variations', async () => {
    render(<ImageVariationsManager itemId={itemId} onClose={() => {}} />)
    // Wait for the variations list to load, not just the modal chrome
    const useButtons = await screen.findAllByText('Use This')
    expect(useButtons.length).toBeGreaterThanOrEqual(2)
    const delButtons = await screen.findAllByText('Delete')
    expect(delButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('selects an AI image', async () => {
    const { getAllByText } = render(<ImageVariationsManager itemId={itemId} onClose={() => {}} />)
    await waitFor(() => expect(getAllByText('Use This').length).toBeGreaterThan(0))
    fireEvent.click(getAllByText('Use This')[0])
    await waitFor(() => expect((global.fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('/select-image'))).toBe(true))
  })

  it('deletes a variation', async () => {
    render(<ImageVariationsManager itemId={itemId} onClose={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('Delete').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Delete')[0])
    await waitFor(() => expect((global.fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('/api/images/img1'))).toBe(true))
  })

  it('uploads and selects a custom image', async () => {
    render(<ImageVariationsManager itemId={itemId} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Upload Custom')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Upload Custom'))
    // Click mock upload to trigger onImageSelected
    await waitFor(() => expect(screen.getByText('Mock Upload')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Mock Upload'))
    await waitFor(() => expect((global.fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('/select-image'))).toBe(true))
  })
})


