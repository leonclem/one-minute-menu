/**
 * Per-dish consecutive billable-failure circuit breaker (Chunk 6).
 *
 * Tracks Nano Banana / Gemini failures that likely incurred provider cost.
 * After N consecutive failures, mutates for that dish are blocked until an
 * admin clears the block.
 */

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import type { StudioDishRecord } from '@/lib/studio/types'

export const DEFAULT_STUDIO_DISH_FAILURE_LIMIT = 5

export class StudioDishBlockedError extends Error {
  code = 'STUDIO_DISH_GENERATION_BLOCKED' as const
  status = 423
  failureCount: number

  constructor(message: string, failureCount: number) {
    super(message)
    this.name = 'StudioDishBlockedError'
    this.failureCount = failureCount
  }
}

/** NanoBanana / provider codes that likely mean a completed (billable) API round-trip. */
const BILLABLE_PROVIDER_CODES = new Set([
  'CONTENT_POLICY_VIOLATION',
  'SAFETY_FILTER_BLOCKED',
  'NO_IMAGE_PRODUCED',
  'GENERATION_FAILED',
  'INVALID_RESPONSE',
  'PARSE_ERROR',
])

/** Codes that are infra / client / auth — do not burn the dish breaker. */
const NON_BILLABLE_PROVIDER_CODES = new Set([
  'RATE_LIMIT_EXCEEDED',
  'AUTHENTICATION_ERROR',
  'SERVICE_UNAVAILABLE',
  'NETWORK_ERROR',
  'TIMEOUT',
])

export function getStudioDishFailureLimit(): number {
  const raw = process.env.STUDIO_DISH_FAILURE_LIMIT
  if (raw === undefined || raw === '') return DEFAULT_STUDIO_DISH_FAILURE_LIMIT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_STUDIO_DISH_FAILURE_LIMIT
  return n
}

/**
 * Classify whether a provider error should increment the dish failure counter.
 * Pure — unit-testable without DB.
 */
export function isBillableProviderFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error && typeof (error as { code: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null
  if (!code) return false
  if (NON_BILLABLE_PROVIDER_CODES.has(code)) return false
  if (BILLABLE_PROVIDER_CODES.has(code)) return true
  // Unknown NanoBananaError-style codes after a model call: treat as billable
  // to be conservative about Google spend (prefer blocking over silent burn).
  return 'name' in error && (error as { name?: string }).name === 'NanoBananaError'
}

export function assertDishNotBlocked(dish: Pick<
  StudioDishRecord,
  'generation_blocked_at' | 'generation_failure_count' | 'name'
>): void {
  if (dish.generation_blocked_at) {
    throw new StudioDishBlockedError(
      `Generations for “${dish.name}” are paused after repeated provider failures. Contact support to unblock.`,
      dish.generation_failure_count ?? 0,
    )
  }
}

export async function recordBillableGenerationFailure(
  userId: string,
  dishId: string,
  errorCode?: string | null,
): Promise<StudioDishRecord> {
  const supabase = createAdminSupabaseClient()
  const limit = getStudioDishFailureLimit()

  const { data: current, error: loadError } = await supabase
    .from('studio_dishes')
    .select('*')
    .eq('user_id', userId)
    .eq('id', dishId)
    .maybeSingle()

  if (loadError || !current) {
    throw new Error(loadError?.message ?? 'Dish not found for failure recording')
  }

  const nextCount = (current.generation_failure_count ?? 0) + 1
  const blocked = nextCount >= limit
  const patch: Record<string, unknown> = {
    generation_failure_count: nextCount,
    updated_at: new Date().toISOString(),
  }

  if (blocked && !current.generation_blocked_at) {
    patch.generation_blocked_at = new Date().toISOString()
    patch.generation_blocked_reason =
      `Blocked after ${nextCount} consecutive billable provider failures` +
      (errorCode ? ` (last: ${errorCode})` : '')
  }

  const { data, error } = await supabase
    .from('studio_dishes')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', dishId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to record generation failure: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioDishRecord
}

export async function recordGenerationSuccess(
  userId: string,
  dishId: string,
): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase
    .from('studio_dishes')
    .update({
      generation_failure_count: 0,
      generation_blocked_at: null,
      generation_blocked_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', dishId)

  if (error) {
    throw new Error(`Failed to reset dish generation failures: ${error.message}`)
  }
}

export async function clearDishGenerationBlock(
  dishId: string,
): Promise<StudioDishRecord> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_dishes')
    .update({
      generation_failure_count: 0,
      generation_blocked_at: null,
      generation_blocked_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dishId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to clear dish generation block: ${error?.message ?? 'unknown'}`)
  }

  return data as StudioDishRecord
}
