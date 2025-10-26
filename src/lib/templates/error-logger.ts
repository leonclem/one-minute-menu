/**
 * Error Logging Utility for Dynamic Menu Layout Engine
 * 
 * Provides structured error logging with context for debugging and monitoring.
 * Integrates with existing platform metrics and logging infrastructure.
 */

// ============================================================================
// Error Types and Codes
// ============================================================================

/**
 * Standard error codes for layout engine operations
 */
export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_SEMANTICS: 'INVALID_SEMANTICS',
  PRESET_NOT_FOUND: 'PRESET_NOT_FOUND',
  EXPORT_FAILED: 'EXPORT_FAILED',
  RENDER_TIMEOUT: 'RENDER_TIMEOUT',
  CONCURRENCY_LIMIT: 'CONCURRENCY_LIMIT',
  TRANSFORMATION_FAILED: 'TRANSFORMATION_FAILED',
  GRID_GENERATION_FAILED: 'GRID_GENERATION_FAILED',
  THEME_APPLICATION_FAILED: 'THEME_APPLICATION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

// ============================================================================
// Custom Error Class
// ============================================================================

/**
 * Custom error class for layout engine operations
 * Includes error code, details, and timestamp for structured logging
 */
export class LayoutEngineError extends Error {
  public readonly code: ErrorCode
  public readonly details?: Record<string, any>
  public readonly timestamp: Date

  constructor(
    message: string,
    code: ErrorCode,
    details?: Record<string, any>
  ) {
    super(message)
    this.name = 'LayoutEngineError'
    this.code = code
    this.details = details
    this.timestamp = new Date()

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LayoutEngineError)
    }
  }
}

// ============================================================================
// Error Context Interface
// ============================================================================

/**
 * Context information for error logging
 */
export interface ErrorContext {
  menuId?: string
  userId?: string
  outputContext?: string
  outputFormat?: string
  presetId?: string
  sectionCount?: number
  totalItems?: number
  imageRatio?: number
  operation?: string
  duration?: number
  memoryUsage?: number
  [key: string]: any // Allow additional context fields
}

// ============================================================================
// Error Logging Function
// ============================================================================

/**
 * Log layout engine errors with structured context
 * Integrates with existing platform logging infrastructure
 * 
 * @param error - The error to log (LayoutEngineError or standard Error)
 * @param context - Additional context information
 */
export function logLayoutError(
  error: LayoutEngineError | Error,
  context: ErrorContext = {}
): void {
  const isLayoutError = error instanceof LayoutEngineError

  // Build structured log entry
  const logEntry = {
    timestamp: isLayoutError ? error.timestamp : new Date(),
    errorName: error.name,
    errorCode: isLayoutError ? error.code : ERROR_CODES.UNKNOWN_ERROR,
    message: error.message,
    details: isLayoutError ? error.details : undefined,
    context,
    stack: error.stack
  }

  // Log to console with appropriate level
  if (process.env.NODE_ENV === 'development') {
    // Detailed logging in development
    console.error('[LayoutEngine Error]', {
      ...logEntry,
      stack: error.stack
    })
  } else {
    // Concise logging in production
    console.error('[LayoutEngine Error]', {
      timestamp: logEntry.timestamp,
      code: logEntry.errorCode,
      message: logEntry.message,
      context: {
        menuId: context.menuId,
        userId: context.userId,
        operation: context.operation
      }
    })
  }

  // TODO: Integrate with external monitoring service (e.g., Sentry, DataDog)
  // if (process.env.NODE_ENV === 'production') {
  //   sendToMonitoringService(logEntry)
  // }
}

// ============================================================================
// Warning Logging Function
// ============================================================================

/**
 * Log non-critical warnings for layout operations
 * 
 * @param message - Warning message
 * @param context - Additional context information
 */
export function logLayoutWarning(
  message: string,
  context: ErrorContext = {}
): void {
  const logEntry = {
    timestamp: new Date(),
    level: 'warning',
    message,
    context
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[LayoutEngine Warning]', logEntry)
  } else {
    console.warn('[LayoutEngine Warning]', {
      message,
      context: {
        menuId: context.menuId,
        operation: context.operation
      }
    })
  }
}

// ============================================================================
// Performance Logging Function
// ============================================================================

/**
 * Log performance metrics for layout operations
 * 
 * @param operation - Name of the operation
 * @param duration - Duration in milliseconds
 * @param context - Additional context information
 */
export function logLayoutPerformance(
  operation: string,
  duration: number,
  context: ErrorContext = {}
): void {
  const logEntry = {
    timestamp: new Date(),
    level: 'info',
    operation,
    duration,
    context
  }

  // Only log slow operations in production
  const threshold = process.env.NODE_ENV === 'development' ? 0 : 1000 // 1 second

  if (duration > threshold) {
    console.info('[LayoutEngine Performance]', logEntry)
  }

  // TODO: Send to metrics collection service
  // trackMetric('layout_operation_duration', duration, { operation, ...context })
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a LayoutEngineError from a standard Error
 * Useful for wrapping errors from external libraries
 */
export function wrapError(
  error: Error,
  code: ErrorCode,
  details?: Record<string, any>
): LayoutEngineError {
  const wrappedError = new LayoutEngineError(
    error.message,
    code,
    {
      ...details,
      originalError: error.name,
      originalStack: error.stack
    }
  )

  return wrappedError
}

/**
 * Check if an error is a LayoutEngineError
 */
export function isLayoutEngineError(error: any): error is LayoutEngineError {
  return error instanceof LayoutEngineError
}

/**
 * Extract error code from any error
 */
export function getErrorCode(error: any): ErrorCode {
  if (isLayoutEngineError(error)) {
    return error.code
  }
  return ERROR_CODES.UNKNOWN_ERROR
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error, includeStack = false): {
  error: string
  code: ErrorCode
  message: string
  details?: Record<string, any>
  stack?: string
} {
  const isLayoutError = isLayoutEngineError(error)

  return {
    error: error.name,
    code: getErrorCode(error),
    message: error.message,
    details: isLayoutError ? error.details : undefined,
    stack: includeStack ? error.stack : undefined
  }
}

// ============================================================================
// Error Recovery Helpers
// ============================================================================

/**
 * Execute a function with error handling and logging
 * Returns a result or throws a LayoutEngineError
 */
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T> {
  const startTime = Date.now()

  try {
    const result = await fn()
    const duration = Date.now() - startTime

    // Log performance
    logLayoutPerformance(operation, duration, context)

    return result
  } catch (error) {
    const duration = Date.now() - startTime

    // Wrap and log error
    const layoutError = error instanceof LayoutEngineError
      ? error
      : wrapError(
          error instanceof Error ? error : new Error(String(error)),
          ERROR_CODES.UNKNOWN_ERROR,
          { operation, duration }
        )

    logLayoutError(layoutError, { ...context, operation, duration })

    throw layoutError
  }
}

/**
 * Execute a function with error handling, returning null on failure
 * Useful for non-critical operations
 */
export async function withErrorHandlingSafe<T>(
  operation: string,
  fn: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T | null> {
  try {
    return await withErrorHandling(operation, fn, context)
  } catch (error) {
    // Error already logged by withErrorHandling
    return null
  }
}
