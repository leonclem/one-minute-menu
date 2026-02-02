/**
 * Unit tests for error classification logic
 */

import {
  ErrorCategory,
  classifyError,
  generateUserMessage,
} from '../error-classification';

describe('Error Classification', () => {
  describe('classifyError', () => {
    describe('Transient Errors', () => {
      it('should classify network connection errors as transient', () => {
        const errors = [
          new Error('ECONNREFUSED: Connection refused'),
          new Error('ETIMEDOUT: Connection timed out'),
          new Error('ENOTFOUND: DNS lookup failed'),
          new Error('EHOSTUNREACH: Host unreachable'),
          new Error('ENETUNREACH: Network unreachable'),
          new Error('socket hang up'),
          new Error('network timeout occurred'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.TRANSIENT);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('network');
          expect(result.internal_message).toBeTruthy();
        });
      });

      it('should classify database connection errors as transient', () => {
        const errors = [
          new Error('connection pool exhausted'),
          new Error('too many connections to database'),
          new Error('database is locked'),
          new Error('connection terminated unexpectedly'),
          new Error('connection refused by server'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.TRANSIENT);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('busy');
          expect(result.internal_message).toBeTruthy();
        });
      });

      it('should classify browser launch failures as transient', () => {
        const errors = [
          new Error('Failed to launch browser'),
          new Error('browser launch failed'),
          new Error('Could not find Chrome executable'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.TRANSIENT);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('rendering');
        });
      });

      it('should classify storage upload failures as transient', () => {
        const errors = [
          new Error('upload failed to storage'),
          new Error('storage error occurred'),
          new Error('S3 error: temporary failure'),
          new Error('bucket not found'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.TRANSIENT);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('storage');
        });
      });

      it('should classify rate limiting errors as transient', () => {
        const errors = [
          new Error('rate limit exceeded'),
          new Error('too many requests'),
          new Error('HTTP 429 error'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.TRANSIENT);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('busy');
        });
      });
    });

    describe('Resource Errors', () => {
      it('should classify out of memory errors as resource errors', () => {
        const errors = [
          new Error('Out of memory'),
          new Error('OOM killed'),
          new Error('heap out of memory'),
          new Error('JavaScript heap out of memory'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.RESOURCE);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('memory');
          expect(result.internal_message).toBeTruthy();
        });
      });

      it('should classify timeout errors as resource errors', () => {
        const errors = [
          new Error('TimeoutError: Operation timed out'),
          new Error('timeout exceeded'),
          new Error('operation timed out'),
          new Error('render timeout'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.RESOURCE);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('took too long');
        });
      });

      it('should classify disk space errors as resource errors', () => {
        const errors = [
          new Error('ENOSPC: no space left on device'),
          new Error('no space left on disk'),
          new Error('disk full'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.RESOURCE);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('storage');
        });
      });

      it('should classify file handle errors as resource errors', () => {
        const errors = [
          new Error('EMFILE: too many open files'),
          new Error('too many open files in system'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.RESOURCE);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('resource limit');
        });
      });
    });

    describe('Permanent Errors', () => {
      it('should classify data not found errors as permanent', () => {
        const errors = [
          new Error('Menu not found'),
          new Error('User not found'),
          new Error('menu does not exist'),
          new Error('user does not exist'),
          new Error('record not found'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.PERMANENT);
          expect(result.should_retry).toBe(false);
          expect(result.user_message).toContain('no longer exists');
          expect(result.internal_message).toBeTruthy();
        });
      });

      it('should classify input validation errors as permanent', () => {
        const errors = [
          new Error('HTML too large'),
          new Error('Too many images in menu'),
          new Error('exceeds maximum allowed size'),
          new Error('exceeds the maximum allowed'),
          new Error('Invalid export type'),
          new Error('images from untrusted domains'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.PERMANENT);
          expect(result.should_retry).toBe(false);
          expect(result.user_message).toContain('size limits');
        });
      });

      it('should classify malformed HTML errors as permanent', () => {
        const errors = [
          new Error('malformed HTML detected'),
          new Error('invalid HTML structure'),
          new Error('parse error in HTML'),
          new Error('syntax error in HTML'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.PERMANENT);
          expect(result.should_retry).toBe(false);
          expect(result.user_message).toContain('malformed');
        });
      });
    });

    describe('Validation Errors', () => {
      it('should classify output validation errors as validation errors', () => {
        const errors = [
          new Error('Invalid format signature'),
          new Error('Output too small'),
          new Error('Invalid PDF signature'),
          new Error('Invalid PNG signature'),
          new Error('Invalid JPEG signature'),
          new Error('corrupted output file'),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.VALIDATION);
          expect(result.should_retry).toBe(false);
          expect(result.user_message).toContain('invalid output');
          expect(result.internal_message).toBeTruthy();
        });
      });
    });

    describe('Unknown Errors', () => {
      it('should classify unknown errors as transient (safe default)', () => {
        const errors = [
          new Error('Something went wrong'),
          new Error('Unexpected error'),
          new Error(''),
        ];

        errors.forEach(error => {
          const result = classifyError(error);
          expect(result.category).toBe(ErrorCategory.TRANSIENT);
          expect(result.should_retry).toBe(true);
          expect(result.user_message).toContain('Unexpected error');
        });
      });

      it('should handle errors without messages', () => {
        const error = new Error();
        const result = classifyError(error);
        expect(result.category).toBe(ErrorCategory.TRANSIENT);
        expect(result.should_retry).toBe(true);
        expect(result.internal_message).toBeTruthy();
      });

      it('should include stack trace in internal message', () => {
        const error = new Error('Test error');
        const result = classifyError(error);
        expect(result.internal_message).toContain('Test error');
      });
    });

    describe('Edge Cases', () => {
      it('should handle errors with multiple matching patterns', () => {
        // Error that could match multiple categories - should use first match
        const error = new Error('ETIMEDOUT: connection pool exhausted');
        const result = classifyError(error);
        // Should match network error first (transient)
        expect(result.category).toBe(ErrorCategory.TRANSIENT);
        expect(result.should_retry).toBe(true);
      });

      it('should be case-sensitive for error messages', () => {
        const error = new Error('etimedout'); // lowercase
        const result = classifyError(error);
        // Should not match ETIMEDOUT pattern, defaults to transient
        expect(result.category).toBe(ErrorCategory.TRANSIENT);
        expect(result.should_retry).toBe(true);
      });

      it('should handle very long error messages', () => {
        const longMessage = 'Error: ' + 'x'.repeat(10000) + ' ETIMEDOUT';
        const error = new Error(longMessage);
        const result = classifyError(error);
        expect(result.category).toBe(ErrorCategory.TRANSIENT);
        expect(result.internal_message).toContain('ETIMEDOUT');
      });
    });
  });

  describe('generateUserMessage', () => {
    it('should return specific message when provided', () => {
      const specificMessage = 'Custom error message';
      const result = generateUserMessage(ErrorCategory.TRANSIENT, specificMessage);
      expect(result).toBe(specificMessage);
    });

    it('should generate default message for transient errors', () => {
      const result = generateUserMessage(ErrorCategory.TRANSIENT);
      expect(result).toContain('temporary');
      expect(result).toContain('retry');
    });

    it('should generate default message for permanent errors', () => {
      const result = generateUserMessage(ErrorCategory.PERMANENT);
      expect(result).toContain('cannot be completed');
    });

    it('should generate default message for resource errors', () => {
      const result = generateUserMessage(ErrorCategory.RESOURCE);
      expect(result).toContain('resources');
    });

    it('should generate default message for validation errors', () => {
      const result = generateUserMessage(ErrorCategory.VALIDATION);
      expect(result).toContain('validation');
      expect(result).toContain('support');
    });

    it('should handle unknown error categories', () => {
      const result = generateUserMessage('unknown' as ErrorCategory);
      expect(result).toContain('error occurred');
    });
  });

  describe('Integration Scenarios', () => {
    it('should correctly classify a typical network timeout', () => {
      const error = new Error('Request failed: ETIMEDOUT - Connection timed out after 30000ms');
      const result = classifyError(error);
      
      expect(result.category).toBe(ErrorCategory.TRANSIENT);
      expect(result.should_retry).toBe(true);
      expect(result.user_message).toBe('Temporary network issue. We\'ll retry automatically.');
      expect(result.internal_message).toContain('ETIMEDOUT');
    });

    it('should correctly classify a menu not found error', () => {
      const error = new Error('Menu not found: ID abc-123 does not exist in database');
      const result = classifyError(error);
      
      expect(result.category).toBe(ErrorCategory.PERMANENT);
      expect(result.should_retry).toBe(false);
      expect(result.user_message).toBe('Menu or user no longer exists.');
      expect(result.internal_message).toContain('Menu not found');
    });

    it('should correctly classify an OOM error', () => {
      const error = new Error('JavaScript heap out of memory - allocation failed');
      const result = classifyError(error);
      
      expect(result.category).toBe(ErrorCategory.RESOURCE);
      expect(result.should_retry).toBe(true);
      expect(result.user_message).toContain('memory');
      expect(result.internal_message).toContain('heap out of memory');
    });

    it('should correctly classify an invalid output error', () => {
      const error = new Error('Invalid PDF signature: expected %PDF- but got %PNG');
      const result = classifyError(error);
      
      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.should_retry).toBe(false);
      expect(result.user_message).toContain('invalid output');
      expect(result.internal_message).toContain('Invalid PDF signature');
    });
  });
});
