/**
 * Local Dev Image Proxy
 *
 * In local development, images are stored at localhost:54321 (local Supabase).
 * External providers like Replicate can't reach localhost, so we temporarily
 * upload the image to Google Cloud Storage and return a public URL.
 *
 * Active when the image URL is a localhost-style URL, because external providers
 * (e.g. Replicate) cannot reach your machine's `localhost` or Docker bridge.
 *
 * In production this usually no-ops because Supabase Storage URLs are public.
 */

import { Storage } from '@google-cloud/storage'
import fs from 'node:fs'
import { logger } from '@/lib/logger'

const BUCKET_NAME = 'gridmenu-dev-temp'
const TTL_SECONDS = 300 // 5 minutes — enough for Replicate to fetch it

let storageClient: Storage | null = null

function getStorageClient(): Storage {
  if (!storageClient) {
    const credsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!credsRaw) throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set')
    const credentials = parseGoogleCredentials(credsRaw)
    storageClient = new Storage({ credentials, projectId: credentials.project_id })
  }
  return storageClient
}

function parseGoogleCredentials(raw: string): Record<string, any> {
  const trimmed = raw.trim()

  // Docker --env-file passes quotes literally, unlike dotenv. Accept both:
  // GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account",...}
  // GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'
  const unquoted =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ? trimmed.slice(1, -1)
      : trimmed

  if (unquoted.startsWith('{')) {
    return JSON.parse(unquoted)
  }

  // Also support the standard Google convention: env var points to a JSON file.
  if (fs.existsSync(unquoted)) {
    return JSON.parse(fs.readFileSync(unquoted, 'utf8'))
  }

  throw new Error(
    'GOOGLE_APPLICATION_CREDENTIALS must be a service account JSON string or a path to a JSON credentials file'
  )
}

function isLocalUrl(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1') || url.includes('host.docker.internal')
}

function resolveLocalFetchUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl)

    if (!isRunningInDocker()) {
      return imageUrl
    }

    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return imageUrl
    }

    url.hostname = process.env.WORKER_HOST_GATEWAY || 'host.docker.internal'
    return url.toString()
  } catch {
    return imageUrl
  }
}

function isRunningInDocker(): boolean {
  if (process.env.RUNNING_IN_DOCKER === 'true') return true

  try {
    if (fs.existsSync('/.dockerenv')) return true
  } catch {
    // ignore
  }

  try {
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
    return /docker|containerd|kubepods/i.test(cgroup)
  } catch {
    return false
  }
}

/**
 * If running locally and the URL is a localhost URL, upload the image to GCS
 * and return a public URL that external services can reach.
 * Otherwise returns the original URL unchanged.
 */
export async function resolvePublicImageUrl(imageUrl: string): Promise<{ url: string; cleanup: () => Promise<void> }> {
  const noop = async () => {}

  if (!isLocalUrl(imageUrl)) {
    return { url: imageUrl, cleanup: noop }
  }

  // For local Supabase URLs (localhost/127/host.docker.internal), Replicate cannot fetch directly.
  // Proxy via a short-lived public GCS object. This is primarily used in local/dev testing
  // (including when the worker runs inside Docker).
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Local image URL detected but GOOGLE_APPLICATION_CREDENTIALS is not set. ' +
        'External cutout providers cannot fetch from localhost. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS (JSON) to enable the local image proxy, ' +
        'or use a publicly reachable Supabase Storage URL.'
    )
  }

  const fetchUrl = resolveLocalFetchUrl(imageUrl)

  logger.info('[LocalImageProxy] Uploading local image to GCS for external provider access', {
    imageUrl,
    fetchUrl,
  })

  // Fetch the image from local Supabase
  let response: Response
  try {
    response = await fetch(fetchUrl)
  } catch (error) {
    throw new Error(
      `Failed to fetch local image from ${fetchUrl}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch local image from ${fetchUrl}: ${response.status} ${response.statusText}`)
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
