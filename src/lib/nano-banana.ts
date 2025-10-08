import { fetchJsonWithRetry, HttpError } from './retry'
import type { NanoBananaParams, GenerationError } from '@/types'

// Nano Banana API response types
interface NanoBananaResponse {
  success: boolean
  images?: string[] // base64 encoded images
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    processing_time_ms: number
    model_version: string
    safety_filter_applied?: boolean
    filter_reason?: string
  }
}

interface NanoBananaRateLimitInfo {
  remaining: number
  reset_time: number
  limit: number
}

export class NanoBananaError extends Error {
  code: string
  status?: number
  retryAfter?: number
  filterReason?: string
  suggestions?: string[]

  constructor(
    message: string,
    code: string,
    status?: number,
    retryAfter?: number,
    filterReason?: string
  ) {
    super(message)
    this.name = 'NanoBananaError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
    this.filterReason = filterReason
    this.suggestions = this.generateSuggestions(code, filterReason)
  }

  private generateSuggestions(code: string, filterReason?: string): string[] {
    const suggestions: Record<string, string[]> = {
      'CONTENT_POLICY_VIOLATION': [
        'Add more details about the dish ingredients',
        'Specify the plating style (e.g., "on a white plate")',
        'Use the negative prompt to exclude unwanted elements'
      ],
      'SAFETY_FILTER_BLOCKED': {
        'person_detected': [
          'Set "No people" in generation settings',
          'Focus description on the food only',
          'Use negative prompt: "people, person, human"'
        ],
        'text_detected': [
          'Remove any text references from description',
          'Use negative prompt: "text, words, letters, watermark"'
        ],
        'inappropriate_content': [
          'Use more neutral, descriptive language',
          'Focus on food presentation and ingredients'
        ]
      }[filterReason || ''] || [
        'Try simplifying your description',
        'Focus on the food and presentation only'
      ],
      'RATE_LIMIT_EXCEEDED': [
        'Wait a moment and try again',
        'Consider reducing the number of variations requested'
      ],
      'PROMPT_TOO_LONG': [
        'Shorten your description',
        'Remove unnecessary details',
        'Focus on the most important aspects of the dish'
      ]
    }

    return suggestions[code] || ['Please try again with a different description']
  }
}

export class NanoBananaClient {
  private apiKey: string
  private baseUrl: string
  private defaultParams: Partial<NanoBananaParams>

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NANO_BANANA_API_KEY || ''
    // Use env-provided base URL when available (test expects this)
    this.baseUrl = process.env.NANO_BANANA_BASE_URL || 'https://api.nanobanana.com/v1'
    
    if (!this.apiKey) {
      throw new Error('Nano Banana API key is required')
    }

