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
    // Default to Gemini image generation endpoint; allow override via env
    this.baseUrl = process.env.NANO_BANANA_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
    
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
      
      // Translate our simplified params into Gemini generateContent request
      const candidateCount = Math.min(Math.max(requestParams.number_of_images || 1, 1), 4)

      let promptText = requestParams.prompt
      if (requestParams.negative_prompt) {
        promptText += `\nExclude: ${requestParams.negative_prompt}`
      }
      if (requestParams.aspect_ratio) {
        promptText += `\nAspect ratio: ${requestParams.aspect_ratio}`
      }
      if (requestParams.person_generation === 'dont_allow') {
        promptText += `\nNo people in the image.`
      }
      if (requestParams.safety_filter_level) {
        promptText += `\nContent safety: ${requestParams.safety_filter_level}`
      }

      const requestBody: any = {
        contents: [{
          role: 'user',
          parts: [{ text: `Generate an image of: ${promptText}` }]
        }],
        generationConfig: {
          responseModalities: ['image'],
          candidateCount
        }
      }

      // Build URL with API key as query param per Gemini requirements
      const url = new URL(this.baseUrl)
      url.searchParams.set('key', this.apiKey)

      // Make the API request
      const apiResponse = await fetchJsonWithRetry<any>(
        url.toString(),
        {
          method: 'POST',
          headers: {
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

      // Parse Gemini response → base64 images array
      const images: string[] = []
      const candidates = apiResponse?.candidates || []
      for (const cand of candidates) {
        const parts = cand?.content?.parts || []
        for (const part of parts) {
          const inline = part?.inlineData
          if (inline?.data) {
            images.push(inline.data)
          }
        }
      }

      if (images.length === 0) {
        throw new NanoBananaError(
          'No images returned from API',
          'NO_IMAGES_RETURNED'
        )
      }

      return {
        images,
        metadata: {
          processingTime: apiResponse?.metadata?.processing_time_ms || 0,
          modelVersion: apiResponse?.metadata?.model_version || 'gemini-2.5-flash-image',
          safetyFilterApplied: apiResponse?.metadata?.safety_filter_applied,
          filterReason: apiResponse?.metadata?.filter_reason
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
    // Gemini API doesn't expose a simple rate-limit endpoint; return defaults
    return {
      remaining: 100,
      reset_time: Date.now() + 3600000,
      limit: 100
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