/**
 * Rate Limiting for Stripe Payment Endpoints
 * 
 * Implements rate limiting for checkout session creation and webhook processing
 * to prevent abuse and protect against DoS attacks.
 * 
 * Requirements: 10.5, 14.3
 */
 
import { RateLimiter, cleanupGlobalStore } from '@/lib/templates/rate-limiter'
 
/**
 * Rate limiter for checkout session creation
 * Allows 10 requests per 5 minutes per user
 * 
 * Validates: Requirements 10.5
 */
export const checkoutRateLimiter = new RateLimiter({
  prefix: 'stripe_checkout',
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
  message: 'Too many checkout requests. Please try again in a few minutes.',
})
 
/**
 * Rate limiter for webhook endpoint
 * Allows 100 requests per minute per IP address
 * 
 * Validates: Requirements 14.3
 */
export const webhookRateLimiter = new RateLimiter({
  prefix: 'stripe_webhook',
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many webhook requests. Please slow down.',
})

/**
 * Cleanup function for rate limiters
 * Used in tests to properly cleanup intervals and prevent Jest from hanging
 */
export function cleanupRateLimiters(): void {
  cleanupGlobalStore()
}
