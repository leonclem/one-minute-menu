/**
 * @jest-environment node
 */

const mockRequireAdminApi = jest.fn()
const mockRequireUserApi = jest.fn()

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: () => mockRequireAdminApi(),
}))

jest.mock('@/lib/user-api-auth', () => ({
  requireUserApi: () => mockRequireUserApi(),
}))

describe('requireStudioApi', () => {
  const original = process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY
    } else {
      process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = original
    }
    jest.clearAllMocks()
    jest.resetModules()
  })

  it('uses requireAdminApi when admin-only (default)', async () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY
    mockRequireAdminApi.mockResolvedValue({
      ok: true,
      user: { id: 'admin-1' },
      supabase: {},
    })
    const { requireStudioApi } = await import('../studio-api-auth')
    const result = await requireStudioApi()
    expect(result.ok).toBe(true)
    expect(mockRequireAdminApi).toHaveBeenCalled()
    expect(mockRequireUserApi).not.toHaveBeenCalled()
  })

  it('uses requireUserApi when admin-only is false', async () => {
    process.env.NEXT_PUBLIC_STUDIO_ADMIN_ONLY = 'false'
    mockRequireUserApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    const { requireStudioApi } = await import('../studio-api-auth')
    const result = await requireStudioApi()
    expect(result.ok).toBe(true)
    expect(mockRequireUserApi).toHaveBeenCalled()
    expect(mockRequireAdminApi).not.toHaveBeenCalled()
  })
})
