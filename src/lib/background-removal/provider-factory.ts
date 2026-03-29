import { BackgroundRemovalProvider } from './types'

let provider: BackgroundRemovalProvider | null = null

/**
 * Returns the configured BackgroundRemovalProvider based on
 * BACKGROUND_REMOVAL_PROVIDER env var.
 * Follows the same singleton pattern as getNanoBananaClient().
 */
export function getBackgroundRemovalProvider(): BackgroundRemovalProvider {
  if (!provider) {
    const providerName = process.env.BACKGROUND_REMOVAL_PROVIDER

    if (!providerName) {
      throw new Error(
        'BACKGROUND_REMOVAL_PROVIDER environment variable is not set. ' +
          'Please configure a background removal provider.'
      )
    }

    switch (providerName) {
      case 'replicate': {
        // Lazy require to avoid loading the Replicate SDK (which needs TransformStream)
        // until the provider is actually requested at runtime.
        const { getReplicateProvider } = require('./providers/replicate') as typeof import('./providers/replicate')
        provider = getReplicateProvider()
        break
      }
      default:
        throw new Error(
          `Unknown background removal provider: "${providerName}". ` +
            'Available providers: replicate'
        )
    }
  }

  return provider
}
