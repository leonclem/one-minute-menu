/**
 * Shared MIME / size / data-URL validation for photo-control and studio routes.
 */

export const PHOTO_CONTROL_VALID_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
] as const)

export type PhotoControlMimeType = 'image/png' | 'image/jpeg' | 'image/webp'

export const PHOTO_CONTROL_MAX_IMAGE_BYTES = 7 * 1024 * 1024 // 7 MB

export type ParseDataUrlResult =
  | { ok: true; mimeType: PhotoControlMimeType; base64: string; byteLength: number }
  | { ok: false; error: string }

/**
 * Parse a base64 data URL for png/jpeg/webp and enforce the size limit.
 */
export function parseAndValidateImageDataUrl(
  dataUrl: string,
  options?: { fieldLabel?: string },
): ParseDataUrlResult {
  const fieldLabel = options?.fieldLabel ?? 'imageDataUrl'
  const dataUrlMatch = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,/)

  if (!dataUrlMatch) {
    return {
      ok: false,
      error: `Invalid ${fieldLabel}. Must be a base64 data URL for image/png, image/jpeg, or image/webp.`,
    }
  }

  const mimeType = dataUrlMatch[1] as PhotoControlMimeType
  if (!PHOTO_CONTROL_VALID_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: 'Invalid image MIME type. Allowed: image/png, image/jpeg, image/webp.',
    }
  }

  const base64 = dataUrl.substring(dataUrlMatch[0].length).replace(/[\r\n\s]/g, '')
  if (!base64) {
    return { ok: false, error: `${fieldLabel} contains no data` }
  }

  const byteLength = Buffer.from(base64, 'base64').length
  if (byteLength > PHOTO_CONTROL_MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Image exceeds the 7 MB size limit' }
  }

  return { ok: true, mimeType, base64, byteLength }
}
