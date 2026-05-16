import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const STORAGE_BUCKET = 'menu-images'
const STORAGE_PREFIX = 'placeholder-items'

/**
 * POST /api/admin/placeholder-images/copy
 *
 * Copy generated photo (and cutout if available) from the worker's storage
 * path to the canonical placeholder location. Uses service-role client to
 * bypass RLS (placeholder-items/ is not under any user's folder).
 *
 * Body: { imageKey: string, sourceUrl: string, cutoutUrl?: string }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin.ok) return admin.response

  const body = await request.json() as {
    imageKey: string
    sourceUrl: string
    cutoutUrl?: string
  }

  if (!body.imageKey || !body.sourceUrl) {
    return NextResponse.json({ error: 'imageKey and sourceUrl are required' }, { status: 400 })
  }

  // Use service-role client to bypass storage RLS
  const adminSupabase = createAdminSupabaseClient()

  try {
    const photoPath = `${STORAGE_PREFIX}/${body.imageKey}/photo.webp`

    // Copy the photo
    const photoBuffer = await fetchImageBuffer(body.sourceUrl)
    const { error: photoError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(photoPath, photoBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (photoError) {
      throw new Error(`Photo upload failed: ${photoError.message}`)
    }

    const { data: photoUrlData } = adminSupabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(photoPath)

    // Copy cutout if provided
    let cutoutPublicUrl: string | undefined
    if (body.cutoutUrl) {
      const cutoutPath = `${STORAGE_PREFIX}/${body.imageKey}/cutout.webp`
      try {
        const cutoutBuffer = await fetchImageBuffer(body.cutoutUrl)
        const { error: cutoutError } = await adminSupabase.storage
          .from(STORAGE_BUCKET)
          .upload(cutoutPath, cutoutBuffer, {
            contentType: 'image/webp',
            upsert: true,
          })

        if (!cutoutError) {
          const { data: cutoutUrlData } = adminSupabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(cutoutPath)
          cutoutPublicUrl = cutoutUrlData.publicUrl
        } else {
          logger.warn(`[Placeholder Copy] Cutout upload failed for ${body.imageKey}:`, cutoutError)
        }
      } catch (err) {
        logger.warn(`[Placeholder Copy] Cutout fetch failed for ${body.imageKey}:`, err)
      }
    }

    logger.info(`[Placeholder Copy] Copied ${body.imageKey} to ${photoPath}`)

    return NextResponse.json({
      success: true,
      data: {
        imageKey: body.imageKey,
        photoUrl: photoUrlData.publicUrl,
        cutoutUrl: cutoutPublicUrl,
        storagePath: photoPath,
      },
    })
  } catch (error) {
    logger.error(`[Placeholder Copy] Error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Copy failed' },
      { status: 500 }
    )
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} from ${url}`)
  }
  return Buffer.from(await response.arrayBuffer())
}
