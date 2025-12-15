/** @jest-environment node */

import { GET, POST } from '@/app/api/admin/prompt-presets/route'
import { DELETE } from '@/app/api/admin/prompt-presets/[id]/route'
import { requireAdminApi } from '@/lib/admin-api-auth'

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: jest.fn(),
}))

const mockRequireAdminApi = jest.mocked(requireAdminApi)

function makeSupabaseMock() {
  const chain: any = {}
  chain.select = jest.fn(() => chain)
  chain.order = jest.fn(() => chain)
  chain.limit = jest.fn(async () => ({ data: [], error: null }))
  chain.insert = jest.fn(() => chain)
  chain.single = jest.fn(async () => ({ data: { id: 'p1' }, error: null }))
  chain.delete = jest.fn(() => chain)
  chain.eq = jest.fn(async () => ({ error: null }))

  return {
    from: jest.fn(() => chain),
    __chain: chain,
  }
}

describe('/api/admin/prompt-presets', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('GET returns presets list', async () => {
    const supabase = makeSupabaseMock()
    supabase.__chain.limit = jest.fn(async () => ({
      data: [
        {
          id: 'p1',
          name: 'Test',
          description: null,
          mode: 'style_match',
          scenario_id: null,
          helper_values: { lighting: 'natural_soft' },
          prompt: 'Hello',
          created_at: 'now',
          updated_at: 'now',
        },
      ],
      error: null,
    }))

    mockRequireAdminApi.mockResolvedValueOnce({ ok: true, supabase, user: { id: 'a1' } } as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.presets).toHaveLength(1)
    expect(json.presets[0].name).toBe('Test')
  })

  it('POST validates and inserts', async () => {
    const supabase = makeSupabaseMock()
    mockRequireAdminApi.mockResolvedValueOnce({ ok: true, supabase, user: { id: 'a1' } } as any)

    const req = {
      json: async () => ({
        name: 'Preset 1',
        mode: 'composite',
        scenarioId: null,
        helperValues: { background: 'restaurant_table' },
        prompt: 'My prompt',
      }),
    } as any

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('DELETE removes preset', async () => {
    const supabase = makeSupabaseMock()
    mockRequireAdminApi.mockResolvedValueOnce({ ok: true, supabase, user: { id: 'a1' } } as any)
    const res = await DELETE({} as any, { params: { id: 'p1' } })
    expect(res.status).toBe(200)
  })
})


