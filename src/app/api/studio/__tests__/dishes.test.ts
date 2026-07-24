/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockListWithThumbs = jest.fn()
const mockEnsure = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/dishes', () => ({
  listStudioDishesWithThumbnails: (...args: unknown[]) => mockListWithThumbs(...args),
  ensureDefaultStudioDish: (...args: unknown[]) => mockEnsure(...args),
  createStudioDish: (...args: unknown[]) => mockCreate(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET, POST } from '../dishes/route'

describe('GET/POST /api/studio/dishes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('ensures a default dish when none exist', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'u1' },
      supabase: {},
    })
    mockListWithThumbs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'd1', name: 'My dishes', current_image_url: null }])
    mockEnsure.mockResolvedValue({ id: 'd1', name: 'My dishes' })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.dishes).toHaveLength(1)
    expect(mockEnsure).toHaveBeenCalled()
  })

  it('creates a dish', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'u1' },
      supabase: {},
    })
    mockCreate.mockResolvedValue({ id: 'd2', name: 'Tacos' })

    const req = new NextRequest('http://localhost/api/studio/dishes', {
      method: 'POST',
      body: JSON.stringify({ name: 'Tacos' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.dish.name).toBe('Tacos')
  })
})
