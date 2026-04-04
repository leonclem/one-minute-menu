import Replicate from 'replicate'
import { logger } from '@/lib/logger'
import type {
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
  BackgroundRemovalError,
} from '../types'

const MODEL_ID =
  '851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc' as const
const MODEL_VERSION = '851-labs/background-remover'

/**
 * Replicate-backed background removal provider using the 851-labs/background-remover model.
 * Follows the same class-based client pattern as NanoBananaClient.
 */
export class ReplicateBackgroundRemovalProvider implements BackgroundRemovalProvider {
  readonly name = 'replicate'
  private client: Replicate

  constructor(apiToken?: string) {
    const token = apiToken || process.env.REPLICATE_API_TOKEN || ''
    if (!token) {
      throw new Error(
        'REPLICATE_API_TOKEN is required. Set it as an environment variable or pass it to the constructor.'
      )
    }
    this.client = new Replicate({ auth: token })
  }

  async removeBackground(
    imageUrl: string,
    options?: Record<string, unknown>
  ): Promise<BackgroundRemovalResult> {
    if (!imageUrl) {
      throw this.createError('INVALID_INPUT', 'imageUrl is required', 'invalid_input')
    }

    const startTime = Date.now()

    try {
      const output = await this.client.run(MODEL_ID, {
        input: {
          image: imageUrl,
          background_type: 'rgba',
          format: 'png',
          ...options,
        },
      })

      const processingTimeMs = Date.now() - startTime

      // Replicate returns a URL (or ReadableStream) to the processed image.
      // We need to fetch it and convert to a Buffer.
      const resultUrl = this.extractResultUrl(output)
      if (!resultUrl) {
        throw this.createError(
          'PROCESSING_FAILED',
          'Provider returned an unexpected output format',
          'processing_failed'
        )
      }

      const imageBuffer = await this.fetchImageBuffer(resultUrl)

      return {
        imageBuffer,
        processingTimeMs,
        modelVersion: MODEL_VERSION,
      }
    } catch (error: unknown) {
      // Re-throw if it's already a BackgroundRemovalError
      if (this.isBackgroundRemovalError(error)) {
        throw error
      }
      throw this.mapProviderError(error, Date.now() - startTime)
    }
  }

