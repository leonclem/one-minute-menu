/**
 * Tests for Rate Limiter
 */

import {
  RateLimiter,
  layoutGenerationLimiter,
  htmlExportLimiter,
  pdfExportLimiter,
  imageExportLimiter,
  getRateLimitHeaders,
  applyRateLimit
} from '../rate-limiter'
import { LayoutEngineError, ERROR_CODES } from '../error-logger'

// Enable rate limiting enforcement for these tests
const originalEnforceRateLimiting = process.env.ENFORCE_RATE_LIMITING_IN_TESTS

beforeAll(() => {
  process.env.ENFORCE_RATE_LIMITING_IN_TESTS = 'true'
})

afterAll(() => {
  if (originalEnforceRateLimiting === undefined) {
    delete process.env.ENFORCE_RATE_LIMITING_IN_TESTS
  } else {
    process.env.ENFORCE_RATE_LIMITING_IN_TESTS = originalEnforceRateLimiting
  }
})

describe('RateLimiter', () => {
  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 60000
      })

      const result1 = limiter.check('user1')
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(4)

      const result2 = limiter.check('user1')
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(3)
    })

    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter({
        maxRequests: 3,
        windowMs: 60000
      })

      // Use up all requests
      limiter.check('user2')
      limiter.check('user2')
      limiter.check('user2')

      // Next request should be blocked
      const result = limiter.check('user2')
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it('should track different users independently', () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60000
      })

      // User A uses up their limit
      limiter.check('userA')
      limiter.check('userA')
      const result1 = limiter.check('userA')
      expect(result1.allowed).toBe(false)

      // User B should still be allowed
      const result2 = limiter.check('userB')
      expect(result2.allowed).toBe(true)
    })

    it('should reset after window expires', async () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 100 // 100ms window for testing
      })

      // Use up limit
      limiter.check('user3')
      limiter.check('user3')
      const result1 = limiter.check('user3')
      expect(result1.allowed).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should be allowed again
      const result2 = limiter.check('user3')
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(1)
    })
  })

  describe('consume() method', () => {
    it('should not throw when within limit', () => {
      const limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 60000
      })

      expect(() => limiter.consume('user4')).not.toThrow()
    })

    it('should throw LayoutEngineError when limit exceeded', () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60000,
        message: 'Custom error message'
      })

      limiter.consume('user5')
      limiter.consume('user5')

      expect(() => limiter.consume('user5')).toThrow(LayoutEngineError)
      expect(() => limiter.consume('user5')).toThrow('Custom error message')
    })

    it('should include retry information in error', () => {
      const limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60000
      })

      limiter.consume('user6')

      try {
        limiter.consume('user6')
        fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeInstanceOf(LayoutEngineError)
        const layoutError = error as LayoutEngineError
        expect(layoutError.code).toBe(ERROR_CODES.CONCURRENCY_LIMIT)
        expect(layoutError.details).toHaveProperty('retryAfter')
        expect(layoutError.details).toHaveProperty('resetTime')
      }
    })
  })

  describe('reset() method', () => {
    it('should reset rate limit for user', () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60000
      })

      // Use up limit
      limiter.check('user7')
      limiter.check('user7')
      const result1 = limiter.check('user7')
      expect(result1.allowed).toBe(false)

      // Reset
      limiter.reset('user7')

      // Should be allowed again
      const result2 = limiter.check('user7')
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(1)
    })
  })

  describe('Preset Rate Limiters', () => {
    it('should have layout generation limiter configured', () => {
      expect(layoutGenerationLimiter).toBeInstanceOf(RateLimiter)

      // Should allow multiple requests
      const result = layoutGenerationLimiter.check('test-user-1')
      expect(result.allowed).toBe(true)

      // Clean up
      layoutGenerationLimiter.reset('test-user-1')
    })

    it('should have HTML export limiter configured', () => {
      expect(htmlExportLimiter).toBeInstanceOf(RateLimiter)

      const result = htmlExportLimiter.check('test-user-2')
      expect(result.allowed).toBe(true)

      // Clean up
      htmlExportLimiter.reset('test-user-2')
    })

    it('should have PDF export limiter configured', () => {
      expect(pdfExportLimiter).toBeInstanceOf(RateLimiter)

      const result = pdfExportLimiter.check('test-user-3')
      expect(result.allowed).toBe(true)

      // Clean up
      pdfExportLimiter.reset('test-user-3')
    })

    it('should have image export limiter configured', () => {
      expect(imageExportLimiter).toBeInstanceOf(RateLimiter)

      const result = imageExportLimiter.check('test-user-4')
      expect(result.allowed).toBe(true)

      // Clean up
      imageExportLimiter.reset('test-user-4')
    })

    it('should have stricter limits for CPU-intensive operations', () => {
      // PDF and image exports should have lower limits than HTML
      const htmlResult = htmlExportLimiter.check('test-user-5')
      const pdfResult = pdfExportLimiter.check('test-user-6')
      const imageResult = imageExportLimiter.check('test-user-7')

      // All should be allowed initially
      expect(htmlResult.allowed).toBe(true)
      expect(pdfResult.allowed).toBe(true)
      expect(imageResult.allowed).toBe(true)

      // HTML should have more remaining requests
      expect(htmlResult.remaining).toBeGreaterThan(pdfResult.remaining)
      expect(htmlResult.remaining).toBeGreaterThan(imageResult.remaining)

      // Clean up
      htmlExportLimiter.reset('test-user-5')
      pdfExportLimiter.reset('test-user-6')
      imageExportLimiter.reset('test-user-7')
    })
  })

  describe('Helper Functions', () => {
    describe('getRateLimitHeaders()', () => {
      it('should return standard rate limit headers', () => {
        const result = {
          remaining: 5,
          resetTime: Date.now() + 60000
        }

        const headers = getRateLimitHeaders(result)

        expect(headers).toHaveProperty('X-RateLimit-Remaining', '5')
        expect(headers).toHaveProperty('X-RateLimit-Reset')
      })

      it('should include Retry-After header when provided', () => {
        const result = {
          remaining: 0,
          resetTime: Date.now() + 60000,
          retryAfter: 60
        }

        const headers = getRateLimitHeaders(result)

        expect(headers).toHaveProperty('Retry-After', '60')
      })
    })

    describe('applyRateLimit()', () => {
      it('should return result with headers', () => {
        const limiter = new RateLimiter({
          maxRequests: 10,
          windowMs: 60000
        })

        const result = applyRateLimit(limiter, 'user8')

        expect(result).toHaveProperty('allowed', true)
        expect(result).toHaveProperty('remaining')
        expect(result).toHaveProperty('resetTime')
        expect(result).toHaveProperty('headers')
        expect(result.headers).toHaveProperty('X-RateLimit-Remaining')
        expect(result.headers).toHaveProperty('X-RateLimit-Reset')

        // Clean up
        limiter.reset('user8')
      })

      it('should include retryAfter when limit exceeded', () => {
        const limiter = new RateLimiter({
          maxRequests: 1,
          windowMs: 60000
        })

        // Use up limit
        applyRateLimit(limiter, 'user9')

        // Next request should be blocked
        const result = applyRateLimit(limiter, 'user9')

        expect(result.allowed).toBe(false)
        expect(result.retryAfter).toBeGreaterThan(0)
        expect(result.headers).toHaveProperty('Retry-After')

        // Clean up
        limiter.reset('user9')
      })

      it('should log warning when rate limit exceeded', () => {
        const limiter = new RateLimiter({
          maxRequests: 1,
          windowMs: 60000
        })

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

        // Use up limit
        applyRateLimit(limiter, 'user10')

        // Next request should log warning
        applyRateLimit(limiter, 'user10')

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[RateLimiter] Rate limit exceeded',
          expect.objectContaining({
            identifier: 'user10',
            retryAfter: expect.any(Number),
            resetTime: expect.any(String),
            timestamp: expect.any(String)
          })
        )

        consoleWarnSpy.mockRestore()
        limiter.reset('user10')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent requests correctly', () => {
      const limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 60000
      })

      // Simulate concurrent requests
      const results = Array.from({ length: 10 }, () =>
        limiter.check('concurrent-user')
      )

      // First 5 should be allowed
      expect(results.slice(0, 5).every(r => r.allowed)).toBe(true)

      // Remaining should be blocked
      expect(results.slice(5).every(r => !r.allowed)).toBe(true)

      // Clean up
      limiter.reset('concurrent-user')
    })

    it('should handle empty identifier', () => {
      const limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 60000
      })

      const result = limiter.check('')
      expect(result.allowed).toBe(true)

      // Clean up
      limiter.reset('')
    })

    it('should handle very short time windows', async () => {
      const limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 50 // 50ms
      })

      limiter.check('short-window-user')
      limiter.check('short-window-user')

      const result1 = limiter.check('short-window-user')
      expect(result1.allowed).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60))

      const result2 = limiter.check('short-window-user')
      expect(result2.allowed).toBe(true)

      // Clean up
      limiter.reset('short-window-user')
    })

    it('should handle very large request limits', () => {
      const limiter = new RateLimiter({
        maxRequests: 1000,
        windowMs: 60000
      })

      // Make many requests
      for (let i = 0; i < 100; i++) {
        const result = limiter.check('large-limit-user')
        expect(result.allowed).toBe(true)
      }

      // Clean up
      limiter.reset('large-limit-user')
    })
  })

  describe('Logging', () => {
    it('should log rate limit violations in consume()', () => {
      const limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60000,
        message: 'Test limit exceeded'
      })

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      limiter.consume('log-test-user')

      try {
        limiter.consume('log-test-user')
      } catch (error) {
        // Expected error
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[RateLimiter] Rate limit exceeded',
        expect.objectContaining({
          identifier: 'log-test-user',
          maxRequests: 1,
          windowMs: 60000,
          retryAfter: expect.any(Number),
          resetTime: expect.any(String),
          timestamp: expect.any(String)
        })
      )

      consoleWarnSpy.mockRestore()
      limiter.reset('log-test-user')
    })
  })
})
