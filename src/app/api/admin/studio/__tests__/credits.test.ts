/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireAdminApi = jest.fn()
const mockGrant = jest.fn()
const mockBalance = jest.fn()
const mockLedger = jest.fn()

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: () => mockRequireAdminApi(),
}))

jest.mock('@/lib/studio/credits', () => {
  class StudioCreditsError extends Error {
    code: string
    status: number
    constructor(message: string, code: string, status = 400) {
      super(message)
      this.name = 'StudioCreditsError'
      this.code = code
      this.status = status
    }
  }
  return {
    creditAdminGrant: (...args: unknown[]) => mockGrant(...args),
    getStudioCreditBalance: (...args: unknown[]) => mockBalance(...args),
    listStudioCreditLedger: (...args: unknown[]) => mockLedger(...args),
    StudioCreditsError,
  }
})

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { GET, POST } from '../credits/route'

describe('admin studio credits API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET returns 401 when not admin', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET(
      new NextRequest('http://localhost/api/admin/studio/credits?userId=u1'),
    )
    expect(res.status).toBe(401)
  })

  it('GET returns balance and ledger', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: true,
      user: { id: 'admin-1' },
      supabase: {},
    })
    mockBalance.mockResolvedValue(12)
    mockLedger.mockResolvedValue([{ id: 'l1', delta: 12 }])

    const res = await GET(
      new NextRequest('http://localhost/api/admin/studio/credits?userId=u1'),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, balance: 12, ledger: [{ id: 'l1', delta: 12 }] })
  })

  it('POST grants credits', async () => {
    mockRequireAdminApi.mockResolvedValue({
      ok: true,
      user: { id: 'admin-1' },
      supabase: {},
    })
    mockGrant.mockResolvedValue({ balanceAfter: 25, ledgerId: 'led-1' })

    const res = await POST(
      new NextRequest('http://localhost/api/admin/studio/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'u1',
          delta: 25,
          note: 'Private beta',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.balance).toBe(25)
    expect(mockGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        delta: 25,
        adminUserId: 'admin-1',
      }),
    )
  })
})
