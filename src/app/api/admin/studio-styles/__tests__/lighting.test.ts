/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireAdminApi = jest.fn()
const mockListAll = jest.fn()
const mockCreate = jest.fn()

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: () => mockRequireAdminApi(),
}))

jest.mock('@/lib/studio/reference-libraries', () => ({
  listAllLightingStyles: () => mockListAll(),
  createLightingStyle: (...args: unknown[]) => mockCreate(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET, POST } from '../lighting/route'

describe('admin studio-styles lighting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 when not admin', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    })

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('lists all styles for admins', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: true,
      user: { id: 'admin-1' },
      supabase: {},
    })
    mockListAll.mockResolvedValue([
      {
        id: '1',
        key: 'low-key',
        name: 'Moody',
        prompt_fragment: 'secret',
        is_active: true,
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.styles[0].prompt_fragment).toBe('secret')
  })

  it('creates a style', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: true,
      user: { id: 'admin-1' },
      supabase: {},
    })
    mockCreate.mockResolvedValue({
      id: 'new',
      key: 'warm-glow',
      name: 'Warm Glow',
      prompt_fragment: 'Warm.',
    })

    const req = new NextRequest('http://localhost/api/admin/studio-styles/lighting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'warm-glow',
        name: 'Warm Glow',
        promptFragment: 'Warm.',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.style.key).toBe('warm-glow')
  })
})
