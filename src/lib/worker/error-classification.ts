/**
 * Error Classification Logic
 * 
 * Classifies errors into categories to determine retry behavior.
 * Implements Error Handling requirements from design document.
 */

export enum ErrorCategory {
  TRANSIENT = 'transient',     // Network timeout, temporary DB issue - retry
  PERMANENT = 'permanent',     // Invalid HTML, missing menu - don't retry
  RESOURCE = 'resource',       // OOM, timeout - retry with backoff
  VALIDATION = 'validation'    // Bad output format - don't retry
}

export interface ErrorClassification {
  category: ErrorCategory;
  should_retry: boolean;
  user_message: string;        // Friendly message for user
  internal_message: string;    // Detailed message for logs
}

/**
 * Classifies an error into a category and determines retry behavior
 * 
 * @param error - The error to classify
 * @returns ErrorClassification with category, retry decision, and messages
 */
export function classifyError(error: Error): ErrorClassification {
  const errorMessage = error.message || '';
  const errorStack = error.stack || errorMessage;

  // Network and connection errors (transient)
  if (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('EHOSTUNREACH') ||
    errorMessage.includes('ENETUNREACH') ||
    errorMessage.includes('socket hang up') ||
    errorMessage.includes('network timeout')
  ) {
    return {
      category: ErrorCategory.TRANSIENT,
      should_retry: true,
      user_message: 'Temporary network issue. We\'ll retry automatically.',
      internal_message: errorStack
    };
  }

  // Database errors (transient)
  if (
    errorMessage.includes('connection pool exhausted') ||
    errorMessage.includes('too many connections') ||
    errorMessage.includes('database is locked') ||
    errorMessage.includes('connection terminated') ||
    errorMessage.includes('connection refused')
  ) {
    return {
      category: ErrorCategory.TRANSIENT,
      should_retry: true,
      user_message: 'System is busy. We\'ll retry shortly.',
      internal_message: errorStack
    };
  }

  // Resource errors (retry with backoff)
  if (
    errorMessage.includes('Out of memory') ||
    errorMessage.includes('OOM') ||
    errorMessage.includes('heap out of memory') ||
    errorMessage.includes('JavaScript heap out of memory')
  ) {
    return {
      category: ErrorCategory.RESOURCE,
      should_retry: true,
      user_message: 'Export required too much memory. We\'ll try again with more resources.',
      internal_message: errorStack
    };
  }

  // Timeout errors (resource)
  if (
    errorMessage.includes('TimeoutError') ||
    errorMessage.includes('timeout exceeded') ||
    errorMessage.includes('operation timed out') ||
    errorMessage.includes('render timeout')
  ) {
    return {
      category: ErrorCategory.RESOURCE,
      should_retry: true,
      user_message: 'Export took too long. We\'ll try again with more time.',
      internal_message: errorStack
    };
  }

  // Disk space errors (resource)
  if (
    errorMessage.includes('ENOSPC') ||
    errorMessage.includes('no space left') ||
    errorMessage.includes('disk full')
  ) {
    return {
      category: ErrorCategory.RESOURCE,
      should_retry: true,
      user_message: 'Temporary storage issue. We\'ll retry shortly.',
      internal_message: errorStack
    };
  }

  // File handle errors (resource)
  if (
    errorMessage.includes('EMFILE') ||
    errorMessage.includes('too many open files')
  ) {
    return {
      category: ErrorCategory.RESOURCE,
      should_retry: true,
      user_message: 'System resource limit reached. We\'ll retry shortly.',
      internal_message: errorStack
    };
  }

  // Validation errors (no retry)
  if (
    errorMessage.includes('Invalid format signature') ||
    errorMessage.includes('Output too small') ||
    errorMessage.includes('Invalid PDF signature') ||
    errorMessage.includes('Invalid PNG signature') ||
    errorMessage.includes('Invalid JPEG signature') ||
    errorMessage.includes('corrupted output')
  ) {
    return {
      category: ErrorCategory.VALIDATION,
      should_retry: false,
      user_message: 'Export generated invalid output. Please contact support.',
      internal_message: errorStack
    };
  }

  // Data errors (permanent)
  if (
    errorMessage.includes('Menu not found') ||
    errorMessage.includes('User not found') ||
    errorMessage.includes('menu does not exist') ||
    errorMessage.includes('user does not exist') ||
    errorMessage.includes('record not found')
  ) {
    return {
      category: ErrorCategory.PERMANENT,
      should_retry: false,
      user_message: 'Menu or user no longer exists.',
      internal_message: errorStack
    };
  }

  // Input validation errors (permanent)
  if (
    errorMessage.includes('HTML too large') ||
    errorMessage.includes('Too many images') ||
    errorMessage.includes('exceeds maximum allowed size') ||
    errorMessage.includes('exceeds the maximum allowed') ||
    errorMessage.includes('Invalid export type') ||
    errorMessage.includes('untrusted domains')
  ) {
    return {
      category: ErrorCategory.PERMANENT,
      should_retry: false,
      user_message: 'Menu exceeds size limits or contains invalid content. Please reduce content.',
      internal_message: errorStack
    };
  }

  // Malformed HTML errors (permanent)
  if (
    errorMessage.includes('malformed HTML') ||
    errorMessage.includes('invalid HTML') ||
    errorMessage.includes('parse error') ||
    errorMessage.includes('syntax error in HTML')
  ) {
    return {
      category: ErrorCategory.PERMANENT,
      should_retry: false,
      user_message: 'Menu HTML is malformed and cannot be processed.',
      internal_message: errorStack
    };
  }

  // Puppeteer browser launch failures (transient)
  if (
    errorMessage.includes('Failed to launch') ||
    errorMessage.includes('browser launch failed') ||
    errorMessage.includes('Could not find Chrome')
  ) {
    return {
      category: ErrorCategory.TRANSIENT,
      should_retry: true,
      user_message: 'Temporary rendering issue. We\'ll retry automatically.',
      internal_message: errorStack
    };
  }

  // Storage upload failures (transient)
  if (
    errorMessage.includes('upload failed') ||
    errorMessage.includes('storage error') ||
    errorMessage.includes('S3 error') ||
    errorMessage.includes('bucket not found')
  ) {
    return {
      category: ErrorCategory.TRANSIENT,
      should_retry: true,
      user_message: 'Temporary storage issue. We\'ll retry automatically.',
      internal_message: errorStack
    };
  }

  // Rate limiting errors (transient)
  if (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('too many requests') ||
    errorMessage.includes('429')
  ) {
    return {
      category: ErrorCategory.TRANSIENT,
      should_retry: true,
      user_message: 'Service is busy. We\'ll retry shortly.',
      internal_message: errorStack
    };
  }

  // Default to transient for unknown errors (safer to retry)
  return {
    category: ErrorCategory.TRANSIENT,
    should_retry: true,
    user_message: 'Unexpected error occurred. We\'ll retry automatically.',
    internal_message: errorStack
  };
}

/**
 * Generates a user-friendly error message based on error category
 * 
 * @param category - The error category
 * @param specificMessage - Optional specific message to include
 * @returns User-friendly error message
 */
export function generateUserMessage(
  category: ErrorCategory,
  specificMessage?: string
): string {
  if (specificMessage) {
    return specificMessage;
  }

  switch (category) {
    case ErrorCategory.TRANSIENT:
      return 'A temporary error occurred. We\'ll retry automatically.';
    case ErrorCategory.PERMANENT:
      return 'This export cannot be completed. Please check your menu content.';
    case ErrorCategory.RESOURCE:
      return 'Export required too many resources. We\'ll try again.';
    case ErrorCategory.VALIDATION:
      return 'Export output validation failed. Please contact support.';
    default:
      return 'An error occurred during export.';
  }
}
