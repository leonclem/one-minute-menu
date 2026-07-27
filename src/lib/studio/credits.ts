/**
 * Photo Studio credit balances and ledger (Chunk 6 / Phase 5).
 *
 * Menu `generation_quotas` / `user_packs` are intentionally separate.
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'

export const DEFAULT_STUDIO_CREDIT_COST_NB2 = 1
export const DEFAULT_STUDIO_CREDIT_COST_NB_PRO = 3

export type StudioCreditCosts = {
  nb2: number
  nbPro: number
}

export class StudioCreditsError extends Error {
  code: 'INSUFFICIENT_CREDITS' | 'INVALID_GRANT' | 'CREDITS_RPC_FAILED'
  status: number

  constructor(
    message: string,
    code: StudioCreditsError['code'],
    status = 400,
  ) {
    super(message)
    this.name = 'StudioCreditsError'
    this.code = code
    this.status = status
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return n
}

export function getStudioCreditCosts(): StudioCreditCosts {
  return {
    nb2: parsePositiveInt(
      process.env.STUDIO_CREDIT_COST_NB2,
      DEFAULT_STUDIO_CREDIT_COST_NB2,
    ),
    nbPro: parsePositiveInt(
      process.env.STUDIO_CREDIT_COST_NB_PRO,
      DEFAULT_STUDIO_CREDIT_COST_NB_PRO,
    ),
  }
}

/** Map Gemini / Studio model id → credit cost. */
export function getCreditCostForModel(model: string | null | undefined): number {
  const costs = getStudioCreditCosts()
  const normalized = (model ?? '').toLowerCase()
  if (normalized.includes('pro')) return costs.nbPro
  return costs.nb2
}

export async function getStudioCreditBalance(userId: string): Promise<number> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_credit_balances')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio credit balance: ${error.message}`)
  }

  return typeof data?.balance === 'number' ? data.balance : 0
}

export async function assertCanAffordStudioCredits(
  userId: string,
  cost: number,
): Promise<number> {
  if (cost <= 0) return getStudioCreditBalance(userId)
  const balance = await getStudioCreditBalance(userId)
  if (balance < cost) {
    throw new StudioCreditsError(
      `Insufficient Studio credits (need ${cost}, have ${balance}).`,
      'INSUFFICIENT_CREDITS',
      402,
    )
  }
  return balance
}

type ApplyDeltaRow = { new_balance: number; ledger_id: string }

async function applyCreditDelta(input: {
  userId: string
  delta: number
  reason: string
  refType?: string | null
  refId?: string | null
  createdBy?: string | null
  metadata?: Record<string, unknown>
}): Promise<{ balanceAfter: number; ledgerId: string }> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new StudioCreditsError('Credit delta must be a non-zero integer', 'INVALID_GRANT')
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.rpc('studio_apply_credit_delta', {
    p_user_id: input.userId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_ref_type: input.refType ?? null,
    p_ref_id: input.refId ?? null,
    p_created_by: input.createdBy ?? null,
    p_metadata: input.metadata ?? {},
  })

  if (error) {
    const message = error.message ?? ''
    if (message.includes('INSUFFICIENT_CREDITS')) {
      throw new StudioCreditsError(
        'Insufficient Studio credits.',
        'INSUFFICIENT_CREDITS',
        402,
      )
    }
    throw new StudioCreditsError(
      `Credit update failed: ${message}`,
      'CREDITS_RPC_FAILED',
      500,
    )
  }

  const row = (Array.isArray(data) ? data[0] : data) as ApplyDeltaRow | null
  if (!row || typeof row.new_balance !== 'number' || !row.ledger_id) {
    throw new StudioCreditsError(
      'Credit update returned an unexpected result',
      'CREDITS_RPC_FAILED',
      500,
    )
  }

  return { balanceAfter: row.new_balance, ledgerId: row.ledger_id }
}

export async function debitForStudioGeneration(input: {
  userId: string
  cost: number
  studioImageId: string
  model: string
}): Promise<{ balanceAfter: number; ledgerId: string; cost: number }> {
  if (!Number.isInteger(input.cost) || input.cost <= 0) {
    throw new StudioCreditsError('Generation cost must be a positive integer', 'INVALID_GRANT')
  }

  const result = await applyCreditDelta({
    userId: input.userId,
    delta: -input.cost,
    reason: 'generation_debit',
    refType: 'studio_image',
    refId: input.studioImageId,
    metadata: { model: input.model, cost: input.cost },
  })

  return { ...result, cost: input.cost }
}

export async function creditAdminGrant(input: {
  userId: string
  delta: number
  note: string
  adminUserId: string
}): Promise<{ balanceAfter: number; ledgerId: string }> {
  const note = input.note.trim()
  if (!note) {
    throw new StudioCreditsError('A note is required for admin credit grants', 'INVALID_GRANT')
  }
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new StudioCreditsError(
      'Grant delta must be a non-zero integer',
      'INVALID_GRANT',
    )
  }

  return applyCreditDelta({
    userId: input.userId,
    delta: input.delta,
    reason: 'admin_grant',
    refType: 'admin',
    refId: input.adminUserId,
    createdBy: input.adminUserId,
    metadata: { note },
  })
}

export type StudioCreditLedgerEntry = {
  id: string
  user_id: string
  delta: number
  balance_after: number
  reason: string
  ref_type: string | null
  ref_id: string | null
  created_by: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export async function listStudioCreditLedger(
  userId: string,
  limit = 20,
): Promise<StudioCreditLedgerEntry[]> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_credit_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) {
    throw new Error(`Failed to list studio credit ledger: ${error.message}`)
  }

  return (data ?? []) as StudioCreditLedgerEntry[]
}
