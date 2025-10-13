/**
 * Error Handler for Menu Extraction
 * 
 * Provides comprehensive error handling for:
 * - API failures (rate limiting, service unavailable)
 * - Validation errors with partial data salvage
 * - Image quality assessment based on confidence scores
 * - Fallback to manual entry for failed extractions
 * - User-friendly error messages and guidance
 * 
 * Requirements: 10.4, 7.5, 11.3, 15.7
 */

import { HttpError } from '../retry'
import type { ValidationResult } from './schema-validator'
import type { ExtractionResult } from './schema-stage1'

// ============================================================================
// Error Types and Interfaces
// ============================================================================

export type ErrorCategory = 
  | 'api_error'
  | 'validation_error'
  | 'image_quality'
  | 'quota_exceeded'
  | 'invalid_input'
  | 'unknown_error'

export type FallbackMode = 'manual_entry' | 'retry' | null

export interface ErrorResponse {
  success: boolean
  category: ErrorCategory
  retryable: boolean
  retryAfter?: number
  partial?: boolean
  message: string
  userMessage: string // User-friendly message
  fallbackMode: FallbackMode
  guidance?: string[]
  data?: Partial<ExtractionResult>
  warnings?: string[]
  requiresReview?: boolean
  technicalDetails?: string
}

export interface ImageQualityAssessment {
  overallConfidence: number
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unacceptable'
  issues: string[]
  recommendations: string[]
  canProceed: boolean
}

// ============================================================================
// Error Handler Class
// ============================================================================

export class ExtractionErrorHandler {
  /**
   * Handle Vision-LLM API errors
   */
  static handleVisionAPIError(error: any): ErrorResponse {
    // Handle HttpError from retry utility
    if (error instanceof HttpError) {
      return this.handleHttpError(error)
    }

    // Handle OpenAI-specific errors
    if (error?.status) {
      return this.handleHttpError(
        new HttpError(
          error.message || 'OpenAI API error',
          error.status,
          error
        )
      )
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        category: 'api_error',
        retryable: true,
        retryAfter: 30,
        message: 'Network error while connecting to extraction service',
        userMessage: 'Unable to connect to the extraction service. Please check your internet connection.',
        fallbackMode: 'retry',
        guidance: [
          'Check your internet connection',
          'Try again in a few moments',
          'If the problem persists, try manual entry'
        ],
        technicalDetails: error.message
      }
    }

