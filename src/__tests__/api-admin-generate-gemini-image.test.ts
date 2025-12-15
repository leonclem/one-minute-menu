/** @jest-environment node */

import { POST } from '@/app/api/admin/generate-gemini-image/route'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { getNanoBananaClient } from '@/lib/nano-banana'

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: jest.fn(),
}))

jest.mock('@/lib/nano-banana', () => ({
  getNanoBananaClient: jest.fn(),
  NanoBananaError: class NanoBananaError extends Error {
    code: string
    retryAfter?: number
    filterReason?: string
    suggestions?: string[]
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

const mockRequireAdminApi = jest.mocked(requireAdminApi)
const mockGetNanoBananaClient = jest.mocked(getNanoBananaClient)

describe('POST /api/admin/generate-gemini-image', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.NANO_BANANA_API_KEY = 'test'
  })

  afterEach(() => {
    delete process.env.NANO_BANANA_API_KEY
  })

  it('returns 401/403 when requireAdminApi fails', async () => {
    mockRequireAdminApi.mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) as any,
    })

    const req = { json: async () => ({ prompt: 'x' }) } as any
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns data URLs for generated images', async () => {
    mockRequireAdminApi.mockResolvedValueOnce({ ok: true, supabase: {}, user: { id: 'a1' } } as any)
    const generateImage = jest.fn().mockResolvedValueOnce({
        images: ['abc123', 'def456'],
        metadata: { processingTime: 1, modelVersion: 'gemini-2.5-flash-image' },
    })
    mockGetNanoBananaClient.mockReturnValueOnce({ generateImage } as any)

    const req = {
      json: async () => ({
        prompt: 'A salad on a plate',
        aspectRatio: '1:1',
        numberOfImages: 2,
      }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.imageUrl).toContain('data:image/png;base64,')
    expect(data.images).toHaveLength(2)
    expect(data.images[0]).toBe('data:image/png;base64,abc123')
  })

  it('passes reference image and mode through to NanoBananaClient when provided', async () => {
    mockRequireAdminApi.mockResolvedValueOnce({ ok: true, supabase: {}, user: { id: 'a1' } } as any)
    const generateImage = jest.fn().mockResolvedValueOnce({
      images: ['abc123'],
      metadata: { processingTime: 1, modelVersion: 'gemini-2.5-flash-image' },
    })
    mockGetNanoBananaClient.mockReturnValueOnce({ generateImage } as any)

    const req = {
      json: async () => ({
        prompt: 'A pasta dish',
        aspectRatio: '1:1',
        numberOfImages: 1,
        referenceMode: 'style_match',
        referenceImages: [{ dataUrl: 'data:image/png;base64,QUJD', role: 'dish', name: 'dish.png' }], // "ABC"
      }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_mode: 'style_match',
        reference_images: [{ mimeType: 'image/png', data: 'QUJD', role: 'dish' }],
      }),
    )
  })

  it('supports multiple reference images (up to 3)', async () => {
    mockRequireAdminApi.mockResolvedValueOnce({ ok: true, supabase: {}, user: { id: 'a1' } } as any)
    const generateImage = jest.fn().mockResolvedValueOnce({
      images: ['abc123'],
      metadata: { processingTime: 1, modelVersion: 'gemini-2.5-flash-image' },
    })
    mockGetNanoBananaClient.mockReturnValueOnce({ generateImage } as any)

    const req = {
      json: async () => ({
        prompt: 'Compose dish from one image onto the table from another',
        aspectRatio: '1:1',
        numberOfImages: 1,
        referenceMode: 'composite',
        referenceImages: [
          { dataUrl: 'data:image/png;base64,QUJD', role: 'dish', name: 'dish.png' },
          { dataUrl: 'data:image/jpeg;base64,QUJD', role: 'scene', name: 'table.jpg' },
        ],
      }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_mode: 'composite',
        reference_images: [
          { mimeType: 'image/png', data: 'QUJD', role: 'dish' },
          { mimeType: 'image/jpeg', data: 'QUJD', role: 'scene' },
        ],
      }),
    )
  })
})


