/**
 * Container-signature detection for studio image bytes.
 *
 * A studio image's MIME type is declared in three places that can disagree: the
 * value a route hands to persistence, the storage object's content type, and the
 * `studio_images.mime_type` column. Image providers may return an encoding other
 * than the one requested, so the bytes themselves are the only reliable
 * authority. Reading the container signature avoids a full decode, so this is
 * cheap enough for read paths that only need the label.
 */

import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])
const RIFF_SIGNATURE = 'RIFF'
const WEBP_SIGNATURE = 'WEBP'

function startsWith(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
}

/**
 * Returns the supported MIME type the bytes actually encode, or null when the
 * container is unrecognized. Callers treat null as "keep the declared value"
 * rather than an error, so an unsupported encoding still surfaces at whichever
 * consumer genuinely needs to decode it.
 */
export function detectStudioImageMimeType(buffer: Buffer): PhotoControlMimeType | null {
  if (startsWith(buffer, PNG_SIGNATURE)) return 'image/png'
  if (startsWith(buffer, JPEG_SIGNATURE)) return 'image/jpeg'
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === RIFF_SIGNATURE &&
    buffer.subarray(8, 12).toString('ascii') === WEBP_SIGNATURE
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * Resolves the MIME type to record for a set of bytes, preferring the detected
 * container over the declared value so a mislabeled image is never persisted or
 * re-served under a type it does not have.
 */
export function resolveStudioImageMimeType<T extends string>(
  buffer: Buffer,
  declared: T,
): { mimeType: PhotoControlMimeType | T; detected: PhotoControlMimeType | null; mismatched: boolean } {
  const detected = detectStudioImageMimeType(buffer)
  if (!detected) return { mimeType: declared, detected: null, mismatched: false }
  return { mimeType: detected, detected, mismatched: detected !== declared }
}
