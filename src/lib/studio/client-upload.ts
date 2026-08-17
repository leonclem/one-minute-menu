/**
 * Client-side direct upload of studio source images to Supabase Storage.
 * Bypasses Vercel's 4.5 MB request-body limit.
 *
 * Auth is established by a same-origin API that issues a signed upload URL.
 * The browser then PUTs the file to Storage without calling supabase.auth.getSession(),
 * which can deadlock on the GoTrue auth lock during first-load SIGNED_IN handlers.
 */

import { validateImageFileForUpload, type AllowedMimeType } from '@/lib/photo-control/image-uploader'
import { readImagePixelSize, sourceAspectRejection } from '@/lib/studio/source-image-aspect'

export type StudioClientUploadResult =
  | {
      ok: true
      imageId: string
      mimeType: AllowedMimeType
      bytes: number
      publicUrl: string
      storagePath: string
    }
  | { ok: false; error: string }

const PREPARE_TIMEOUT_MS = 15_000
const UPLOAD_TIMEOUT_MS = 90_000
const CLEANUP_TIMEOUT_MS = 10_000

type PreparedUpload = {
  imageId: string
  storagePath: string
  signedUrl: string
  publicUrl: string
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(timeoutMessage)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  return payload?.error || fallback
}

async function putFileToSignedUrl(signedUrl: string, file: File): Promise<void> {
  const body = new FormData()
  body.append('cacheControl', '31536000')
  body.append('', file)

  const response = await fetchWithTimeout(
    signedUrl,
    {
      method: 'PUT',
      body,
      headers: { 'x-upsert': 'false' },
    },
    UPLOAD_TIMEOUT_MS,
    'The image upload timed out. Check your connection and try again.',
  )

  if (!response.ok) {
    throw new Error('Failed to upload image to storage.')
  }
}

type UploadStudioSourceOptions = {
  readPixelSize?: (file: File) => Promise<{ width: number; height: number }>
}

export async function uploadStudioSourceFile(
  file: File,
  options: UploadStudioSourceOptions = {},
): Promise<StudioClientUploadResult> {
  const validation = validateImageFileForUpload(file)
  if (!validation.ok) {
    return { ok: false, error: validation.error }
  }

  try {
    const size = await (options.readPixelSize ?? readImagePixelSize)(file)
    const aspectError = sourceAspectRejection(size.width, size.height)
    if (aspectError) {
      return { ok: false, error: aspectError }
    }
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error, 'Could not read this image. Try a different photo.'),
    }
  }

  let uploadedStoragePath: string | null = null

  try {
    const prepareResponse = await fetchWithTimeout(
      '/api/studio/source/upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: validation.mimeType }),
      },
      PREPARE_TIMEOUT_MS,
      'Timed out while preparing your upload. Refresh the page and try again.',
    )

    if (!prepareResponse.ok) {
      const fallback =
        prepareResponse.status === 401
          ? 'You must be signed in to upload images.'
          : 'Failed to prepare image upload.'
      return { ok: false, error: await readErrorMessage(prepareResponse, fallback) }
    }

    const prepared = (await prepareResponse.json()) as Partial<PreparedUpload>
    if (!prepared.imageId || !prepared.storagePath || !prepared.signedUrl || !prepared.publicUrl) {
      return { ok: false, error: 'Failed to prepare image upload.' }
    }

    uploadedStoragePath = prepared.storagePath
    await putFileToSignedUrl(prepared.signedUrl, file)
    uploadedStoragePath = null

    return {
      ok: true,
      imageId: prepared.imageId,
      mimeType: validation.mimeType,
      bytes: validation.bytes,
      publicUrl: prepared.publicUrl,
      storagePath: prepared.storagePath,
    }
  } catch (error) {
    if (uploadedStoragePath) {
      void removeStudioStorageObject(uploadedStoragePath)
    }
    return {
      ok: false,
      error: errorMessage(error, 'Failed to upload image. Refresh and try again.'),
    }
  }
}

export async function removeStudioStorageObject(storagePath: string): Promise<void> {
  try {
    await fetchWithTimeout(
      '/api/studio/source/upload-url',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      },
      CLEANUP_TIMEOUT_MS,
      'Storage cleanup timed out',
    )
  } catch {
    // Cleanup is best effort and must never keep the Studio UI in a busy state.
  }
}
