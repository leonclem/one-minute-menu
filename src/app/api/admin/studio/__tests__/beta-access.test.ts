/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireAdminApi = jest.fn()
const mockGrant = jest.fn()
const mockRevoke = jest.fn()
const mockGetAccess = jest.fn()
const mockBalance = jest.fn()

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: () => mockRequireAdminApi(),
}))

jest.mock('@/lib/studio/access/beta-access-store', () => ({
  grantStudioBetaAccess: (...args: unknown[]) => mockGrant(...args),
  revokeStudioBetaAccess: (...args: unknown[]) => mockRevoke(...args),
  getStudioBetaAccess: (...args: unknown[]) => mockGetAccess(...args),
}))

jest.mock('@/lib/studio/credits', () => ({
  getStudioCreditBalance: (...args: unknown[]) => mockBalance(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../beta-access/route'

const ADMIN_ID = '123e4567-e89b-42d3-a456-426614174001'
const USER_ID = '123e4567-e89b-42d3-a456-426614174002'

const grantedAccess = {
  user_id: USER_ID,
  enabled: true,
  granted_by: ADMIN_ID,
  note: 'Private beta cohort',
  granted_at: '2026-01-01T00:00:00.000Z',
  revoked_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const revokedAccess = {
  ...grantedAccess,
  enabled: false,
  note: 'Beta access paused',
  revoked_at: '2026-01-02T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
}

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/studio/beta-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/studio/beta-access', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdminApi.mockResolvedValue({
      ok: true,
      user: { id: ADMIN_ID },
      supabase: {},
    })
    mockBalance.mockResolvedValue(7)
  })

  it('grants beta access for an admin and returns the serialized access and balance', async () => {
    mockGrant.mockResolvedValue(grantedAccess)

    const response = await POST(
      createRequest({
        userId: USER_ID,
        action: 'grant',
        note: 'Private beta cohort',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      access: {
        enabled: true,
        grantedBy: ADMIN_ID,
        grantedAt: grantedAccess.granted_at,
        revokedAt: null,
        note: 'Private beta cohort',
      },
      creditBalance: 7,
    })
    expect(mockGrant).toHaveBeenCalledWith({
      userId: USER_ID,
      adminUserId: ADMIN_ID,
      note: 'Private beta cohort',
    })
    expect(mockRevoke).not.toHaveBeenCalled()
    expect(mockBalance).toHaveBeenCalledWith(USER_ID)
  })

  it('revokes beta access for an admin and returns the serialized access and balance', async () => {
    mockRevoke.mockResolvedValue(revokedAccess)

    const response = await POST(
      createRequest({
        userId: USER_ID,
        action: 'revoke',
        note: 'Beta access paused',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      access: {
        enabled: false,
        grantedBy: ADMIN_ID,
        grantedAt: grantedAccess.granted_at,
        revokedAt: revokedAccess.revoked_at,
        note: 'Beta access paused',
      },
      creditBalance: 7,
    })
    expect(mockRevoke).toHaveBeenCalledWith({
      userId: USER_ID,
      adminUserId: ADMIN_ID,
      note: 'Beta access paused',
    })
    expect(mockGrant).not.toHaveBeenCalled()
    expect(mockBalance).toHaveBeenCalledWith(USER_ID)
  })

  it('returns 403 for a non-admin before validation or any store write', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
      }),
    })

    const response = await POST(
      createRequest({
        userId: USER_ID,
        action: 'grant',
        note: 'x'.repeat(281),
      }),
    )

    expect(response.status).toBe(403)
    expect(mockGrant).not.toHaveBeenCalled()
    expect(mockRevoke).not.toHaveBeenCalled()
    expect(mockGetAccess).not.toHaveBeenCalled()
    expect(mockBalance).not.toHaveBeenCalled()
  })

  it('returns 401 for an unauthenticated request without any store write', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(
      createRequest({
        userId: USER_ID,
        action: 'grant',
        note: 'Private beta cohort',
      }),
    )

    expect(response.status).toBe(401)
    expect(mockGrant).not.toHaveBeenCalled()
    expect(mockRevoke).not.toHaveBeenCalled()
    expect(mockGetAccess).not.toHaveBeenCalled()
    expect(mockBalance).not.toHaveBeenCalled()
  })

  it('returns 400 with NOTE_TOO_LONG before accessing the store', async () => {
    const response = await POST(
      createRequest({
        userId: USER_ID,
        action: 'grant',
        note: 'x'.repeat(281),
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      error: 'Invalid beta access request',
      code: 'NOTE_TOO_LONG',
    })
    expect(mockGrant).not.toHaveBeenCalled()
    expect(mockRevoke).not.toHaveBeenCalled()
    expect(mockGetAccess).not.toHaveBeenCalled()
    expect(mockBalance).not.toHaveBeenCalled()
  })
})
