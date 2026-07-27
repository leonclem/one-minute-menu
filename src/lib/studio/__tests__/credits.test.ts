/**
 * @jest-environment node
 */

const mockMaybeSingle = jest.fn()
const mockRpc = jest.fn()
const mockLedgerLimit = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'studio_credit_balances') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => mockMaybeSingle(),
            }),
          }),
        }
      }
      if (table === 'studio_credit_ledger') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: (...args: unknown[]) => mockLedgerLimit(...args),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))

import {
  assertCanAffordStudioCredits,
  creditAdminGrant,
  debitForStudioGeneration,
  getCreditCostForModel,
  getStudioCreditBalance,
  getStudioCreditCosts,
  StudioCreditsError,
} from '../credits'

describe('studio credits', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.STUDIO_CREDIT_COST_NB2
    delete process.env.STUDIO_CREDIT_COST_NB_PRO
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('uses default costs 1 / 3 and maps models', () => {
    expect(getStudioCreditCosts()).toEqual({ nb2: 1, nbPro: 3 })
    expect(getCreditCostForModel('gemini-3.1-flash-image-preview')).toBe(1)
    expect(getCreditCostForModel('gemini-3-pro-image')).toBe(3)
  })

  it('reads cost overrides from env', () => {
    process.env.STUDIO_CREDIT_COST_NB2 = '2'
    process.env.STUDIO_CREDIT_COST_NB_PRO = '5'
    expect(getStudioCreditCosts()).toEqual({ nb2: 2, nbPro: 5 })
  })

  it('getStudioCreditBalance returns 0 when no row', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(getStudioCreditBalance('user-1')).resolves.toBe(0)
  })

  it('assertCanAfford throws 402 when broke', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { balance: 0 }, error: null })
    await expect(assertCanAffordStudioCredits('user-1', 1)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      status: 402,
    })
  })

  it('debitForStudioGeneration calls RPC with negative delta', async () => {
    mockRpc.mockResolvedValue({
      data: [{ new_balance: 4, ledger_id: 'led-1' }],
      error: null,
    })

    const result = await debitForStudioGeneration({
      userId: 'user-1',
      cost: 1,
      studioImageId: 'img-1',
      model: 'gemini-3.1-flash-image-preview',
    })

    expect(result).toEqual({ balanceAfter: 4, ledgerId: 'led-1', cost: 1 })
    expect(mockRpc).toHaveBeenCalledWith(
      'studio_apply_credit_delta',
      expect.objectContaining({
        p_user_id: 'user-1',
        p_delta: -1,
        p_reason: 'generation_debit',
        p_ref_id: 'img-1',
      }),
    )
  })

  it('debit maps INSUFFICIENT_CREDITS from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'INSUFFICIENT_CREDITS' },
    })

    await expect(
      debitForStudioGeneration({
        userId: 'user-1',
        cost: 1,
        studioImageId: 'img-1',
        model: 'flash',
      }),
    ).rejects.toBeInstanceOf(StudioCreditsError)
  })

  it('creditAdminGrant requires note and non-zero delta', async () => {
    await expect(
      creditAdminGrant({
        userId: 'user-1',
        delta: 10,
        note: '   ',
        adminUserId: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_GRANT' })

    mockRpc.mockResolvedValue({
      data: [{ new_balance: 10, ledger_id: 'led-2' }],
      error: null,
    })

    await expect(
      creditAdminGrant({
        userId: 'user-1',
        delta: 10,
        note: 'Private beta invite',
        adminUserId: 'admin-1',
      }),
    ).resolves.toEqual({ balanceAfter: 10, ledgerId: 'led-2' })
  })
})
