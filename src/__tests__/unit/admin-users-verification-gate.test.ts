import { GET } from '@/app/api/admin/users/route'
import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-utils'

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
  },
}))

jest.mock('@/lib/auth-utils', () => ({
  requireAdmin: jest.fn(),
}))

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: jest.fn(),
}))

type ProfileRow = {
  id: string
  email: string
  role: string
  plan: string
  is_approved: boolean
  approved_at: string | null
  created_at: string
  restaurant_name: string | null
  last_login_at?: string | null
}

function makeProfilesQueryMock(profiles: ProfileRow[]) {
  // Mimic the chained Supabase query interface used in the route.
  return {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: undefined,
    // The route awaits the final chained call, so we return a Promise-like by
    // making the last order() return an object with a `then` compatible method.
    // Simpler: just have the last `order` call be awaited by returning a promise
    // from order() when it’s the 2nd order in the chain.
  }
}

describe('GET /api/admin/users - inbox verification gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireAdmin as jest.Mock).mockResolvedValue(undefined)
  })

  function setupSupabaseMock({
    profiles,
  }: {
    profiles: ProfileRow[]
  }) {
    const profilesQuery: any = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn(),
    }

    // First order() returns this; second order() returns final resolved result
    profilesQuery.order
      .mockReturnValueOnce(profilesQuery)
      .mockResolvedValueOnce({ data: profiles, error: null })

    const supabaseMock: any = {
      from: jest.fn().mockReturnValue(profilesQuery),
    }

    ;(createAdminSupabaseClient as jest.Mock).mockReturnValue(supabaseMock)
    return supabaseMock
  }

  it('excludes pending users before they complete /auth/callback', async () => {
    const pendingId = 'pending-1'
    setupSupabaseMock({
      profiles: [
        {
          id: pendingId,
          email: 'pending@test.com',
          role: 'user',
          plan: 'free',
          is_approved: false,
          approved_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          restaurant_name: null,
          last_login_at: null,
        },
      ],
    })

    const res: any = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(0)
  })

  it('includes pending users after they complete /auth/callback', async () => {
    const pendingId = 'pending-2'
    setupSupabaseMock({
      profiles: [
        {
          id: pendingId,
          email: 'pending2@test.com',
          role: 'user',
          plan: 'free',
          is_approved: false,
          approved_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          restaurant_name: null,
          last_login_at: '2026-01-10T10:01:00.000Z',
        },
      ],
    })

    const res: any = await GET()
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(pendingId)
  })

  it('always includes already-approved users regardless of last sign-in timing', async () => {
    const approvedId = 'approved-1'
    setupSupabaseMock({
      profiles: [
        {
          id: approvedId,
          email: 'approved@test.com',
          role: 'user',
          plan: 'free',
          is_approved: true,
          approved_at: '2026-01-02T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
          restaurant_name: null,
          last_login_at: null,
        },
      ],
    })

    const res: any = await GET()
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(approvedId)
  })
})

