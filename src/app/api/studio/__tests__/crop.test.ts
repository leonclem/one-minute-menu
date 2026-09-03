/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockLoadOwnedDishSource = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockPersistStudioImage = jest.fn()
const mockSetStudioDishCurrentImage = jest.fn()
const mockRenderWorkbenchCrop = jest.fn()
const mockDebit = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/owned-source', () => ({
  loadOwnedDishSource: (...args: unknown[]) => mockLoadOwnedDishSource(...args),
  OwnedStudioSourceNotFoundError: class OwnedStudioSourceNotFoundError extends Error {
    status = 404
    constructor() {
      super('Studio source image not found')
      this.name = 'OwnedStudioSourceNotFoundError'
    }
  },
}))

jest.mock('@/lib/studio/image-bytes', () => ({
  loadStudioImageBytes: (...args: unknown[]) => mockLoadStudioImageBytes(...args),
  StudioImageLoadError: class StudioImageLoadError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.name = 'StudioImageLoadError'
      this.status = status
    }
  },
}))

jest.mock('@/lib/studio/persistence', () => ({
  persistStudioImage: (...args: unknown[]) => mockPersistStudioImage(...args),
}))

jest.mock('@/lib/studio/dishes', () => ({
  setStudioDishCurrentImage: (...args: unknown[]) => mockSetStudioDishCurrentImage(...args),
}))

jest.mock('@/lib/studio/crop/render', () => ({
  renderWorkbenchCrop: (...args: unknown[]) => mockRenderWorkbenchCrop(...args),
  StudioCropRenderError: class StudioCropRenderError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status = 400) {
      super(message)
      this.name = 'StudioCropRenderError'
      this.code = code
      this.status = status
    }
  },
}))

jest.mock('@/lib/studio/credits', () => ({
  debitForStudioGeneration: (...args: unknown[]) => mockDebit(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../crop/route'
import { OwnedStudioSourceNotFoundError } from '@/lib/studio/owned-source'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/crop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const parentImage = {
  id: 'parent-1',
  user_id: 'user-1',
  dish_id: 'dish-1',
  role: 'source' as const,
  width: 1600,
  height: 1600,
  metadata: {
    editorState: { schema: { food_components: { main_item: 'soup' } }, position: { x: 0, y: 0 } },
    extractionDiagnostics: { version: 1 },
    objectEdit: { shouldNotCopy: true },
  },
}

const persisted = {
  id: 'crop-1',
  user_id: 'user-1',
  dish_id: 'dish-1',
  role: 'generated',
  source_image_id: 'parent-1',
  public_url: 'https://example.com/crop-1.jpg',
  mime_type: 'image/jpeg',
  metadata: { mode: 'crop' },
}

describe('POST /api/studio/crop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockLoadOwnedDishSource.mockResolvedValue({
      dish: { id: 'dish-1', generation_blocked_at: null },
      image: parentImage,
    })
    mockLoadStudioImageBytes.mockResolvedValue({
      mimeType: 'image/jpeg',
      base64: Buffer.from('jpeg').toString('base64'),
      byteLength: 4,
    })
    mockRenderWorkbenchCrop.mockResolvedValue({
      buffer: Buffer.from('cropped'),
      mimeType: 'image/jpeg',
      width: 1200,
      height: 1200,
    })
    mockPersistStudioImage.mockResolvedValue(persisted)
    mockSetStudioDishCurrentImage.mockResolvedValue({})
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest({ sourceImageId: 'parent-1', dishId: 'dish-1', crop: { x: 0, y: 0, width: 1, height: 1 } }))
    expect(res.status).toBe(401)
    expect(mockPersistStudioImage).not.toHaveBeenCalled()
    expect(mockDebit).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller does not own the image', async () => {
    mockLoadOwnedDishSource.mockRejectedValue(new OwnedStudioSourceNotFoundError())
    const res = await POST(
      makeRequest({
        sourceImageId: 'other',
        dishId: 'dish-1',
        crop: { x: 0, y: 0, width: 1, height: 1 },
      }),
    )
    expect(res.status).toBe(404)
    expect(mockPersistStudioImage).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid rect', async () => {
    const res = await POST(
      makeRequest({
        sourceImageId: 'parent-1',
        dishId: 'dish-1',
        crop: { x: 0.9, y: 0, width: 0.5, height: 1 },
      }),
    )
    expect(res.status).toBe(400)
    expect(mockPersistStudioImage).not.toHaveBeenCalled()
    expect(mockDebit).not.toHaveBeenCalled()
  })

  it('persists a tight crop window', async () => {
    const res = await POST(
      makeRequest({
        sourceImageId: 'parent-1',
        dishId: 'dish-1',
        crop: { x: 0, y: 0, width: 0.1, height: 0.1 },
      }),
    )
    expect(res.status).toBe(200)
    expect(mockPersistStudioImage).toHaveBeenCalledTimes(1)
    expect(mockDebit).not.toHaveBeenCalled()
  })

  it('persists a crop variant with copied editor JSON and does not debit credits', async () => {
    const res = await POST(
      makeRequest({
        sourceImageId: 'parent-1',
        dishId: 'dish-1',
        crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        aspectPreset: '1:1',
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { image: { id: string } }
    expect(body.image.id).toBe('crop-1')
    expect(mockDebit).not.toHaveBeenCalled()
    expect(mockPersistStudioImage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        dishId: 'dish-1',
        role: 'generated',
        sourceImageId: 'parent-1',
        prompt: null,
        model: null,
        metadata: expect.objectContaining({
          mode: 'crop',
          editorState: parentImage.metadata.editorState,
          extractionDiagnostics: parentImage.metadata.extractionDiagnostics,
          crop: expect.objectContaining({ aspectPreset: '1:1' }),
        }),
      }),
    )
    const persistedMeta = mockPersistStudioImage.mock.calls[0][0].metadata as Record<string, unknown>
    expect(persistedMeta).not.toHaveProperty('objectEdit')
    expect(mockSetStudioDishCurrentImage).toHaveBeenCalledWith('user-1', 'dish-1', 'crop-1')
  })
})
