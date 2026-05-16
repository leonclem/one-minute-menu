import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getBackgroundRemovalProvider } from '@/lib/background-removal/provider-factory'
import { resolvePublicImageUrl } from '@/lib/background-removal/local-image-proxy'
import imageLibrary from '@/data/placeholder-menus/image-library.json'
import type { PlaceholderImageEntry } from '@/data/placeholder-menus/types'
import { logger } from '@/lib/logger'

const library = imageLibrary as PlaceholderImageEntry[]

const STORAGE_BUCKET = 'menu-images'
const STORAGE_PREFIX = 'placeholder-items'

/**
 * POST /api/admin/placeholder-images/retry-cutout
 *
 * Trigger a new cutout generation attempt for a placeholder image that already
 * has a photo but is missing a cutout (or whose cutout failed).
 *
 * Fetches the existing placeholder photo directly from storage, calls the
 * background removal provider, and saves the result to placeholder storage.
 * Does not require an ai_generated_images row.
 *
 * Body: { imageKey: string }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await request.json() as { imageKey: string }

  if (!body.imageKey) {
    return NextResponse.json({ error: 'imageKey is required' }, { status: 400 })
  }

  const entry = library.find(e => e.suggested_image_key === body.imageKey)
  if (!entry) {
    return NextResponse.json({ error: 'Image key not found in library' }, { status: 404 })
  }

  logger.info(`[Placeholder Cutout Retry] Retrying cutout for: ${body.imageKey}`)

  try {
    const adminSupabase = createAdminSupabaseClient()
    const photoPath = `${STORAGE_PREFIX}/${body.imageKey}/photo.webp`

    // 1. Verify the photo exists in placeholder storage
    const { data: photoUrlData } = adminSupabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(photoPath)

    const photoUrl = photoUrlData.publicUrl

    // Quick HEAD check to confirm the file actually exists
    const headResp = await fetch(photoUrl, { method: 'HEAD' })
    if (!headResp.ok) {
      return NextResponse.json(
        { error: 'No photo found for this image key. Generate the image first.' },
        { status: 404 }
      )
    }

    // 2. Call the background removal provider directly (proxy localhost URLs for Replicate)
    const provider = getBackgroundRemovalProvider()
    const { url: resolvedPhotoUrl, cleanup } = await resolvePublicImageUrl(photoUrl)
    let result
    try {
      result = await provider.removeBackground(resolvedPhotoUrl)
    } finally {
      await cleanup()
    }

    // 3. Upload the cutout to placeholder storage
    const cutoutPath = `${STORAGE_PREFIX}/${body.imageKey}/cutout.webp`

    const { error: uploadError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(cutoutPath, result.imageBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Cutout upload failed: ${uploadError.message}`)
    }

    const { data: cutoutUrlData } = adminSupabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(cutoutPath)

    logger.info(`[Placeholder Cutout Retry] Cutout saved for ${body.imageKey} (${result.processingTimeMs}ms via ${provider.name})`)

    return NextResponse.json({
      success: true,
      data: {
        imageKey: body.imageKey,
        cutoutUrl: cutoutUrlData.publicUrl,
      },
    })
  } catch (error) {
    logger.error(`[Placeholder Cutout Retry] Error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