    // Set sensible defaults for food image generation
    this.defaultParams = {
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow',
      number_of_images: 1,
      aspect_ratio: '1:1'
    }
  }

  /**
   * Generate images using the Nano Banana API
   */
  async generateImage(params: NanoBananaParams): Promise<{
    images: string[]
    metadata: {
      processingTime: number
      modelVersion: string
      safetyFilterApplied?: boolean
      filterReason?: string
    }
  }> {
    // Merge with defaults
    const requestParams = {
      ...this.defaultParams,
      ...params
    }

    // Validate parameters
    this.validateParams(requestParams)

    try {
      console.log('🎨 [Nano Banana] Generating image with prompt:', requestParams.prompt.substring(0, 100))
      
      // Build the request body expected by Nano Banana API
      const requestBody: any = {
        prompt: requestParams.prompt,
        negative_prompt: requestParams.negative_prompt,
        aspect_ratio: requestParams.aspect_ratio,
        number_of_images: requestParams.number_of_images,
        safety_filter_level: requestParams.safety_filter_level,
        person_generation: requestParams.person_generation
      }

      // Make the API request
      const apiResponse = await fetchJsonWithRetry<NanoBananaResponse>(
        `${this.baseUrl}/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'OneMinuteMenu/1.0'
          },
          body: JSON.stringify(requestBody)
        },
        {
          retries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          timeoutMs: 60000 // 60 seconds for image generation
        }
      )

      // Use API response directly (tests mock this shape)
      const response = apiResponse

      if (!response.success) {
        throw this.createErrorFromResponse(response)
      }

      if (!response.images || response.images.length === 0) {
        throw new NanoBananaError(
          'No images returned from API',
          'NO_IMAGES_RETURNED'
        )
      }

      return {
        images: response.images,
        metadata: {
          processingTime: response.metadata?.processing_time_ms || 0,
          modelVersion: response.metadata?.model_version || 'unknown',
          safetyFilterApplied: response.metadata?.safety_filter_applied,
          filterReason: response.metadata?.filter_reason
        }
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw this.handleHttpError(error)
      }
      throw error
    }
  }

  /**
   * Check current rate limit status
   * Note: Imagen API doesn't provide a dedicated rate limit endpoint
   * This returns estimated values based on typical quotas
   */
  async checkRateLimit(): Promise<NanoBananaRateLimitInfo> {
    try {
      const response = await fetchJsonWithRetry<{ rate_limit: NanoBananaRateLimitInfo }>(
        `${this.baseUrl}/rate-limit`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        },
        {
          retries: 2,
          timeoutMs: 5000
        }
      )
      return response.rate_limit
    } catch (_) {
      // Fallback defaults
      return {
        remaining: 100,
        reset_time: Date.now() + 3600000,
        limit: 100
      }
    }
  }

  /**
   * Validate generation parameters
   */
  private validateParams(params: NanoBananaParams): void {
    if (!params.prompt || params.prompt.trim().length === 0) {
      throw new NanoBananaError(
        'Prompt is required',
        'INVALID_PARAMS'
      )
    }

    if (params.prompt.length > 2000) {
      throw new NanoBananaError(
        'Prompt is too long (max 2000 characters)',
        'PROMPT_TOO_LONG'
      )
    }

    if (params.number_of_images && (params.number_of_images < 1 || params.number_of_images > 4)) {
      throw new NanoBananaError(
        'Number of images must be between 1 and 4',
        'INVALID_PARAMS'
      )
    }

    const validAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4']
    if (params.aspect_ratio && !validAspectRatios.includes(params.aspect_ratio)) {
      throw new NanoBananaError(
        `Invalid aspect ratio. Must be one of: ${validAspectRatios.join(', ')}`,
        'INVALID_PARAMS'
      )
    }

    const validSafetyLevels = ['block_none', 'block_some', 'block_most']
    if (params.safety_filter_level && !validSafetyLevels.includes(params.safety_filter_level)) {
      throw new NanoBananaError(
        `Invalid safety filter level. Must be one of: ${validSafetyLevels.join(', ')}`,
        'INVALID_PARAMS'
      )
    }

    const validPersonGeneration = ['allow', 'dont_allow']
    if (params.person_generation && !validPersonGeneration.includes(params.person_generation)) {
      throw new NanoBananaError(
        `Invalid person generation setting. Must be one of: ${validPersonGeneration.join(', ')}`,
        'INVALID_PARAMS'
      )
    }
  }

  /**
   * Create appropriate error from API response
   */
  private createErrorFromResponse(response: NanoBananaResponse): NanoBananaError {
    const error = response.error
    if (!error) {
      return new NanoBananaError('Unknown API error', 'UNKNOWN_ERROR')
    }

    return new NanoBananaError(
      error.message,
      error.code,
      undefined,
      undefined,
      error.details?.filter_reason
    )
  }

  /**
   * Handle HTTP errors and convert to appropriate NanoBananaError
   */
  private handleHttpError(error: HttpError): NanoBananaError {
    switch (error.status) {
      case 400:
        return new NanoBananaError(
          error.message || 'Invalid request parameters',
          'INVALID_PARAMS',
          400
        )
      
      case 401:
        return new NanoBananaError(
          'Invalid API key or authentication failed',
          'AUTHENTICATION_ERROR',
          401
        )
      
      case 403:
        return new NanoBananaError(
          'Content policy violation or forbidden request',
          'CONTENT_POLICY_VIOLATION',
          403
        )
      
      case 429:
        // Extract retry-after header if available
        const retryAfter = this.extractRetryAfter(error)
        return new NanoBananaError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          429,
          retryAfter
        )
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new NanoBananaError(
          'Service temporarily unavailable',
          'SERVICE_UNAVAILABLE',
          error.status
        )
      
      default:
        return new NanoBananaError(
          error.message || 'Network error occurred',
          'NETWORK_ERROR',
          error.status
        )
    }
  }

  /**
   * Extract retry-after value from error response
   */
  private extractRetryAfter(error: HttpError): number | undefined {
    if (error.body && typeof error.body === 'object') {
      const body = error.body as any
      if (body.retry_after) {
        return parseInt(body.retry_after, 10)
      }
    }
    return undefined
  }
}

// Singleton instance for use across the application
let nanoBananaClient: NanoBananaClient | null = null

export function getNanoBananaClient(): NanoBananaClient {
  if (!nanoBananaClient) {
    nanoBananaClient = new NanoBananaClient()
  }
  return nanoBananaClient
}

// Helper function to create generation error from NanoBananaError
export function createGenerationError(error: NanoBananaError): GenerationError {
  return {
    code: error.code,
    message: error.message,
    suggestions: error.suggestions,
    retryable: ['RATE_LIMIT_EXCEEDED', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR'].includes(error.code)
  }
}