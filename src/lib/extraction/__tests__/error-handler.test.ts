/**
 * Tests for Error Handler
 * 
 * Tests comprehensive error handling including:
 * - API error handling (rate limiting, service unavailable, etc.)
 * - Validation error handling with partial data salvage
 * - Image quality assessment
 * - User-friendly error messages
 */

import { describe, it, expect } from '@jest/globals'
import { HttpError } from '../../retry'
import {
  ExtractionErrorHandler,
  validateAndHandleErrors,
  isRetryableError,
  getRetryDelay,
  shouldOfferManualEntry,
  type ErrorResponse,
  type ImageQualityAssessment
} from '../error-handler'
import type { ValidationResult } from '../schema-validator'
import type { ExtractionResult } from '../schema-stage1'

describe('ExtractionErrorHandler', () => {
  describe('handleVisionAPIError', () => {
    it('should handle rate limiting (429) errors', () => {
      const error = new HttpError('Rate limit exceeded', 429)
      const response = ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.category).toBe('api_error')
      expect(response.retryable).toBe(true)
      expect(response.retryAfter).toBeGreaterThan(0)
      expect(response.fallbackMode).toBe('retry')
      expect(response.userMessage).toContain('Too many extraction requests')
    })

    it('should handle service unavailable (503) errors', () => {
      const error = new HttpError('Service unavailable', 503)
      const response = ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.category).toBe('api_error')
      expect(response.retryable).toBe(true)
      expect(response.retryAfter).toBe(30)
      expect(response.fallbackMode).toBe('retry')
      expect(response.userMessage).toContain('temporarily unavailable')
    })

    it('should handle token limit exceeded (400) errors', () => {
      const error = new HttpError('Token limit exceeded', 400)
      const response = ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.category).toBe('invalid_input')
      expect(response.retryable).toBe(false)
      expect(response.fallbackMode).toBe('manual_entry')
      expect(response.userMessage).toContain('problem with your menu image')
      expect(response.guidance?.some(g => g.includes('valid format'))).toBe(true)
    })

    it('should handle authentication errors (401)', () => {
      const error = new HttpError('Unauthorized', 401)
      const response = ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.category).toBe('api_error')
      expect(response.retryable).toBe(false)
      expect(response.fallbackMode).toBe('manual_entry')
      expect(response.userMessage).toContain('authentication problem')
    })

    it('should handle server errors (500)', () => {
      const error = new HttpError('Internal server error', 500)
      const response = ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.category).toBe('api_error')
      expect(response.retryable).toBe(true)
      expect(response.fallbackMode).toBe('retry')
    })

    it('should handle network errors', () => {
      const error = new TypeError('fetch failed')
      const response = ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.category).toBe('api_error')
      expect(response.retryable).toBe(true)
      expect(response.userMessage).toContain('internet connection')
    })

    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong')
      const response = ExtractionErrorHandler.handleVisionAPIError(error)

      expect(response.success).toBe(false)
      expect(response.category).toBe('unknown_error')
      expect(response.retryable).toBe(false)
      expect(response.fallbackMode).toBe('manual_entry')
    })
  })

  describe('handleValidationError', () => {
    it('should return partial success when data is salvaged', () => {
      const validationResult: ValidationResult = {
        valid: false,
        errors: [
          { path: 'menu.categories[0].items[0]', message: 'Invalid price', code: 'invalid_type' }
        ],
        warnings: []
      }

      const salvageAttempt = {
        salvaged: {
          menu: {
            categories: [
              {
                name: 'Appetizers',
                items: [
                  { name: 'Spring Rolls', price: 8, confidence: 0.9 }
                ],
                confidence: 0.9
              }
            ]
          },
          currency: 'SGD',
          uncertainItems: [],
          superfluousText: []
        },
        itemsRecovered: 1,
        categoriesRecovered: 1
      }

      const response = ExtractionErrorHandler.handleValidationError(
        validationResult,
        {},
        salvageAttempt
      )

      expect(response.success).toBe(true)
      expect(response.partial).toBe(true)
      expect(response.category).toBe('validation_error')
      expect(response.data).toBeDefined()
      expect(response.requiresReview).toBe(true)
      expect(response.userMessage).toContain('1 menu items')
    })

    it('should return failure when no data is salvaged', () => {
      const validationResult: ValidationResult = {
        valid: false,
        errors: [
          { path: 'menu', message: 'Required', code: 'invalid_type' }
        ],
        warnings: []
      }

      const response = ExtractionErrorHandler.handleValidationError(
        validationResult,
        {}
      )

      expect(response.success).toBe(false)
      expect(response.category).toBe('validation_error')
      expect(response.retryable).toBe(true)
      expect(response.fallbackMode).toBe('retry')
      expect(response.userMessage).toContain('invalid data')
    })
  })

  describe('assessImageQuality', () => {
    it('should assess excellent quality (confidence >= 0.9)', () => {
      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Main Dishes',
              items: [
                { name: 'Pasta', price: 15, confidence: 0.95 },
                { name: 'Pizza', price: 18, confidence: 0.92 }
              ],
              confidence: 0.93
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const assessment = ExtractionErrorHandler.assessImageQuality(result)

      expect(assessment.quality).toBe('excellent')
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0.9)
      expect(assessment.canProceed).toBe(true)
      expect(assessment.issues).toHaveLength(0)
    })

    it('should assess good quality (confidence >= 0.75)', () => {
      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Main Dishes',
              items: [
                { name: 'Pasta', price: 15, confidence: 0.8 },
                { name: 'Pizza', price: 18, confidence: 0.78 }
              ],
              confidence: 0.82
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const assessment = ExtractionErrorHandler.assessImageQuality(result)

      expect(assessment.quality).toBe('good')
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0.75)
      expect(assessment.canProceed).toBe(true)
    })

    it('should assess fair quality (confidence >= 0.6)', () => {
      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Main Dishes',
              items: [
                { name: 'Pasta', price: 15, confidence: 0.65 },
                { name: 'Pizza', price: 18, confidence: 0.68 }
              ],
              confidence: 0.7
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const assessment = ExtractionErrorHandler.assessImageQuality(result)

      expect(assessment.quality).toBe('fair')
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0.6)
      expect(assessment.canProceed).toBe(true)
      expect(assessment.issues.length).toBeGreaterThan(0)
      expect(assessment.recommendations.length).toBeGreaterThan(0)
    })

    it('should assess poor quality (confidence >= 0.3)', () => {
      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Main Dishes',
              items: [
                { name: 'Pasta', price: 15, confidence: 0.4 },
                { name: 'Pizza', price: 18, confidence: 0.45 }
              ],
              confidence: 0.5
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const assessment = ExtractionErrorHandler.assessImageQuality(result)

      expect(assessment.quality).toBe('poor')
      expect(assessment.overallConfidence).toBeGreaterThanOrEqual(0.3)
      expect(assessment.canProceed).toBe(true)
      expect(assessment.issues.length).toBeGreaterThan(0)
      expect(assessment.recommendations).toContain('Consider retaking the photo with better lighting')
    })

    it('should assess unacceptable quality (confidence < 0.3)', () => {
      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Main Dishes',
              items: [
                { name: 'Pasta', price: 15, confidence: 0.2 },
                { name: 'Pizza', price: 18, confidence: 0.25 }
              ],
              confidence: 0.28
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const assessment = ExtractionErrorHandler.assessImageQuality(result)

      expect(assessment.quality).toBe('unacceptable')
      expect(assessment.overallConfidence).toBeLessThan(0.3)
      expect(assessment.canProceed).toBe(false)
      expect(assessment.recommendations).toContain('Retake the photo with better lighting')
    })

    it('should flag high number of uncertain items', () => {
      const result: ExtractionResult = {
        menu: {
          categories: [
            {
              name: 'Main Dishes',
              items: [
                { name: 'Pasta', price: 15, confidence: 0.9 }
              ],
              confidence: 0.9
            }
          ]
        },
        currency: 'USD',
        uncertainItems: Array(8).fill({
          text: 'unclear text',
          reason: 'blurry',
          confidence: 0.3
        }),
        superfluousText: []
      }

      const assessment = ExtractionErrorHandler.assessImageQuality(result)

      expect(assessment.issues.some(issue => issue.includes('8 items could not be extracted'))).toBe(true)
      expect(assessment.recommendations.some(rec => rec.includes('Review uncertain items'))).toBe(true)
    })
  })

  describe('handleImageQualityIssue', () => {
    it('should return null for excellent quality', () => {
      const assessment: ImageQualityAssessment = {
        overallConfidence: 0.95,
        quality: 'excellent',
        issues: [],
        recommendations: [],
        canProceed: true
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response).toBeNull()
    })

    it('should return null for good quality', () => {
      const assessment: ImageQualityAssessment = {
        overallConfidence: 0.8,
        quality: 'good',
        issues: [],
        recommendations: [],
        canProceed: true
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response).toBeNull()
    })

    it('should return warning for fair quality', () => {
      const assessment: ImageQualityAssessment = {
        overallConfidence: 0.65,
        quality: 'fair',
        issues: ['Some items have moderate confidence'],
        recommendations: ['Review items carefully'],
        canProceed: true
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response).not.toBeNull()
      expect(response!.success).toBe(true)
      expect(response!.partial).toBe(true)
      expect(response!.requiresReview).toBe(true)
      expect(response!.userMessage).toContain('fair')
    })

    it('should return error for unacceptable quality', () => {
      const assessment: ImageQualityAssessment = {
        overallConfidence: 0.25,
        quality: 'unacceptable',
        issues: ['Confidence too low'],
        recommendations: ['Retake photo'],
        canProceed: false
      }

      const response = ExtractionErrorHandler.handleImageQualityIssue(assessment)

      expect(response).not.toBeNull()
      expect(response!.success).toBe(false)
      expect(response!.category).toBe('image_quality')
      expect(response!.fallbackMode).toBe('manual_entry')
      expect(response!.userMessage).toContain('too low')
    })
  })

  describe('handleQuotaExceeded', () => {
    it('should handle quota exceeded without reset date', () => {
      const response = ExtractionErrorHandler.handleQuotaExceeded(10, 10)

      expect(response.success).toBe(false)
      expect(response.category).toBe('quota_exceeded')
      expect(response.retryable).toBe(false)
      expect(response.fallbackMode).toBe('manual_entry')
      expect(response.userMessage).toContain('10/10')
      expect(response.guidance?.some(g => g.includes('Upgrade your plan'))).toBe(true)
    })

    it('should handle quota exceeded with reset date', () => {
      const resetDate = new Date('2024-02-01')
      const response = ExtractionErrorHandler.handleQuotaExceeded(5, 5, resetDate)

      expect(response.success).toBe(false)
      expect(response.userMessage).toContain(resetDate.toLocaleDateString())
      expect(response.guidance?.some(g => g.includes(resetDate.toLocaleDateString()))).toBe(true)
    })
  })

  describe('createUserFriendlyMessage', () => {
    it('should create message for API error', () => {
      const error: ErrorResponse = {
        success: false,
        category: 'api_error',
        retryable: true,
        message: 'Rate limit',
        userMessage: 'Too many requests',
        fallbackMode: 'retry'
      }

      const message = ExtractionErrorHandler.createUserFriendlyMessage(error)

      expect(message.title).toBe('Service Error')
      expect(message.message).toBe('Too many requests')
      expect(message.actions.some(a => a.action === 'retry')).toBe(true)
      expect(message.actions.some(a => a.action === 'manual_entry')).toBe(true)
    })

    it('should create message for validation error with partial data', () => {
      const error: ErrorResponse = {
        success: true,
        partial: true,
        category: 'validation_error',
        retryable: false,
        message: 'Partial extraction',
        userMessage: 'Some items extracted',
        fallbackMode: null
      }

      const message = ExtractionErrorHandler.createUserFriendlyMessage(error)

      expect(message.title).toBe('Partial Extraction')
      expect(message.actions.some(a => a.action === 'review')).toBe(true)
    })

    it('should create message for image quality issue', () => {
      const error: ErrorResponse = {
        success: false,
        category: 'image_quality',
        retryable: false,
        message: 'Poor quality',
        userMessage: 'Image quality too low',
        fallbackMode: 'manual_entry'
      }

      const message = ExtractionErrorHandler.createUserFriendlyMessage(error)

      expect(message.title).toBe('Poor Image Quality')
      expect(message.actions.some(a => a.action === 'retake')).toBe(true)
      expect(message.actions.some(a => a.action === 'manual_entry')).toBe(true)
    })

    it('should create message for quota exceeded', () => {
      const error: ErrorResponse = {
        success: false,
        category: 'quota_exceeded',
        retryable: false,
        message: 'Quota exceeded',
        userMessage: 'Limit reached',
        fallbackMode: 'manual_entry'
      }

      const message = ExtractionErrorHandler.createUserFriendlyMessage(error)

      expect(message.title).toBe('Quota Exceeded')
      expect(message.actions.some(a => a.action === 'upgrade')).toBe(true)
    })
  })

  describe('Convenience functions', () => {
    it('isRetryableError should identify retryable errors', () => {
      const retryable: ErrorResponse = {
        success: false,
        category: 'api_error',
        retryable: true,
        message: 'Error',
        userMessage: 'Error',
        fallbackMode: 'retry'
      }

      const notRetryable: ErrorResponse = {
        success: false,
        category: 'quota_exceeded',
        retryable: false,
        message: 'Error',
        userMessage: 'Error',
        fallbackMode: 'manual_entry'
      }

      expect(isRetryableError(retryable)).toBe(true)
      expect(isRetryableError(notRetryable)).toBe(false)
    })

    it('getRetryDelay should return delay in milliseconds', () => {
      const error: ErrorResponse = {
        success: false,
        category: 'api_error',
        retryable: true,
        retryAfter: 60,
        message: 'Error',
        userMessage: 'Error',
        fallbackMode: 'retry'
      }

      expect(getRetryDelay(error)).toBe(60000)
    })

    it('shouldOfferManualEntry should identify when to offer manual entry', () => {
      const withManualEntry: ErrorResponse = {
        success: false,
        category: 'quota_exceeded',
        retryable: false,
        message: 'Error',
        userMessage: 'Error',
        fallbackMode: 'manual_entry'
      }

      const withRetry: ErrorResponse = {
        success: false,
        category: 'api_error',
        retryable: true,
        message: 'Error',
        userMessage: 'Error',
        fallbackMode: 'retry'
      }

      expect(shouldOfferManualEntry(withManualEntry)).toBe(true)
      expect(shouldOfferManualEntry(withRetry)).toBe(false)
    })
  })
})
