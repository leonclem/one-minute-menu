/**
 * GridMenu Template Engine - Error Types
 * 
 * This module defines custom error classes for the template engine:
 * - TemplateEngineError: Base error class
 * - TemplateValidationError: Template definition validation failures
 * - MenuValidationError: Menu data validation failures
 * - CompatibilityError: Template-menu compatibility issues
 * - LayoutGenerationError: Layout generation failures
 */

// ============================================================================
// Base Error Class
// ============================================================================

export class TemplateEngineError extends Error {
  public readonly code: string
  public readonly details?: Record<string, any>

  constructor(
    message: string,
    code: string,
    details?: Record<string, any>
  ) {
    super(message)
    this.name = 'TemplateEngineError'
    this.code = code
    this.details = details

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Thrown when a template definition fails validation
 */
export class TemplateValidationError extends TemplateEngineError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'TEMPLATE_VALIDATION_ERROR', details)
    this.name = 'TemplateValidationError'
  }
}

/**
 * Thrown when menu data fails validation
 */
export class MenuValidationError extends TemplateEngineError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'MENU_VALIDATION_ERROR', details)
    this.name = 'MenuValidationError'
  }
}

/**
 * Thrown when a template is incompatible with a menu
 */
export class CompatibilityError extends TemplateEngineError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'COMPATIBILITY_ERROR', details)
    this.name = 'CompatibilityError'
  }
}

/**
 * Thrown when layout generation fails
 */
export class LayoutGenerationError extends TemplateEngineError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'LAYOUT_GENERATION_ERROR', details)
    this.name = 'LayoutGenerationError'
  }
}
