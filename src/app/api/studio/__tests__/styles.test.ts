/**
 * @jest-environment node
 */

const mockRequireStudioApi = jest.fn()
const mockListLighting = jest.fn()
const mockListBackground = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/reference-libraries', () => ({
  listActiveLightingStyles: () => mockListLighting(),
  listActiveBackgroundStyles: () => mockListBackground(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET } from '../styles/route'

describe('GET /api/studio/styles', () => {
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

  it('returns display-only lighting and background styles', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockListLighting.mockResolvedValue([
      {
        id: '1',
        key: 'low-key',
        name: 'Moody',
        short_description: null,
        thumbnail_path: 'light-moody',
        sort_order: 10,
      },
    ])
    mockListBackground.mockResolvedValue([
      {
        id: '2',
        key: 'dark-slate',
        name: 'Dark Slate',
        short_description: null,
        category: 'surface',
        thumbnail_path: 'bg-dark-slate',
        is_premium: false,
        sort_order: 10,
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.lighting[0].key).toBe('low-key')
    expect(json.background[0].key).toBe('dark-slate')
    expect(JSON.stringify(json)).not.toContain('prompt_fragment')
    expect(JSON.stringify(json)).not.toContain('negative_constraints')
  })
})
