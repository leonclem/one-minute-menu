/**
 * @jest-environment node
 */

const mockRequireUserApi = jest.fn()
const mockHasStudioBetaAccess = jest.fn()

jest.mock('@/lib/user-api-auth', () => ({
  requireUserApi: () => mockRequireUserApi(),
}))

jest.mock('@/lib/studio/access/beta-access-store', () => ({
  hasStudioBetaAccess: (...args: unknown[]) => mockHasStudioBetaAccess(...args),
}))

type ProfileRole = 'admin' | 'customer'

type TestSupabase = {
  from: jest.Mock
}

function createProfileSupabase(role: ProfileRole): TestSupabase {
  const single = jest.fn().mockResolvedValue({
    data: { role },
    error: null,
  })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  const from = jest.fn().mockReturnValue({ select })
  return { from }
}

function configureEnvironment(mode: string): void {
  process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = 'true'
  process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE = mode
  delete process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY
}

async function loadGate() {
  return import('../studio-api-auth')
}

describe('requireStudioApi', () => {
  const originalEnvironment = {
    enabled: process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO,
    mode: process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE,
    legacyAdminOnly: process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY,
  }

  afterEach(() => {
    if (originalEnvironment.enabled === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO
    } else {
      process.env.NEXT_PUBLIC_ENABLE_PHOTO_STUDIO = originalEnvironment.enabled
    }
    if (originalEnvironment.mode === undefined) {
      delete process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE
    } else {
      process.env.NEXT_PUBLIC_STUDIO_ACCESS_MODE = originalEnvironment.mode
    }
    if (originalEnvironment.legacyAdminOnly === undefined) {
      delete process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY
    } else {
      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = originalEnvironment.legacyAdminOnly
    }
    jest.clearAllMocks()
    jest.resetModules()
  })

  it('returns the unchanged 401 response shape for an unauthenticated caller', async () => {
    configureEnvironment('admin-only')
    const response = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mockRequireUserApi.mockResolvedValue({ ok: false, response })

    const { requireStudioApi } = await loadGate()
    const result = await requireStudioApi()

    expect(result).toEqual({ ok: false, response })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mockRequireUserApi).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['admin-only', 'denied_admin_only'],
    ['beta', 'denied_beta_access_required'],
  ] as const)('returns 403 with the correct reason in %s mode', async (mode, reason) => {
    configureEnvironment(mode)
    const supabase = createProfileSupabase('customer')
    const user = { id: 'customer-1' }
    mockRequireUserApi.mockResolvedValue({ ok: true, user, supabase })
    mockHasStudioBetaAccess.mockResolvedValue(false)

    const { requireStudioApi } = await loadGate()
    const result = await requireStudioApi()

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(403)
    expect(await result.response.json()).toEqual({
      error: 'Forbidden - Studio access required',
      reason,
    })
  })

  it('grants an entitled non-admin in beta mode with the additive success shape', async () => {
    configureEnvironment('beta')
    const supabase = createProfileSupabase('customer')
    const user = { id: 'customer-1' }
    mockRequireUserApi.mockResolvedValue({ ok: true, user, supabase })
    mockHasStudioBetaAccess.mockResolvedValue(true)

    const { requireStudioApi } = await loadGate()
    const result = await requireStudioApi()

    expect(result).toEqual({ ok: true, supabase, user })
  })

  it('grants an authenticated non-admin in open mode with the existing success shape', async () => {
    configureEnvironment('open')
    const supabase = createProfileSupabase('customer')
    const user = { id: 'customer-1' }
    mockRequireUserApi.mockResolvedValue({ ok: true, user, supabase })

    const { requireStudioApi } = await loadGate()
    const result = await requireStudioApi()

    expect(result).toEqual({ ok: true, supabase, user })
  })

  it.each(['admin-only', 'beta', 'open'] as const)(
    'keeps an admin granted with reason granted_admin in %s mode',
    async (mode) => {
      configureEnvironment(mode)
      const supabase = createProfileSupabase('admin')
      const user = { id: 'admin-1' }
      mockRequireUserApi.mockResolvedValue({ ok: true, user, supabase })
      mockHasStudioBetaAccess.mockRejectedValue(new Error('beta lookup unavailable'))

      const { resolveStudioAccess } = await import('../access/studio-access')
      await expect(resolveStudioAccess({ userId: user.id, isAdmin: true })).resolves.toEqual({
        granted: true,
        reason: 'granted_admin',
      })

      const { requireStudioApi } = await loadGate()
      const result = await requireStudioApi()

      expect(result).toEqual({ ok: true, supabase, user })
      // Admins short-circuit before the beta store, preserving Photo Control.
      expect(mockHasStudioBetaAccess).not.toHaveBeenCalled()
    },
  )

  it('returns the same discriminated result contract used by existing /api/studio/* callers', async () => {
    configureEnvironment('admin-only')
    const supabase = createProfileSupabase('customer')
    const user = { id: 'customer-1' }
    mockRequireUserApi.mockResolvedValue({ ok: true, user, supabase })

    const { requireStudioApi } = await loadGate()
    const allowed = await requireStudioApi()

    expect(Object.keys(allowed)).toEqual(['ok', 'response'])
    expect(allowed.ok).toBe(false)
    if (allowed.ok) return
    expect(allowed.response.status).toBe(403)

    mockRequireUserApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const unauthenticated = await requireStudioApi()
    expect(Object.keys(unauthenticated)).toEqual(['ok', 'response'])
    expect(unauthenticated.ok).toBe(false)
    if (unauthenticated.ok) return
    expect(unauthenticated.response.status).toBe(401)
  })
})