  async isAvailable(): Promise<boolean> {
    const token = process.env.REPLICATE_API_TOKEN
    if (!token) {
      return false
    }

    try {
      // Lightweight check: hit the Replicate API to verify credentials
      // The models.get call is cheap and confirms auth works
      await this.client.models.get('851-labs', 'background-remover')
      return true
    } catch {
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract a URL string from the Replicate run output.
   * The output shape can vary — it may be a string URL, a FileOutput, or an array.
   */
  private extractResultUrl(output: unknown): string | null {
    if (typeof output === 'string') {
      return output
    }
    // FileOutput objects have a url() method or toString()
    if (output && typeof output === 'object' && 'url' in output) {
      return String((output as { url: () => string }).url())
    }
    if (output && typeof output === 'object' && typeof (output as any).toString === 'function') {
      const str = String(output)
      if (str.startsWith('http')) {
        return str
      }
    }
    // Array of outputs — take the first
    if (Array.isArray(output) && output.length > 0) {
      return this.extractResultUrl(output[0])
    }
    return null
  }

  /**
   * Fetch the processed image from the provider URL and return as a Buffer.
   */
  private async fetchImageBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url)
    if (!response.ok) {
      throw this.createError(
        'FETCH_FAILED',
        `Failed to fetch processed image: ${response.status} ${response.statusText}`,
        'processing_failed'
      )
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /**
   * Map Replicate SDK / HTTP errors to BackgroundRemovalError categories.
   */
  private mapProviderError(error: unknown, elapsedMs?: number): BackgroundRemovalError {
    const message = error instanceof Error ? error.message : String(error)

    // Timeout detection
    if (
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('timed out') ||
      message.toLowerCase().includes('deadline')
    ) {
      logger.warn('[Replicate] Request timed out', { elapsedMs, message })
      return this.createError('TIMEOUT', message, 'timeout')
    }

    // HTTP status-based mapping (Replicate SDK includes status in error)
    const status = this.extractStatusCode(error)

    if (status === 401 || status === 403) {
      logger.error('[Replicate] Authentication/authorization error', { status, message })
      return this.createError('AUTH_ERROR', message, 'provider_unavailable')
    }

    if (status === 422 || status === 400) {
      logger.warn('[Replicate] Invalid input', { status, message })
      return this.createError('INVALID_INPUT', message, 'invalid_input')
    }

    if (status === 429) {
      logger.warn('[Replicate] Rate limited', { status, message })
      const retryAfter = this.extractRetryAfter(error)
      return this.createError('RATE_LIMITED', message, 'rate_limited', retryAfter)
    }

    if (status && status >= 500) {
      logger.error('[Replicate] Provider server error', { status, message })
      return this.createError('SERVER_ERROR', message, 'provider_unavailable')
    }

    // Replicate prediction failures (model errors)
    if (message.toLowerCase().includes('failed') || message.toLowerCase().includes('error')) {
      logger.error('[Replicate] Processing failed', { message })
      return this.createError('PROCESSING_FAILED', message, 'processing_failed')
    }

    logger.error('[Replicate] Unknown error', { message })
    return this.createError('UNKNOWN', message, 'unknown')
  }

  /**
   * Try to extract an HTTP status code from an error object.
   */
  private extractStatusCode(error: unknown): number | null {
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>
      if (typeof e.status === 'number') return e.status
      if (typeof e.statusCode === 'number') return e.statusCode
      if (e.response && typeof e.response === 'object') {
        const resp = e.response as Record<string, unknown>
        if (typeof resp.status === 'number') return resp.status
      }
    }
    return null
  }

  /**
   * Try to extract retry_after (in seconds) from a rate limit error response.
   */
  private extractRetryAfter(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>
      // Check common header names and response fields
      if (typeof e.retryAfter === 'number') return e.retryAfter
      if (typeof e.retry_after === 'number') return e.retry_after
      if (e.headers && typeof e.headers === 'object') {
        const headers = e.headers as Record<string, unknown>
        if (typeof headers['retry-after'] === 'string') {
          const parsed = parseInt(headers['retry-after'] as string, 10)
          if (!isNaN(parsed)) return parsed
        }
        if (typeof headers['retry-after'] === 'number') return headers['retry-after']
      }
      if (e.response && typeof e.response === 'object') {
        const resp = e.response as Record<string, unknown>
        if (resp.headers && typeof resp.headers === 'object') {
          const headers = resp.headers as Record<string, unknown>
          if (typeof headers['retry-after'] === 'string') {
            const parsed = parseInt(headers['retry-after'] as string, 10)
            if (!isNaN(parsed)) return parsed
          }
          if (typeof headers['retry-after'] === 'number') return headers['retry-after']
        }
      }
    }
    // Fallback: parse retry_after from serialized error message JSON.
    // Example snippet: ..."retry_after":2}
    const message = error instanceof Error ? error.message : String(error)
    const retryAfterMatch = message.match(/"retry_after"\s*:\s*(\d+)/i)
    if (retryAfterMatch) {
      const parsed = parseInt(retryAfterMatch[1], 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return undefined
  }

  private createError(
    code: string,
    message: string,
    category: BackgroundRemovalError['category'],
    retryAfter?: number
  ): BackgroundRemovalError {
    return { code, message, category, retryAfter }
  }

  private isBackgroundRemovalError(error: unknown): error is BackgroundRemovalError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error &&
      'category' in error
    )
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor — mirrors getNanoBananaClient() pattern
// ---------------------------------------------------------------------------

let replicateProvider: ReplicateBackgroundRemovalProvider | null = null

export function getReplicateProvider(): ReplicateBackgroundRemovalProvider {
  if (!replicateProvider) {
    replicateProvider = new ReplicateBackgroundRemovalProvider()
  }
  return replicateProvider
}