    // Unknown error
    return {
      success: false,
      category: 'unknown_error',
      retryable: false,
      message: `Unexpected error: ${error?.message || 'Unknown error'}`,
      userMessage: 'An unexpected error occurred during extraction.',
      fallbackMode: 'manual_entry',
      guidance: [
        'Please try manual entry instead',
        'Contact support if the problem persists'
      ],
      technicalDetails: error?.stack || String(error)
    }
  }

  /**
   * Handle HTTP errors with specific status codes
   */
  private static handleHttpError(error: HttpError): ErrorResponse {
    switch (error.status) {
      case 429: // Rate limiting
        return {
          success: false,
          category: 'api_error',
          retryable: true,
          retryAfter: this.extractRetryAfter(error) || 60,
          message: 'API rate limit reached',
          userMessage: 'Too many extraction requests. Please wait a moment and try again.',
          fallbackMode: 'retry',
          guidance: [
            'Wait 60 seconds before trying again',
            'Consider upgrading your plan for higher limits',
            'Use manual entry if you need immediate results'
          ],
          technicalDetails: error.message
        }

      case 503: // Service unavailable
        return {
          success: false,
          category: 'api_error',
          retryable: true,
          retryAfter: 30,
          message: 'Vision service temporarily unavailable',
          userMessage: 'The extraction service is temporarily unavailable. We\'ll retry automatically.',
          fallbackMode: 'retry',
          guidance: [
            'The service will retry automatically',
            'This is usually temporary',
            'Use manual entry if you need immediate results'
          ],
          technicalDetails: error.message
        }

      case 400: // Bad request (often token limit exceeded)
        if (error.message.includes('token') || error.message.includes('too large')) {
          return {
            success: false,
            category: 'invalid_input',
            retryable: false,
            message: 'Image too complex or large',
            userMessage: 'This menu image is too large or complex to process.',
            fallbackMode: 'manual_entry',
            guidance: [
              'Try photographing the menu in smaller sections',
              'Ensure the image is clear and well-lit',
              'Crop out unnecessary parts of the image',
              'Use manual entry for this menu'
            ],
            technicalDetails: error.message
          }
        }
        return {
          success: false,
          category: 'invalid_input',
          retryable: false,
          message: 'Invalid request to extraction service',
          userMessage: 'There was a problem with your menu image.',
          fallbackMode: 'manual_entry',
          guidance: [
            'Ensure the image is a valid format (JPEG or PNG)',
            'Check that the image is not corrupted',
            'Try uploading a different image',
            'Use manual entry if the problem persists'
          ],
          technicalDetails: error.message
        }

      case 401: // Unauthorized
      case 403: // Forbidden
        return {
          success: false,
          category: 'api_error',
          retryable: false,
          message: 'Authentication error with extraction service',
          userMessage: 'There was an authentication problem. Please contact support.',
          fallbackMode: 'manual_entry',
          guidance: [
            'This is a system configuration issue',
            'Please contact support',
            'Use manual entry in the meantime'
          ],
          technicalDetails: error.message
        }

      case 500: // Internal server error
      case 502: // Bad gateway
      case 504: // Gateway timeout
        return {
          success: false,
          category: 'api_error',
          retryable: true,
          retryAfter: 30,
          message: 'Server error from extraction service',
          userMessage: 'The extraction service encountered an error. We\'ll retry automatically.',
          fallbackMode: 'retry',
          guidance: [
            'The service will retry automatically',
            'This is usually temporary',
            'Use manual entry if you need immediate results'
          ],
          technicalDetails: error.message
        }

      default:
        return {
          success: false,
          category: 'api_error',
          retryable: false,
          message: `HTTP error ${error.status}: ${error.message}`,
          userMessage: 'An error occurred while processing your menu.',
          fallbackMode: 'manual_entry',
          guidance: [
            'Please try again',
            'If the problem persists, use manual entry',
            'Contact support if you continue to have issues'
          ],
          technicalDetails: error.message
        }
    }
  }

  /**
   * Handle validation errors with partial data salvage
   */
  static handleValidationError(
    validationResult: ValidationResult,
    rawData: any,
    salvageAttempt?: {
      salvaged: Partial<ExtractionResult>
      itemsRecovered: number
      categoriesRecovered: number
    }
  ): ErrorResponse {
    // If we have salvaged data, return partial success
    if (salvageAttempt && salvageAttempt.itemsRecovered > 0) {
      return {
        success: true,
        partial: true,
        category: 'validation_error',
        retryable: false,
        message: `Validation errors occurred, but recovered ${salvageAttempt.itemsRecovered} items in ${salvageAttempt.categoriesRecovered} categories`,
        userMessage: `We extracted ${salvageAttempt.itemsRecovered} menu items, but some data may need review.`,
        fallbackMode: null,
        data: salvageAttempt.salvaged,
        warnings: validationResult.errors.map(e => `${e.path}: ${e.message}`),
        requiresReview: true,
        guidance: [
          'Please review the extracted items carefully',
          'Some items may have incomplete or incorrect data',
          'You can edit any item before publishing',
          'Consider retaking the photo for better results'
        ]
      }
    }

    // No salvageable data - complete failure
    const errorSummary = this.summarizeValidationErrors(validationResult.errors)
    
    return {
      success: false,
      category: 'validation_error',
      retryable: true,
      retryAfter: 0,
      message: `Validation failed: ${errorSummary}`,
      userMessage: 'The extraction returned invalid data. We\'ll try again with adjusted settings.',
      fallbackMode: 'retry',
      guidance: [
        'The system will retry automatically',
        'If retry fails, try retaking the photo',
        'Ensure the menu is clearly visible and well-lit',
        'Use manual entry if automatic extraction continues to fail'
      ],
      warnings: validationResult.errors.map(e => `${e.path}: ${e.message}`),
      technicalDetails: JSON.stringify(validationResult.errors, null, 2)
    }
  }

  /**
   * Assess image quality based on confidence scores
   */
  static assessImageQuality(result: ExtractionResult): ImageQualityAssessment {
    const confidences: number[] = []
    const issues: string[] = []
    const recommendations: string[] = []

    // Collect all confidence scores
    result.menu.categories.forEach(cat => {
      confidences.push(cat.confidence)
      cat.items.forEach(item => {
        confidences.push(item.confidence)
      })
      
      // Recursively check subcategories
      this.collectConfidencesRecursive(cat.subcategories || [], confidences)
    })

    // Calculate overall confidence
    const overallConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0

    // Determine quality level
    let quality: ImageQualityAssessment['quality']
    let canProceed = true

    if (overallConfidence >= 0.9) {
      quality = 'excellent'
    } else if (overallConfidence >= 0.75) {
      quality = 'good'
    } else if (overallConfidence >= 0.6) {
      quality = 'fair'
      issues.push('Some items have moderate confidence scores')
      recommendations.push('Review items with yellow confidence indicators')
    } else if (overallConfidence >= 0.3) {
      quality = 'poor'
      issues.push('Many items have low confidence scores')
      issues.push('Image quality may be insufficient')
      recommendations.push('Consider retaking the photo with better lighting')
      recommendations.push('Ensure the menu is in focus and clearly visible')
      recommendations.push('Review all extracted items carefully')
    } else {
      quality = 'unacceptable'
      canProceed = false
      issues.push('Confidence scores are too low for reliable extraction')
      issues.push('Image quality is insufficient')
      recommendations.push('Retake the photo with better lighting')
      recommendations.push('Hold the camera steady to avoid blur')
      recommendations.push('Ensure the menu fills most of the frame')
      recommendations.push('Avoid glare and shadows')
      recommendations.push('Consider using manual entry instead')
    }

    // Check for high number of uncertain items
    if (result.uncertainItems.length > 5) {
      issues.push(`${result.uncertainItems.length} items could not be extracted with confidence`)
      recommendations.push('Review uncertain items in the review panel')
      if (result.uncertainItems.length > 10) {
        recommendations.push('Consider retaking the photo for better results')
      }
    }

    // Check for empty categories
    const emptyCategories = result.menu.categories.filter(
      cat => cat.items.length === 0 && (!cat.subcategories || cat.subcategories.length === 0)
    )
    if (emptyCategories.length > 0) {
      issues.push(`${emptyCategories.length} categories have no items`)
      recommendations.push('Check if any menu sections were missed')
    }

    return {
      overallConfidence,
      quality,
      issues,
      recommendations,
      canProceed
    }
  }

  /**
   * Handle image quality issues
   */
  static handleImageQualityIssue(
    assessment: ImageQualityAssessment
  ): ErrorResponse | null {
    // If quality is acceptable, return null (no error)
    if (assessment.quality === 'excellent' || assessment.quality === 'good') {
      return null
    }

    // Unacceptable quality - reject extraction
    if (assessment.quality === 'unacceptable') {
      return {
        success: false,
        category: 'image_quality',
        retryable: false,
        message: `Image quality too low (confidence: ${assessment.overallConfidence.toFixed(2)})`,
        userMessage: 'The image quality is too low for reliable extraction.',
        fallbackMode: 'manual_entry',
        guidance: assessment.recommendations,
        requiresReview: false
      }
    }

    // Fair or poor quality - allow but require review
    return {
      success: true,
      partial: true,
      category: 'image_quality',
      retryable: false,
      message: `Extraction completed with ${assessment.quality} quality (confidence: ${assessment.overallConfidence.toFixed(2)})`,
      userMessage: `Extraction completed, but image quality was ${assessment.quality}. Please review carefully.`,
      fallbackMode: null,
      guidance: assessment.recommendations,
      warnings: assessment.issues,
      requiresReview: true
    }
  }

  /**
   * Handle quota exceeded errors
   */
  static handleQuotaExceeded(
    currentUsage: number,
    limit: number,
    resetDate?: Date
  ): ErrorResponse {
    const resetInfo = resetDate
      ? ` Your quota resets on ${resetDate.toLocaleDateString()}.`
      : ''

    return {
      success: false,
      category: 'quota_exceeded',
      retryable: false,
      message: `Extraction quota exceeded (${currentUsage}/${limit})`,
      userMessage: `You've reached your extraction limit (${currentUsage}/${limit}).${resetInfo}`,
      fallbackMode: 'manual_entry',
      guidance: [
        'Upgrade your plan for more extractions',
        'Use manual entry for this menu',
        resetDate ? `Your quota resets on ${resetDate.toLocaleDateString()}` : 'Your quota resets monthly'
      ]
    }
  }

  /**
   * Create a user-friendly error message for display
   */
  static createUserFriendlyMessage(error: ErrorResponse): {
    title: string
    message: string
    actions: Array<{ label: string; action: string }>
  } {
    let title: string
    let actions: Array<{ label: string; action: string }> = []

    switch (error.category) {
      case 'api_error':
        title = 'Service Error'
        if (error.retryable) {
          actions.push({ label: 'Retry', action: 'retry' })
        }
        actions.push({ label: 'Manual Entry', action: 'manual_entry' })
        break

      case 'validation_error':
        title = error.partial ? 'Partial Extraction' : 'Extraction Failed'
        if (error.retryable) {
          actions.push({ label: 'Retry', action: 'retry' })
        }
        if (error.partial) {
          actions.push({ label: 'Review Items', action: 'review' })
        }
        actions.push({ label: 'Manual Entry', action: 'manual_entry' })
        break

      case 'image_quality':
        title = error.success ? 'Review Required' : 'Poor Image Quality'
        if (error.success) {
          actions.push({ label: 'Review Items', action: 'review' })
        } else {
          actions.push({ label: 'Retake Photo', action: 'retake' })
          actions.push({ label: 'Manual Entry', action: 'manual_entry' })
        }
        break

      case 'quota_exceeded':
        title = 'Quota Exceeded'
        actions.push({ label: 'Upgrade Plan', action: 'upgrade' })
        actions.push({ label: 'Manual Entry', action: 'manual_entry' })
        break

      case 'invalid_input':
        title = 'Invalid Image'
        actions.push({ label: 'Try Different Image', action: 'retake' })
        actions.push({ label: 'Manual Entry', action: 'manual_entry' })
        break

      default:
        title = 'Extraction Error'
        actions.push({ label: 'Try Again', action: 'retry' })
        actions.push({ label: 'Manual Entry', action: 'manual_entry' })
    }

    return {
      title,
      message: error.userMessage,
      actions
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private static extractRetryAfter(error: HttpError): number | undefined {
    // Try to extract Retry-After header value from error body
    if (error.body && typeof error.body === 'object') {
      const body = error.body as any
      if (body.retryAfter) return Number(body.retryAfter)
      if (body.retry_after) return Number(body.retry_after)
    }
    return undefined
  }

  private static summarizeValidationErrors(errors: Array<{ path: string; message: string }>): string {
    if (errors.length === 0) return 'Unknown validation error'
    if (errors.length === 1) return errors[0].message
    
    // Group errors by path prefix
    const grouped = new Map<string, number>()
    errors.forEach(err => {
      const prefix = err.path.split('.')[0] || 'root'
      grouped.set(prefix, (grouped.get(prefix) || 0) + 1)
    })

    const summary = Array.from(grouped.entries())
      .map(([path, count]) => `${count} error(s) in ${path}`)
      .join(', ')

    return summary
  }

  private static collectConfidencesRecursive(categories: any[], confidences: number[]): void {
    categories.forEach(cat => {
      if (cat.confidence !== undefined) {
        confidences.push(cat.confidence)
      }
      if (cat.items) {
        cat.items.forEach((item: any) => {
          if (item.confidence !== undefined) {
            confidences.push(item.confidence)
          }
        })
      }
      if (cat.subcategories) {
        this.collectConfidencesRecursive(cat.subcategories, confidences)
      }
    })
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Validate extraction result and handle errors
 */
export function validateAndHandleErrors(
  validationResult: ValidationResult,
  rawData: any,
  salvageAttempt?: {
    salvaged: Partial<ExtractionResult>
    itemsRecovered: number
    categoriesRecovered: number
  }
): ErrorResponse | null {
  if (validationResult.valid && validationResult.data) {
    // Check image quality
    const assessment = ExtractionErrorHandler.assessImageQuality(validationResult.data)
    return ExtractionErrorHandler.handleImageQualityIssue(assessment)
  }

  // Validation failed
  return ExtractionErrorHandler.handleValidationError(
    validationResult,
    rawData,
    salvageAttempt
  )
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: ErrorResponse): boolean {
  return error.retryable
}

/**
 * Get retry delay in milliseconds
 */
export function getRetryDelay(error: ErrorResponse): number {
  return (error.retryAfter || 0) * 1000
}

/**
 * Check if manual entry fallback should be offered
 */
export function shouldOfferManualEntry(error: ErrorResponse): boolean {
  return error.fallbackMode === 'manual_entry' || !error.retryable
}
