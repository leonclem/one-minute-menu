/** @jest-environment node */

import { requireAdminApi } from '@/lib/admin-api-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(),
}))

const mockCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient)

function makeSupabaseMock(opts: {
  user: any
  authError?: any
  role?: 'admin' | 'user'
  profileError?: any
}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: opts.user },
        error: opts.authError,
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: opts.role ? { role: opts.role } : null,
        error: opts.profileError,
      }),
    }),
  }
}

describe('requireAdminApi', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(
      makeSupabaseMock({ user: null, authError: null }) as any,
    )

    const result = await requireAdminApi()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it('returns 403 when user is not admin', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'u1' }, role: 'user' }) as any,
    )

    const result = await requireAdminApi()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it('returns ok when user is admin', async () => {
    mockCreateServerSupabaseClient.mockReturnValue(
      makeSupabaseMock({ user: { id: 'u1' }, role: 'admin' }) as any,
    )

    const result = await requireAdminApi()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.id).toBe('u1')
    }
  })
})


