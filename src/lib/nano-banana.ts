import { fetchJsonWithRetry, HttpError } from './retry'
import type { NanoBananaParams, GenerationError } from '@/types'
import { logger } from '@/lib/logger'
import { createHash } from 'crypto'

interface NanoBananaRateLimitInfo {
  remaining: number;
  reset_time: number;
  limit: number;
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
        'Try using more descriptive, neutral language',
        'Focus on visual elements like colors, textures, and composition',
        'Avoid potentially sensitive or controversial topics',
        'Be more specific about the style and appearance you want',
        'Add more details about the dish ingredients',
        'Specify the plating style (e.g., "on a white plate")'
      ],
      'SAFETY_FILTER_BLOCKED': {
        'person_detected': [
          'Set "No people" in generation settings',
          'Focus description on objects, landscapes, or abstract concepts',
          'Use negative prompt: "people, person, human"',
          'Focus description on the food only'
        ],
        'text_detected': [
          'Remove any text references from description',
          'Use negative prompt: "text, words, letters, watermark"'
        ],
        'inappropriate_content': [
          'Use more neutral, descriptive language',
          'Focus on visual aesthetics and composition'
        ],
        'content_filtered': [
          'Try rephrasing your prompt with different words',
          'Focus on visual elements like colors, shapes, and textures',
          'Avoid potentially sensitive terms or concepts'
        ],
        'safety_filtered': [
          'Modify your prompt to avoid potentially harmful content',
          'Use more neutral, descriptive language',
          'Focus on safe, general visual concepts'
        ]
      }[filterReason || ''] || [
        'Try simplifying your description',
        'Focus on visual elements and composition only'
      ],
      'GENERATION_FAILED': [
        'Try a different prompt with clearer visual descriptions',
        'Simplify your request and focus on key visual elements',
        'Check that your prompt describes something that can be visualized'
      ],
      'RATE_LIMIT_EXCEEDED': [
        'Wait a moment and try again',
        'Consider reducing the number of variations requested'
      ],
      'PROMPT_TOO_LONG': [
        'Shorten your description',
        'Remove unnecessary details',
        'Focus on the most important visual aspects'
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

    // Determine model and base URL
    const model = requestParams.model || 'gemini-2.5-flash-image'
    const baseUrl = params.model 
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      : this.baseUrl

    // Validate parameters
    this.validateParams(requestParams)

    try {
      const promptPreview = requestParams.prompt.substring(0, 120)
      const promptHash = createHash('sha256').update(requestParams.prompt).digest('hex')
      const hasRef = !!(requestParams.reference_images && requestParams.reference_images.length > 0)
      const refMeta = hasRef
        ? requestParams.reference_images!.map((img) => ({ mimeType: img.mimeType, bytes: Buffer.from(img.data, 'base64').length }))
        : []

      // Important: never log reference image bytes; prompts can be logged for learning.
      logger.info('🎨 [Nano Banana] Outbound request', {
        model,
        candidateCount: Math.min(Math.max(requestParams.number_of_images || 1, 1), 4),
        aspectRatio: requestParams.aspect_ratio,
        imageSize: requestParams.image_size,
        hasReferenceImages: hasRef,
        referenceMode: requestParams.reference_mode || null,
        referenceImages: refMeta,
        promptHash,
        promptPreview,
        promptLength: requestParams.prompt.length,
      })
      
      // Translate our simplified params into Gemini generateContent request
      const candidateCount = Math.min(Math.max(requestParams.number_of_images || 1, 1), 4)

      let promptText = requestParams.prompt

      // If reference images are provided, guide the model with explicit instructions.
      // We use the "Image A/B/C" syntax recommended for Nano Banana Pro.
      if (requestParams.reference_images && requestParams.reference_images.length > 0) {
        const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']
        const roleInstructions: string[] = []
        
        for (let i = 0; i < requestParams.reference_images.length; i++) {
          const r = requestParams.reference_images[i]
          const label = alphabet[i]
          const role = r.role || 'other'
          const comment = r.comment ? `. Instruction: ${r.comment}` : ''
          
          let roleDesc = ''
          if (role === 'dish') roleDesc = 'the primary subject/dish'
          else if (role === 'scene') roleDesc = 'the background environment and context'
          else if (role === 'style') roleDesc = 'the art style, lighting, and color palette'
          else if (role === 'layout') roleDesc = 'the plating structure and composition layout'
          else roleDesc = 'general visual context'

          roleInstructions.push(`Use Image ${label} for ${roleDesc}${comment}.`)
        }

        // We use a unified composition prompt as recommended by Nano Banana Pro tips.
        // The specific roles (dish, scene, style, etc.) guide how the images are used.
        promptText =
          `Compose a new image using the provided reference inputs:\n` +
          roleInstructions.join('\n') +
          ` \nIntegrate the subject naturally into the environment while maintaining the requested style and layout.\n\n` +
          promptText
      }

      if (requestParams.negative_prompt) {
        promptText += `\nExclude: ${requestParams.negative_prompt}`
      }
      
      // Gemini 3 Pro uses imageConfig for aspect ratio, 2.5 Flash uses prompt instructions
      if (model === 'gemini-2.5-flash-image' && requestParams.aspect_ratio) {
        promptText += `\nAspect ratio: ${requestParams.aspect_ratio}`
      }
      
      if (requestParams.person_generation === 'dont_allow') {
        promptText += `\nNo people in the image.`
      }
      if (requestParams.safety_filter_level) {
        promptText += `\nContent safety: ${requestParams.safety_filter_level}`
      }

      const parts: any[] = [{ text: `Generate an image of: ${promptText}` }]

      // Add reference image(s) as inlineData parts (base64, no data URL prefix).
      if (requestParams.reference_images && requestParams.reference_images.length > 0) {
        for (const img of requestParams.reference_images) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data,
            },
          })
        }
      }

      const generationConfig: any = {
        responseModalities: ['image'],
        candidateCount,
      }

      // Add imageConfig for Gemini 3 Pro
      if (model.includes('gemini-3') || model.includes('pro')) {
        const imageConfig: any = {}
        if (requestParams.aspect_ratio) {
          imageConfig.aspectRatio = requestParams.aspect_ratio
        }
        if (requestParams.image_size) {
          imageConfig.imageSize = requestParams.image_size
        }
        if (Object.keys(imageConfig).length > 0) {
          generationConfig.imageConfig = imageConfig
        }
      }

      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig,
      }

      // Build URL with API key as query param per Gemini requirements
      const url = new URL(baseUrl)
      url.searchParams.set('key', this.apiKey)

      // Log the exact URL being called for debugging
      console.log('🔍 [Nano Banana] Making request to:', url.toString().replace(/key=[^&]+/, 'key=***'))
      console.log('🔍 [Nano Banana] Request body summary:', {
        candidateCount,
        imageConfig: generationConfig.imageConfig,
        promptLength: promptText.length,
        referenceImageCount: requestParams.reference_images?.length || 0
      })

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
      
      console.log('🔍 [Nano Banana] Processing API response:', {
        candidateCount: candidates.length,
        candidates: candidates.map((c: any) => ({ finishReason: c.finishReason, index: c.index }))
      })
      
      // Check for content filtering or other issues
      for (const cand of candidates) {
        console.log('🔍 [Nano Banana] Processing candidate:', {
          finishReason: cand.finishReason,
          index: cand.index,
          hasContent: !!(cand.content?.parts?.length)
        })
        
        if (cand.finishReason === 'NO_IMAGE') {
          console.log('🚫 [Nano Banana] NO_IMAGE detected - throwing CONTENT_POLICY_VIOLATION')
          throw new NanoBananaError(
            'Image generation was blocked by content filters. Try modifying your prompt to be more specific about the visual elements you want, avoid potentially sensitive content, or use different wording.',
            'CONTENT_POLICY_VIOLATION',
            undefined,
            undefined,
            'content_filtered'
          )
        }
        if (cand.finishReason === 'SAFETY') {
          console.log('🚫 [Nano Banana] SAFETY detected - throwing SAFETY_FILTER_BLOCKED')
          throw new NanoBananaError(
            'Image generation was blocked by safety filters. Please modify your prompt to avoid potentially harmful content.',
            'SAFETY_FILTER_BLOCKED',
            undefined,
            undefined,
            'safety_filtered'
          )
        }
        if (cand.finishReason && cand.finishReason !== 'STOP') {
          console.log('🚫 [Nano Banana] Unexpected finishReason - throwing GENERATION_FAILED')
          throw new NanoBananaError(
            `Image generation failed: ${cand.finishReason}. Please try a different prompt.`,
            'GENERATION_FAILED',
            undefined,
            undefined,
            cand.finishReason.toLowerCase()
          )
        }
        
        const parts = cand?.content?.parts || []
        for (const part of parts) {
          const inline = part?.inlineData
          if (inline?.data) {
            images.push(inline.data)
          }
        }
      }

      console.log('🔍 [Nano Banana] Final image count:', images.length)

      if (images.length === 0) {
        console.log('🚫 [Nano Banana] No images found - throwing NO_IMAGES_RETURNED')
        throw new NanoBananaError(
          'No images returned from API',
          'NO_IMAGES_RETURNED'
        )
      }

      logger.info('✅ [Nano Banana] Response received', {
        modelVersion: apiResponse?.metadata?.model_version || 'gemini-2.5-flash-image',
        imageCount: images.length,
        processingTimeMs: apiResponse?.metadata?.processing_time_ms || 0,
      })

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

    if (params.reference_images && params.reference_images.length > 0) {
      const model = params.model || 'gemini-2.5-flash-image'
      const isPro = model.includes('gemini-3') || model.includes('pro')
      const maxRefs = isPro ? 14 : 3
      
      if (params.reference_images.length > maxRefs) {
        throw new NanoBananaError(`Too many reference images (max ${maxRefs} for ${model})`, 'INVALID_PARAMS')
      }
      for (const img of params.reference_images) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp']
        if (!validTypes.includes(img.mimeType)) {
          throw new NanoBananaError(
            `Invalid reference image type. Must be one of: ${validTypes.join(', ')}`,
            'INVALID_PARAMS',
          )
        }
        if (!img.data || img.data.trim().length === 0) {
          throw new NanoBananaError('Reference image data is required', 'INVALID_PARAMS')
        }
      }

      const validModes = ['style_match', 'composite']
      if (params.reference_mode && !validModes.includes(params.reference_mode)) {
        throw new NanoBananaError(
          `Invalid reference mode. Must be one of: ${validModes.join(', ')}`,
          'INVALID_PARAMS',
        )
      }
    }
  }

  /**
   * Handle HTTP errors and convert to appropriate NanoBananaError
   */
  private handleHttpError(error: HttpError): NanoBananaError {
    // Log the full error details for debugging
    console.log('🔍 [Nano Banana] HTTP Error Details:', {
      status: error.status,
      message: error.message,
      body: error.body,
      code: error.code
    })

    // If it's a 400 error, log the full response body to understand what's wrong
    if (error.status === 400) {
      console.log('🔍 [Nano Banana] 400 Error - Full response body:', JSON.stringify(error.body, null, 2))
    }

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