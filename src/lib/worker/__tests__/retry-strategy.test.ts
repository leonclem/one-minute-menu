/**
 * Unit Tests for Retry Strategy
 * 
 * Tests exponential backoff calculation and retry decision logic.
 */

import {
  calculateRetryDelay,
  shouldRetryJob,
  handleJobFailure,
  getMaxRetryCount,
  getBaseDelayMs,
  getMaxDelayMs,
} from '../retry-strategy';
import { ErrorCategory } from '../error-classification';

describe('Retry Strategy', () => {
  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      // Retry 0: 30 seconds
      expect(calculateRetryDelay(0)).toBe(30);
      
      // Retry 1: 60 seconds
      expect(calculateRetryDelay(1)).toBe(60);
      
      // Retry 2: 120 seconds
      expect(calculateRetryDelay(2)).toBe(120);
      
      // Retry 3: 240 seconds
      expect(calculateRetryDelay(3)).toBe(240);
    });

    it('should cap delay at maximum (5 minutes)', () => {
      // Very high retry count should be capped at 300 seconds
      expect(calculateRetryDelay(10)).toBe(300);
      expect(calculateRetryDelay(100)).toBe(300);
    });

    it('should handle retry count of 0', () => {
      expect(calculateRetryDelay(0)).toBe(30);
    });

    it('should return integer seconds', () => {
      const delay = calculateRetryDelay(1);
      expect(Number.isInteger(delay)).toBe(true);
    });
  });

  describe('shouldRetryJob', () => {
    it('should retry transient errors within retry limit', () => {
      const error = new Error('ETIMEDOUT');
      const decision = shouldRetryJob(error, 0);

      expect(decision.should_retry).toBe(true);
      expect(decision.is_terminal).toBe(false);
      expect(decision.retry_delay_seconds).toBe(30);
      expect(decision.error_classification.category).toBe(ErrorCategory.TRANSIENT);
    });

    it('should not retry permanent errors', () => {
      const error = new Error('Menu not found');
      const decision = shouldRetryJob(error, 0);

      expect(decision.should_retry).toBe(false);
      expect(decision.is_terminal).toBe(true);
      expect(decision.retry_delay_seconds).toBe(0);
      expect(decision.error_classification.category).toBe(ErrorCategory.PERMANENT);
    });

    it('should not retry validation errors', () => {
      const error = new Error('Invalid format signature');
      const decision = shouldRetryJob(error, 0);

      expect(decision.should_retry).toBe(false);
      expect(decision.is_terminal).toBe(true);
      expect(decision.retry_delay_seconds).toBe(0);
      expect(decision.error_classification.category).toBe(ErrorCategory.VALIDATION);
    });

    it('should retry resource errors with backoff', () => {
      const error = new Error('Out of memory');
      const decision = shouldRetryJob(error, 1);

      expect(decision.should_retry).toBe(true);
      expect(decision.is_terminal).toBe(false);
      expect(decision.retry_delay_seconds).toBe(60);
      expect(decision.error_classification.category).toBe(ErrorCategory.RESOURCE);
    });

    it('should not retry after max retry count reached', () => {
      const error = new Error('ETIMEDOUT');
      const maxRetries = getMaxRetryCount();
      const decision = shouldRetryJob(error, maxRetries);

      expect(decision.should_retry).toBe(false);
      expect(decision.is_terminal).toBe(true);
      expect(decision.retry_delay_seconds).toBe(0);
    });

    it('should increase delay with each retry', () => {
      const error = new Error('ETIMEDOUT');
      
      const decision0 = shouldRetryJob(error, 0);
      const decision1 = shouldRetryJob(error, 1);
      const decision2 = shouldRetryJob(error, 2);

      expect(decision0.retry_delay_seconds).toBe(30);
      expect(decision1.retry_delay_seconds).toBe(60);
      expect(decision2.retry_delay_seconds).toBe(120);
      expect(decision1.retry_delay_seconds).toBeGreaterThan(decision0.retry_delay_seconds);
      expect(decision2.retry_delay_seconds).toBeGreaterThan(decision1.retry_delay_seconds);
    });

    it('should handle retry count at boundary (max - 1)', () => {
      const error = new Error('ETIMEDOUT');
      const maxRetries = getMaxRetryCount();
      const decision = shouldRetryJob(error, maxRetries - 1);

      // Should still retry at max - 1
      expect(decision.should_retry).toBe(true);
      expect(decision.is_terminal).toBe(false);
    });

    it('should handle retry count at boundary (max)', () => {
      const error = new Error('ETIMEDOUT');
      const maxRetries = getMaxRetryCount();
      const decision = shouldRetryJob(error, maxRetries);

      // Should not retry at max
      expect(decision.should_retry).toBe(false);
      expect(decision.is_terminal).toBe(true);
    });
  });

  describe('handleJobFailure', () => {
    it('should return retry decision for transient error', () => {
      const error = new Error('connection pool exhausted');
      const decision = handleJobFailure(error, 0);

      expect(decision.should_retry).toBe(true);
      expect(decision.is_terminal).toBe(false);
      expect(decision.retry_delay_seconds).toBeGreaterThan(0);
      expect(decision.error_classification.should_retry).toBe(true);
      expect(decision.error_classification.user_message).toContain('retry');
    });

    it('should return terminal decision for permanent error', () => {
      const error = new Error('User not found');
      const decision = handleJobFailure(error, 0);

      expect(decision.should_retry).toBe(false);
      expect(decision.is_terminal).toBe(true);
      expect(decision.retry_delay_seconds).toBe(0);
      expect(decision.error_classification.should_retry).toBe(false);
    });

    it('should return terminal decision after max retries', () => {
      const error = new Error('ETIMEDOUT');
      const maxRetries = getMaxRetryCount();
      const decision = handleJobFailure(error, maxRetries);

      expect(decision.should_retry).toBe(false);
      expect(decision.is_terminal).toBe(true);
      expect(decision.retry_delay_seconds).toBe(0);
    });

    it('should include error classification in decision', () => {
      const error = new Error('TimeoutError');
      const decision = handleJobFailure(error, 1);

      expect(decision.error_classification).toBeDefined();
      expect(decision.error_classification.category).toBe(ErrorCategory.RESOURCE);
      expect(decision.error_classification.user_message).toBeDefined();
      expect(decision.error_classification.internal_message).toBeDefined();
    });

    it('should handle unknown errors as transient', () => {
      const error = new Error('Some unknown error');
      const decision = handleJobFailure(error, 0);

      expect(decision.should_retry).toBe(true);
      expect(decision.error_classification.category).toBe(ErrorCategory.TRANSIENT);
    });
  });

  describe('Configuration getters', () => {
    it('should return max retry count', () => {
      const maxRetries = getMaxRetryCount();
      expect(maxRetries).toBeGreaterThan(0);
      expect(Number.isInteger(maxRetries)).toBe(true);
    });

    it('should return base delay in milliseconds', () => {
      const baseDelay = getBaseDelayMs();
      expect(baseDelay).toBeGreaterThan(0);
      expect(Number.isInteger(baseDelay)).toBe(true);
    });

    it('should return max delay in milliseconds', () => {
      const maxDelay = getMaxDelayMs();
      expect(maxDelay).toBeGreaterThan(0);
      expect(Number.isInteger(maxDelay)).toBe(true);
      expect(maxDelay).toBeGreaterThanOrEqual(getBaseDelayMs());
    });
  });

  describe('Edge cases', () => {
    it('should handle negative retry count gracefully', () => {
      // Should treat as 0
      const delay = calculateRetryDelay(-1);
      expect(delay).toBeGreaterThan(0);
    });

    it('should handle error without message', () => {
      const error = new Error();
      const decision = handleJobFailure(error, 0);

      expect(decision).toBeDefined();
      expect(decision.error_classification).toBeDefined();
    });

    it('should handle error without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;
      const decision = handleJobFailure(error, 0);

      expect(decision).toBeDefined();
      expect(decision.error_classification.internal_message).toBeDefined();
    });
  });

  describe('Retry scenarios', () => {
    it('should handle first retry attempt', () => {
      const error = new Error('ETIMEDOUT');
      const decision = handleJobFailure(error, 0);

      expect(decision.should_retry).toBe(true);
      expect(decision.retry_delay_seconds).toBe(30);
    });

    it('should handle second retry attempt', () => {
      const error = new Error('ETIMEDOUT');
      const decision = handleJobFailure(error, 1);

      expect(decision.should_retry).toBe(true);
      expect(decision.retry_delay_seconds).toBe(60);
    });

    it('should handle third retry attempt', () => {
      const error = new Error('ETIMEDOUT');
      const decision = handleJobFailure(error, 2);

      expect(decision.should_retry).toBe(true);
      expect(decision.retry_delay_seconds).toBe(120);
    });

    it('should handle exhausted retries', () => {
      const error = new Error('ETIMEDOUT');
      const decision = handleJobFailure(error, 3);

      expect(decision.should_retry).toBe(false);
      expect(decision.is_terminal).toBe(true);
    });
  });

  describe('Error category handling', () => {
    const testCases = [
      {
        error: new Error('ECONNREFUSED'),
        category: ErrorCategory.TRANSIENT,
        shouldRetry: true,
      },
      {
        error: new Error('Menu not found'),
        category: ErrorCategory.PERMANENT,
        shouldRetry: false,
      },
      {
        error: new Error('Out of memory'),
        category: ErrorCategory.RESOURCE,
        shouldRetry: true,
      },
      {
        error: new Error('Invalid PDF signature'),
        category: ErrorCategory.VALIDATION,
        shouldRetry: false,
      },
    ];

    testCases.forEach(({ error, category, shouldRetry }) => {
      it(`should handle ${category} errors correctly`, () => {
        const decision = handleJobFailure(error, 0);

        expect(decision.error_classification.category).toBe(category);
        expect(decision.should_retry).toBe(shouldRetry);
        
        if (shouldRetry) {
          expect(decision.retry_delay_seconds).toBeGreaterThan(0);
        } else {
          expect(decision.retry_delay_seconds).toBe(0);
        }
      });
    });
  });
});
