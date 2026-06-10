/**
 * Photo Control — Image_Uploader
 *
 * Validates and accepts a single food photograph for the Photo Control editor.
 * Only `image/png`, `image/jpeg`, and `image/webp` files up to 7 MB are
 * accepted. Any other file is rejected with a descriptive error message.
 *
 * Design notes:
 *  - Validation is pure and synchronous; no I/O is performed here.
 *  - The accepted `sourceImage` carries the data URL, MIME type, and byte count
 *    so the caller can retain it for the editing session without re-reading the
 *    file. (Requirement 1.4)
 *  - An otherwise-valid file MAY still be rejected for an operational reason
 *    (e.g. server capacity, duplicate detection) by passing an `operationalReason`
 *    to `validateAndAcceptImage`. (Requirement 1.7)
 *
 * Requirements: 1.1, 1.2, 1.3, 1.7
 */

// ============================================================================
// Constants
// ============================================================================

/** The MIME types accepted by the Image_Uploader. (Requirement 1.1) */
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Union of accepted MIME type literals. */
export type AllowedMimeType = (typeof ALLOWED_MIME)[number]

/** Maximum accepted file size in bytes (7 MB). (Requirement 1.3) */
export const MAX_IMAGE_BYTES = 7 * 1024 * 1024

// ============================================================================
// Result Types
// ============================================================================

/**
 * The accepted source image, retained for the duration of the editing session.
 * (Requirement 1.4)
 */
export interface SourceImage {
  /** Base64 data URL (`data:<mimeType>;base64,...`). */
  dataUrl: string
  /** The validated MIME type of the accepted file. */
  mimeType: AllowedMimeType
  /** File size in bytes. */
  bytes: number
}

/**
 * The result of `validateAndAcceptImage`.
 *
 *  - `ok: true`  — the file was accepted; `sourceImage` is populated.
 *  - `ok: false` — the file was rejected; `error` names the reason.
 */
export type UploadResult =
  | { ok: true; sourceImage: SourceImage; error?: never }
  | { ok: false; sourceImage?: never; error: string }

// ============================================================================
// Validation Logic
// ============================================================================

/**
 * Validate and accept a single image file for the Photo Control editor.
 *
 * Accepts the file if and only if:
 *  1. Its MIME type is one of `image/png`, `image/jpeg`, or `image/webp`.
 *     (Requirement 1.1 / 1.2)
 *  2. Its size does not exceed 7 MB. (Requirement 1.3)
 *  3. No `operationalReason` is supplied. (Requirement 1.7)
 *
 * On rejection the returned `error` message:
 *  - Names the allowed types when rejection is due to MIME type. (Req 1.2)
 *  - States the 7 MB limit when rejection is due to size. (Req 1.3)
 *  - Names the operational reason when one is supplied. (Req 1.7)
 *
 * @param file              The `File` object submitted by the user.
 * @param dataUrl           The base64 data URL for the file (caller-supplied so
 *                          this function stays synchronous and testable without
 *                          a real `FileReader`).
 * @param operationalReason An optional operational rejection reason (e.g.
 *                          "Server capacity exceeded"). When present the file is
 *                          rejected even if it passes type and size checks.
 *                          (Requirement 1.7)
 */
export function validateAndAcceptImage(
  file: { type: string; size: number },
  dataUrl: string,
  operationalReason?: string,
): UploadResult {
  // 1. MIME type check (Requirement 1.2)
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
    const allowed = ALLOWED_MIME.join(', ')
    return {
      ok: false,
      error: `File type "${file.type}" is not supported. Allowed types: ${allowed}.`,
    }
  }

  // 2. Size check (Requirement 1.3)
  if (file.size > MAX_IMAGE_BYTES) {
    const limitMb = MAX_IMAGE_BYTES / (1024 * 1024)
    return {
      ok: false,
      error: `File size exceeds the ${limitMb} MB limit. Please upload a smaller image.`,
    }
  }

  // 3. Operational rejection (Requirement 1.7)
  if (operationalReason !== undefined && operationalReason.length > 0) {
    return {
      ok: false,
      error: operationalReason,
    }
  }

  // Accepted (Requirement 1.1)
  return {
    ok: true,
    sourceImage: {
      dataUrl,
      mimeType: file.type as AllowedMimeType,
      bytes: file.size,
    },
  }
}
