/**
 * Local Dev Image Proxy
 *
 * In local development, images are stored at localhost:54321 (local Supabase).
 * External providers like Replicate can't reach localhost, so we temporarily
 * upload the image to Google Cloud Storage and return a public URL.
 *
 * Only active when NODE_ENV=development AND the image URL is a localhost URL.
 * No-ops in production.
 */

import { Storage } from '@google-cloud/storage'
import { logger } from '@/lib/logger'

const BUCKET_NAME = 'gridmenu-dev-temp'
const TTL_SECONDS = 300 // 5 minutes — enough for Replicate to fetch it

let storageClient: Storage | null = null

function getStorageClient(): Storage {
  if (!storageClient) {
    const credsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!credsRaw) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set')
    const credentials = JSON.parse(credsRaw)
    storageClient = new Storage({ credentials, projectId: credentials.project_id })
  }
  return storageClient
}

function isLocalUrl(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('host.docker.internal')
}

/**
 * If running locally and the URL is a localhost URL, upload the image to GCS
 * and return a public URL that external services can reach.
 * Otherwise returns the original URL unchanged.
 */
export async function resolvePublicImageUrl(imageUrl: string): Promise<{ url: string; cleanup: () => Promise<void> }> {
  const noop = async () => {}

  if (process.env.NODE_ENV !== 'development' || !isLocalUrl(imageUrl)) {
    return { url: imageUrl, cleanup: noop }
  }

  logger.info('[LocalImageProxy] Uploading local image to GCS for external provider access', { imageUrl })

  // Fetch the image from local Supabase
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch local image: ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || 'image/jpeg'

  // Upload to GCS with a short-lived unique path
  const storage = getStorageClient()
  const fileName = `dev-proxy/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

  const bucket = storage.bucket(BUCKET_NAME)
  const file = bucket.file(fileName)
  await file.save(buffer, { contentType, resumable: false })

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`
  logger.info('[LocalImageProxy] Image uploaded to GCS', { publicUrl })

  const cleanup = async () => {
    try {
      await file.delete()
      logger.info('[LocalImageProxy] Cleaned up temp GCS file', { fileName })
    } catch (err) {
      logger.warn('[LocalImageProxy] Failed to clean up temp GCS file', { fileName, err })
    }
  }

  return { url: publicUrl, cleanup }
}
