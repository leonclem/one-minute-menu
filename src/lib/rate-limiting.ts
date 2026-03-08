/**
 * Database-Backed Rate Limiting Service
 *
 * Persists rate limit state in PostgreSQL so limits survive server restarts,
 * cold starts, and work correctly in serverless / multi-instance environments.
 *
 * Replaces in-memory rate limiting for production-critical endpoints.
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { UserPlan } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: Date
  retryAfterSeconds?: number
}

export interface RateLimitConfig {
  /** Max requests allowed within the window */
  maxRequests: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Optional cooldown in ms applied once the limit is hit */
  cooldownMs?: number
}

// ---------------------------------------------------------------------------
// Per-plan rate limit configurations
// ---------------------------------------------------------------------------

const IMAGE_GENERATION_LIMITS: Record<UserPlan, RateLimitConfig> = {
  free:               { maxRequests: 5,  windowMs: 60_000 },
  grid_plus:          { maxRequests: 15, windowMs: 60_000 },
  grid_plus_premium:  { maxRequests: 30, windowMs: 60_000 },
  premium:            { maxRequests: 15, windowMs: 60_000 },
  enterprise:         { maxRequests: 30, windowMs: 60_000 },
}

const EXPORT_LIMITS: Record<UserPlan, RateLimitConfig> = {
  free:               { maxRequests: 3,  windowMs: 60_000, cooldownMs: 5 * 60_000 },
  grid_plus:          { maxRequests: 10, windowMs: 60_000, cooldownMs: 60_000 },
  grid_plus_premium:  { maxRequests: 20, windowMs: 60_000, cooldownMs: 30_000 },
  premium:            { maxRequests: 10, windowMs: 60_000, cooldownMs: 60_000 },
  enterprise:         { maxRequests: 20, windowMs: 60_000, cooldownMs: 30_000 },
}

/** Batch generation limits returned to the client */
export interface BatchLimits {
  maxBatchSize: number
  delayMs: number
}

const BATCH_LIMITS: Record<UserPlan, BatchLimits> = {
  free:               { maxBatchSize: 5,  delayMs: 3000 },
  grid_plus:          { maxBatchSize: 15, delayMs: 1000 },
  grid_plus_premium:  { maxBatchSize: 20, delayMs: 500 },
  premium:            { maxBatchSize: 15, delayMs: 1000 },
  enterprise:         { maxBatchSize: 20, delayMs: 500 },
}

// ---------------------------------------------------------------------------
// Public helpers to retrieve configs
// ---------------------------------------------------------------------------

export function getImageGenerationLimits(plan: UserPlan): RateLimitConfig {
  return IMAGE_GENERATION_LIMITS[plan] ?? IMAGE_GENERATION_LIMITS.free
}

export function getExportLimits(plan: UserPlan): RateLimitConfig {
  return EXPORT_LIMITS[plan] ?? EXPORT_LIMITS.free
}

export function getBatchLimits(plan: UserPlan): BatchLimits {
  return BATCH_LIMITS[plan] ?? BATCH_LIMITS.free
}

// ---------------------------------------------------------------------------
// Core rate-limit check (database-backed)
// ---------------------------------------------------------------------------

/**
 * Check (and increment) a rate limit for a given user + action.
 *
 * Algorithm:
 * 1. Look for an existing window that hasn't expired yet.
 * 2. If found and under limit → increment count.
 * 3. If found and at/over limit → deny (return cooldown info).
 * 4. If no active window → create a new one with count = 1.
 */
export async function checkRateLimit(
  userId: string,
  actionType: string,
  plan: UserPlan,
  configOverride?: RateLimitConfig,
): Promise<RateLimitResult> {
  const config = configOverride
    ?? (actionType === 'image_generation' ? getImageGenerationLimits(plan) : getExportLimits(plan))

  const supabase = createServerSupabaseClient()
  const now = new Date()

  // 1. Find active window
  const { data: existing, error: fetchErr } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .gt('window_end', now.toISOString())
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchErr) {
    // Fail open – don't block the user if the DB query fails
    console.error('[RateLimit] DB fetch error, failing open:', fetchErr)
    return {
      allowed: true,
      remaining: config.maxRequests,
      limit: config.maxRequests,
      resetAt: new Date(now.getTime() + config.windowMs),
    }
  }

  // 2. Active window exists
  if (existing) {
    const windowEnd = new Date(existing.window_end)

    if (existing.request_count >= config.maxRequests) {
      // Over limit – calculate retry time (use cooldown if configured)
      const cooldownEnd = config.cooldownMs
        ? new Date(Math.max(windowEnd.getTime(), now.getTime() + config.cooldownMs))
        : windowEnd
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000))

      return {
        allowed: false,
        remaining: 0,
        limit: config.maxRequests,
        resetAt: cooldownEnd,
        retryAfterSeconds,
      }
    }

    // Under limit – increment
    const { error: updateErr } = await supabase
      .from('rate_limits')
      .update({ request_count: existing.request_count + 1 })
      .eq('id', existing.id)

    if (updateErr) {
      console.error('[RateLimit] DB update error, failing open:', updateErr)
    }

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - existing.request_count - 1),
      limit: config.maxRequests,
      resetAt: windowEnd,
    }
  }

  // 3. No active window – create one
  const windowEnd = new Date(now.getTime() + config.windowMs)

  const { error: insertErr } = await supabase
    .from('rate_limits')
    .insert({
      user_id: userId,
      action_type: actionType,
      request_count: 1,
      window_start: now.toISOString(),
      window_end: windowEnd.toISOString(),
    })

  if (insertErr) {
    console.error('[RateLimit] DB insert error, failing open:', insertErr)
  }

  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    limit: config.maxRequests,
    resetAt: windowEnd,
  }
}
