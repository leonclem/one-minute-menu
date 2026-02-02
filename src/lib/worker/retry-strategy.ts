/**
 * Retry Strategy with Exponential Backoff
 * 
 * Implements retry logic with exponential backoff for failed export jobs.
 * Implements Requirements 6.1, 6.2
 */

import { ErrorCategory, ErrorClassification, classifyError } from './error-classification';

// Configuration constants (can be overridden via environment variables)
const BASE_DELAY_MS = parseInt(process.env.RETRY_BASE_DELAY_MS || '30000', 10); // 30 seconds default
const MAX_DELAY_MS = parseInt(process.env.RETRY_MAX_DELAY_MS || '300000', 10); // 5 minutes default
const MAX_RETRY_COUNT = parseInt(process.env.MAX_RETRY_COUNT || '3', 10); // 3 retries default

export interface RetryDecision {
  should_retry: boolean;
  retry_delay_seconds: number;
  is_terminal: boolean;
  error_classification: ErrorClassification;
}

/**
 * Calculates retry delay using exponential backoff
 * 
 * Formula: base_delay * 2^retry_count, capped at max_delay
 * 
 * Retry 0: 30 seconds
 * Retry 1: 60 seconds
 * Retry 2: 120 seconds
 * Retry 3+: 300 seconds (max)
 * 
 * @param retry_count - Current retry count (0-based)
 * @returns Delay in seconds before next retry
 * 
 * Requirements: 6.1, 6.2
 */
export function calculateRetryDelay(retry_count: number): number {
  // Exponential backoff: base * 2^retry_count
  const delay_ms = BASE_DELAY_MS * Math.pow(2, retry_count);
  
  // Cap at maximum delay
  const capped_delay_ms = Math.min(delay_ms, MAX_DELAY_MS);
  
  // Convert to seconds for database storage
  return Math.floor(capped_delay_ms / 1000);
}

/**
 * Determines whether a job should be retried based on error and retry count
 * 
 * @param error - The error that caused the job to fail
 * @param current_retry_count - Current retry count for the job
 * @returns RetryDecision with retry determination and delay
 * 
 * Requirements: 6.1, 6.2
 */
export function shouldRetryJob(
  error: Error,
  current_retry_count: number
): RetryDecision {
  // Classify the error
  const classification = classifyError(error);
  
  // Check if we've exhausted retries
  const retry_limit_reached = current_retry_count >= MAX_RETRY_COUNT;
  
  // Determine if this is a terminal failure
  const is_terminal = !classification.should_retry || retry_limit_reached;
  
  // Calculate retry delay if we should retry
  const retry_delay_seconds = is_terminal 
    ? 0 
    : calculateRetryDelay(current_retry_count);
  
  return {
    should_retry: !is_terminal,
    retry_delay_seconds,
    is_terminal,
    error_classification: classification,
  };
}

/**
 * Handles job failure by determining retry strategy
 * 
 * This function encapsulates the retry logic:
 * - Classifies the error
 * - Determines if retry is appropriate
 * - Calculates backoff delay
 * - Returns decision for database update
 * 
 * @param error - The error that caused the job to fail
 * @param current_retry_count - Current retry count for the job
 * @returns RetryDecision with all information needed to update job status
 * 
 * Requirements: 6.1, 6.2
 */
export function handleJobFailure(
  error: Error,
  current_retry_count: number
): RetryDecision {
  return shouldRetryJob(error, current_retry_count);
}

/**
 * Gets the maximum retry count configuration
 * 
 * @returns Maximum number of retries allowed
 */
export function getMaxRetryCount(): number {
  return MAX_RETRY_COUNT;
}

/**
 * Gets the base delay configuration in milliseconds
 * 
 * @returns Base delay in milliseconds
 */
export function getBaseDelayMs(): number {
  return BASE_DELAY_MS;
}

/**
 * Gets the maximum delay configuration in milliseconds
 * 
 * @returns Maximum delay in milliseconds
 */
export function getMaxDelayMs(): number {
  return MAX_DELAY_MS;
}
