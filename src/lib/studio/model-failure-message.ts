/** Shown when a Studio image request fails because the model or provider is unavailable. */
export const STUDIO_MODEL_REQUEST_FAILED_MESSAGE =
  'The request failed. Please try again later, or switch to Std or Pro.'

function looksLikeUnavailableModel(message: string): boolean {
  const normalized = message.toLowerCase()
  if (!normalized.includes('model')) return false
  return (
    normalized.includes('not found') ||
    normalized.includes('no longer available') ||
    normalized.includes('not supported') ||
    normalized.includes('unavailable') ||
    normalized.includes('does not exist') ||
    normalized.includes('deprecated') ||
    normalized.includes('discontinued') ||
    normalized.includes('retired')
  )
}

/**
 * User-facing copy for a failed provider call.
 * Auth, safety, rate-limit, and ordinary bad requests keep their own messages.
 */
export function studioProviderFailureMessage(status: number, providerMessage = ''): string | null {
  if (status === 401 || status === 403 || status === 429) return null
  if (status === 400) {
    return looksLikeUnavailableModel(providerMessage) ? STUDIO_MODEL_REQUEST_FAILED_MESSAGE : null
  }
  if (status >= 400) return STUDIO_MODEL_REQUEST_FAILED_MESSAGE
  return null
}
