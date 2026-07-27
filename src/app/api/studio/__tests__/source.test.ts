/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockGetStudioDish = jest.fn()
const mockRegister = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/dishes', () => ({
  getStudioDish: (...args: unknown[]) => mockGetStudioDish(...args),
}))

jest.mock('@/lib/studio/persistence', () => ({
  registerStudioSourceImage: (...args: unknown[]) => mockRegister(...args),
  StudioImageLoadError: class StudioImageLoadError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.name = 'StudioImageLoadError'
      this.status = status
    }
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../source/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/studio/source', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetStudioDish.mockResolvedValue({ id: 'dish-1', name: 'Burger' })
    mockRegister.mockResolvedValue({
      id: 'img-1',
      dish_id: 'dish-1',
      public_url: 'https://cdn.example/img-1.png',
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(
      makeRequest({ imageId: 'img-1', dishId: 'dish-1', mimeType: 'image/png' }),
    )
    expect(res.status).toBe(401)
  })

  it('registers a client-uploaded source image', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(
      makeRequest({ imageId: 'img-1', dishId: 'dish-1', mimeType: 'image/png' }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.imageId).toBe('img-1')
    expect(json.imageUrl).toBe('https://cdn.example/img-1.png')
    expect(mockRegister).toHaveBeenCalledWith({
      userId: 'user-1',
      dishId: 'dish-1',
      imageId: 'img-1',
      mimeType: 'image/png',
    })
  })

  it('returns 400 for invalid mimeType', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(
      makeRequest({ imageId: 'img-1', dishId: 'dish-1', mimeType: 'image/gif' }),
    )
    expect(res.status).toBe(400)
  })
})
