// src/lib/background-removal/types.ts

export interface BackgroundRemovalResult {
  /** Transparent PNG image as a Buffer */
  imageBuffer: Buffer
  /** Provider-reported processing time in ms */
  processingTimeMs: number
  /** Provider model/version string */
  modelVersion: string
}

export interface BackgroundRemovalError {
  code: string
  message: string
  /** Provider-specific error category */
  category:
    | 'provider_unavailable'
    | 'processing_failed'
    | 'timeout'
    | 'invalid_input'
    | 'rate_limited'
    | 'unknown'
  /** Optional retry_after hint (in seconds) from rate limit responses */
  retryAfter?: number
}

export interface BackgroundRemovalProvider {
  /** Provider identifier (e.g., 'photoroom', 'remove-bg', 'bria') */
  readonly name: string

  /**
   * Submit an image for background removal.
   * @param imageUrl - URL of the source image
   * @param options - Optional provider-specific parameters
   * @returns The processed image with transparent background
   * @throws BackgroundRemovalError on failure
   */
  removeBackground(
    imageUrl: string,
    options?: Record<string, unknown>
  ): Promise<BackgroundRemovalResult>

  /**
   * Check if the provider is currently available.
   * Used for health checks and graceful degradation.
   */
  isAvailable(): Promise<boolean>
}
