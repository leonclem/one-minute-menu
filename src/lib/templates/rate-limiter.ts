/**
 * Rate Limiting Utility for Template Export Endpoints
 * 
 * Implements simple in-memory rate limiting to prevent abuse of
 * CPU-intensive export operations (PDF, image generation).
 * 
 * For production use, consider:
 * - Redis-based rate limiting for distributed systems
 * - Per-user quotas based on plan limits
 * - Sliding window algorithm for more accurate limiting
 */

import { LayoutEngineError, ERROR_CODES } from './error-logger'

// ============================================================================
// Rate Limit Configuration
// ============================================================================

interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Optional message to return when limit exceeded */
  message?: string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// ============================================================================
// In-Memory Store
// ============================================================================

/**
 * Simple in-memory store for rate limit tracking
 * 
 * Note: This is suitable for single-instance deployments.
 * For multi-instance deployments, use Redis or similar distributed cache.
 */
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key)
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    
    this.store.forEach((entry, key) => {
      if (entry.resetTime < now) {
        keysToDelete.push(key)
      }
    })
    
    keysToDelete.forEach(key => this.store.delete(key))
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

// Global store instance
const globalStore = new RateLimitStore()

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Rate limiter class
 */
export class RateLimiter {
  private config: RateLimitConfig
  private store: RateLimitStore

  constructor(config: RateLimitConfig, store: RateLimitStore = globalStore) {
    this.config = config
    this.store = store
  }

  /**
   * Check if a request should be allowed
   * 
   * @param identifier - Unique identifier for the client (e.g., user ID, IP address)
   * @returns Object with allowed status and remaining requests
   */
  check(identifier: string): {
    allowed: boolean
    remaining: number
    resetTime: number
    retryAfter?: number
  } {
    const now = Date.now()
    const key = this.getKey(identifier)
    const entry = this.store.get(key)

    // No entry or expired entry - allow request
    if (!entry || entry.resetTime < now) {
      const resetTime = now + this.config.windowMs
      this.store.set(key, {
        count: 1,
        resetTime
      })

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime
      }
    }

    // Entry exists and not expired
    if (entry.count < this.config.maxRequests) {
      // Allow request and increment count
      entry.count++
      this.store.set(key, entry)

      return {
        allowed: true,
        remaining: this.config.maxRequests - entry.count,
        resetTime: entry.resetTime
      }
    }

    // Limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000) // seconds
    }
  }

  /**
   * Consume a request (increment counter)
   * Throws error if limit exceeded
   * 
   * @param identifier - Unique identifier for the client
   * @throws {LayoutEngineError} if rate limit exceeded
   */
  consume(identifier: string): void {
    const result = this.check(identifier)

    if (!result.allowed) {
      throw new LayoutEngineError(
        this.config.message || 'Rate limit exceeded. Please try again later.',
        ERROR_CODES.CONCURRENCY_LIMIT,
        {
          retryAfter: result.retryAfter,
          resetTime: new Date(result.resetTime).toISOString()
        }
      )
    }
  }

  /**
   * Reset rate limit for an identifier
   * 
   * @param identifier - Unique identifier for the client
   */
  reset(identifier: string): void {
    const key = this.getKey(identifier)
    this.store.delete(key)
  }

  /**
   * Get rate limit key
   */
  private getKey(identifier: string): string {
    return `ratelimit:${identifier}`
  }
}

// ============================================================================
// Preset Rate Limiters
// ============================================================================

/**
 * Rate limiter for layout generation endpoint
 * Allows 60 requests per minute per user
 */
export const layoutGenerationLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60000, // 1 minute
  message: 'Too many layout generation requests. Please try again in a minute.'
})

/**
 * Rate limiter for HTML export endpoint
 * Allows 30 requests per minute per user
 */
export const htmlExportLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60000, // 1 minute
  message: 'Too many HTML export requests. Please try again in a minute.'
})

/**
 * Rate limiter for PDF export endpoint
 * Allows 10 requests per minute per user (CPU-intensive)
 */
export const pdfExportLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  message: 'Too many PDF export requests. Please try again in a minute.'
})

/**
 * Rate limiter for image export endpoint
 * Allows 10 requests per minute per user (CPU-intensive)
 */
export const imageExportLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  message: 'Too many image export requests. Please try again in a minute.'
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get rate limit headers for HTTP response
 * 
 * @param result - Result from rate limiter check
 * @returns Headers object
 */
export function getRateLimitHeaders(result: {
  remaining: number
  resetTime: number
  retryAfter?: number
}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
  }

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = result.retryAfter.toString()
  }

  return headers
}

/**
 * Apply rate limiting to a request handler
 * 
 * @param limiter - Rate limiter instance
 * @param identifier - Unique identifier for the client
 * @returns Rate limit check result
 */
export function applyRateLimit(
  limiter: RateLimiter,
  identifier: string
): {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
  headers: Record<string, string>
} {
  const result = limiter.check(identifier)
  const headers = getRateLimitHeaders(result)

  return {
    ...result,
    headers
  }
}

// ============================================================================
// Cleanup on Process Exit
// ============================================================================

if (typeof process !== 'undefined') {
  process.on('exit', () => {
    globalStore.destroy()
  })
}

