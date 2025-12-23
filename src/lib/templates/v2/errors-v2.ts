/**
 * V2 Layout Engine Error Types
 *
 * Custom error classes for V2-specific errors with proper error handling
 * and context information for debugging.
 */

import type { ZodIssue } from 'zod'

// =============================================================================
// Invariant Violation Type
// =============================================================================

/** Invariant violation details for runtime validation */
export interface InvariantViolation {
  code: string
  message: string
  tile?: {
    id: string
    type: string
    regionId: string
    x: number
    y: number
    width: number
    height: number
  }
  page?: number
  context?: Record<string, unknown>
}

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Template validation error with Zod issues array.
 * Thrown when YAML template files fail schema validation.
 */
export class TemplateValidationError extends Error {
  public readonly name = 'TemplateValidationError'

  constructor(
    message: string,
    public readonly issues: ZodIssue[]
  ) {
    super(message)
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, TemplateValidationError.prototype)
  }

  /**
   * Get formatted error message with all validation issues.
   */
  getDetailedMessage(): string {
    const issueMessages = this.issues.map(issue => {
      const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : ''
      return `  - ${issue.message}${path}`
    }).join('\n')

    return `${this.message}\n\nValidation issues:\n${issueMessages}`
  }
}

/**
 * Invariant violation error with violations array.
 * Thrown when runtime invariant checks fail in dev mode.
 */
export class InvariantViolationError extends Error {
  public readonly name = 'InvariantViolationError'

  constructor(
    message: string,
    public readonly violations: InvariantViolation[]
  ) {
    super(message)
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, InvariantViolationError.prototype)
  }

  /**
   * Get formatted error message with all violations.
   */
  getDetailedMessage(): string {
    const violationMessages = this.violations.map((violation, index) => {
      let msg = `  ${index + 1}. [${violation.code}] ${violation.message}`
      
      if (violation.tile) {
        msg += `\n     Tile: ${violation.tile.id} (${violation.tile.type}) at (${violation.tile.x}, ${violation.tile.y})`
      }
      
      if (violation.page !== undefined) {
        msg += `\n     Page: ${violation.page}`
      }
      
      if (violation.context) {
        const contextStr = Object.entries(violation.context)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(', ')
        msg += `\n     Context: ${contextStr}`
      }
      
      return msg
    }).join('\n\n')

    return `${this.message}\n\nViolations:\n${violationMessages}`
  }
}

/**
 * General layout engine error with context object.
 * Thrown for general layout generation failures.
 */
export class LayoutEngineErrorV2 extends Error {
  public readonly name = 'LayoutEngineErrorV2'

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, LayoutEngineErrorV2.prototype)
  }

  /**
   * Get formatted error message with context information.
   */
  getDetailedMessage(): string {
    if (!this.context || Object.keys(this.context).length === 0) {
      return this.message
    }

    const contextStr = Object.entries(this.context)
      .map(([key, value]) => `  ${key}: ${JSON.stringify(value, null, 2)}`)
      .join('\n')

    return `${this.message}\n\nContext:\n${contextStr}`
  }
}

// =============================================================================
// Error Utilities
// =============================================================================

/**
 * Check if an error is a V2 layout engine error.
 */
export function isV2LayoutError(error: unknown): error is TemplateValidationError | InvariantViolationError | LayoutEngineErrorV2 {
  return error instanceof TemplateValidationError ||
         error instanceof InvariantViolationError ||
         error instanceof LayoutEngineErrorV2
}

/**
 * Get detailed error message from any V2 layout error.
 */
export function getV2ErrorDetails(error: unknown): string {
  if (error instanceof TemplateValidationError ||
      error instanceof InvariantViolationError ||
      error instanceof LayoutEngineErrorV2) {
    return error.getDetailedMessage()
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return String(error)
}