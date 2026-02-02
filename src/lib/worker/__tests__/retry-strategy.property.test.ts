/**
 * Property-based tests for retry strategy
 * 
 * These tests verify universal properties of retry logic across all inputs.
 * Each test runs 100 iterations with randomly generated inputs.
 */

import fc from 'fast-check';
import {
  calculateRetryDelay,
  shouldRetryJob,
  handleJobFailure,
  getMaxRetryCount,
  getBaseDelayMs,
  getMaxDelayMs,
} from '../retry-strategy';
import { ErrorCategory } from '../error-classification';

describe('Retry Strategy Property Tests', () => {
  // Feature: railway-workers, Property 7: Retry Logic Correctness
  // Validates: Requirements 2.10, 6.1, 6.2
  describe('Property 7: Retry Logic Correctness', () => {
    it('should retry transient errors when retry count < 3', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          fc.constantFrom(
            'ETIMEDOUT',
            'ECONNREFUSED',
            'connection pool exhausted',
            'Failed to launch browser',
            'upload failed'
          ),
          (retryCount, errorMessage) => {
            const error = new Error(errorMessage);
            const decision = shouldRetryJob(error, retryCount);
            
            // Property: Transient errors with retry_count < 3 should retry
            expect(decision.should_retry).toBe(true);
            expect(decision.is_terminal).toBe(false);
            expect(decision.error_classification.category).toBe(ErrorCategory.TRANSIENT);
            expect(decision.retry_delay_seconds).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not retry transient errors when retry count >= 3', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          fc.constantFrom(
            'ETIMEDOUT',
            'ECONNREFUSED',
            'connection pool exhausted'
          ),
          (retryCount, errorMessage) => {
            const error = new Error(errorMessage);
            const decision = shouldRetryJob(error, retryCount);
            
            // Property: Retry limit reached should result in terminal failure
            expect(decision.should_retry).toBe(false);
            expect(decision.is_terminal).toBe(true);
            expect(decision.retry_delay_seconds).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never retry permanent errors regardless of retry count', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.constantFrom(
            'Menu not found',
            'User not found',
            'HTML too large',
            'Too many images',
            'Invalid export type',
            'malformed HTML'
          ),
          (retryCount, errorMessage) => {
            const error = new Error(errorMessage);
            const decision = shouldRetryJob(error, retryCount);
            
            // Property: Permanent errors should never retry
            expect(decision.should_retry).toBe(false);
            expect(decision.is_terminal).toBe(true);
            expect(decision.error_classification.category).toBe(ErrorCategory.PERMANENT);
            expect(decision.retry_delay_seconds).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should retry resource errors when retry count < 3', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          fc.constantFrom(
            'Out of memory',
            'TimeoutError',
            'ENOSPC',
            'EMFILE'
          ),
          (retryCount, errorMessage) => {
            const error = new Error(errorMessage);
            const decision = shouldRetryJob(error, retryCount);
            
            // Property: Resource errors with retry_count < 3 should retry
            expect(decision.should_retry).toBe(true);
            expect(decision.is_terminal).toBe(false);
            expect(decision.error_classification.category).toBe(ErrorCategory.RESOURCE);
            expect(decision.retry_delay_seconds).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never retry validation errors regardless of retry count', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.constantFrom(
            'Invalid format signature',
            'Output too small',
            'Invalid PDF signature',
            'Invalid PNG signature',
            'corrupted output'
          ),
          (retryCount, errorMessage) => {
            const error = new Error(errorMessage);
            const decision = shouldRetryJob(error, retryCount);
            
            // Property: Validation errors should never retry
            expect(decision.should_retry).toBe(false);
            expect(decision.is_terminal).toBe(true);
            expect(decision.error_classification.category).toBe(ErrorCategory.VALIDATION);
            expect(decision.retry_delay_seconds).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increment retry count for retryable errors', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2 }),
          (initialRetryCount) => {
            const error = new Error('ETIMEDOUT');
            const decision = shouldRetryJob(error, initialRetryCount);
            
            // Property: Retry delay should be calculated for next retry
            // (which will have retry_count = initialRetryCount + 1)
            expect(decision.should_retry).toBe(true);
            expect(decision.retry_delay_seconds).toBeGreaterThan(0);
            
            // Verify delay increases with retry count
            const expectedDelay = calculateRetryDelay(initialRetryCount);
            expect(decision.retry_delay_seconds).toBe(expectedDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide error classification for all errors', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (retryCount, errorMessage) => {
            const error = new Error(errorMessage);
            const decision = shouldRetryJob(error, retryCount);
            
            // Property: All errors should have classification
            expect(decision.error_classification).toBeDefined();
            expect(decision.error_classification.category).toBeDefined();
            expect(decision.error_classification.should_retry).toBeDefined();
            expect(decision.error_classification.user_message).toBeTruthy();
            expect(decision.error_classification.internal_message).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic for same error and retry count', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (retryCount, errorMessage) => {
            const error1 = new Error(errorMessage);
            const error2 = new Error(errorMessage);
            
            const decision1 = shouldRetryJob(error1, retryCount);
            const decision2 = shouldRetryJob(error2, retryCount);
            
            // Property: Same inputs should produce same decision
            expect(decision1.should_retry).toBe(decision2.should_retry);
            expect(decision1.is_terminal).toBe(decision2.is_terminal);
            expect(decision1.retry_delay_seconds).toBe(decision2.retry_delay_seconds);
            expect(decision1.error_classification.category).toBe(decision2.error_classification.category);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: railway-workers, Property 37: Exponential Backoff
  // Validates: Retry delays should increase exponentially (2^n * base)
  describe('Property 37: Exponential Backoff', () => {
    it('should calculate exponential backoff correctly', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (retryCount) => {
            const delay = calculateRetryDelay(retryCount);
            const baseDelaySeconds = getBaseDelayMs() / 1000;
            const maxDelaySeconds = getMaxDelayMs() / 1000;
            
            // Property: Delay should follow exponential formula
            const expectedDelay = Math.min(
              baseDelaySeconds * Math.pow(2, retryCount),
              maxDelaySeconds
            );
            
            expect(delay).toBe(expectedDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should increase delay with each retry', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 8 }),
          (retryCount) => {
            const delay1 = calculateRetryDelay(retryCount);
            const delay2 = calculateRetryDelay(retryCount + 1);
            
            const maxDelaySeconds = getMaxDelayMs() / 1000;
            
            // Property: Delay should increase or stay at max
            if (delay1 < maxDelaySeconds) {
              expect(delay2).toBeGreaterThanOrEqual(delay1);
            } else {
              // Already at max, should stay at max
              expect(delay2).toBe(maxDelaySeconds);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cap delay at maximum', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          (retryCount) => {
            const delay = calculateRetryDelay(retryCount);
            const maxDelaySeconds = getMaxDelayMs() / 1000;
            
            // Property: Delay should never exceed maximum
            expect(delay).toBeLessThanOrEqual(maxDelaySeconds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should start with base delay for first retry', () => {
      const delay = calculateRetryDelay(0);
      const baseDelaySeconds = getBaseDelayMs() / 1000;
      
      // Property: First retry (count=0) should use base delay
      expect(delay).toBe(baseDelaySeconds);
    });

    it('should double delay for each retry until max', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          (retryCount) => {
            const delay1 = calculateRetryDelay(retryCount);
            const delay2 = calculateRetryDelay(retryCount + 1);
            const maxDelaySeconds = getMaxDelayMs() / 1000;
            
            // Property: Each retry should double the delay (until max)
            if (delay1 < maxDelaySeconds && delay2 < maxDelaySeconds) {
              expect(delay2).toBe(delay1 * 2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return positive delay for all retry counts', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),
          (retryCount) => {
            const delay = calculateRetryDelay(retryCount);
            
            // Property: Delay should always be positive
            expect(delay).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic for same retry count', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (retryCount) => {
            const delay1 = calculateRetryDelay(retryCount);
            const delay2 = calculateRetryDelay(retryCount);
            
            // Property: Same retry count should produce same delay
            expect(delay1).toBe(delay2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('handleJobFailure integration', () => {
    it('should provide complete retry decision', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (retryCount, errorMessage) => {
            const error = new Error(errorMessage);
            const decision = handleJobFailure(error, retryCount);
            
            // Property: Decision should have all required fields
            expect(decision).toHaveProperty('should_retry');
            expect(decision).toHaveProperty('retry_delay_seconds');
            expect(decision).toHaveProperty('is_terminal');
            expect(decision).toHaveProperty('error_classification');
            
            // Property: Terminal and retry should be opposites
            expect(decision.is_terminal).toBe(!decision.should_retry);
            
            // Property: Retry delay should be 0 for terminal failures
            if (decision.is_terminal) {
              expect(decision.retry_delay_seconds).toBe(0);
            } else {
              expect(decision.retry_delay_seconds).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect max retry count configuration', async () => {
      await fc.assert(
        fc.property(
          fc.constantFrom('ETIMEDOUT', 'ECONNREFUSED'),
          (errorMessage) => {
            const error = new Error(errorMessage);
            const maxRetries = getMaxRetryCount();
            
            // Test at limit
            const decisionAtLimit = handleJobFailure(error, maxRetries);
            expect(decisionAtLimit.should_retry).toBe(false);
            expect(decisionAtLimit.is_terminal).toBe(true);
            
            // Test below limit
            const decisionBelowLimit = handleJobFailure(error, maxRetries - 1);
            expect(decisionBelowLimit.should_retry).toBe(true);
            expect(decisionBelowLimit.is_terminal).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
