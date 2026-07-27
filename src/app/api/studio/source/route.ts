/**
 * Photo Studio — Persist an uploaded source image
 *
 * POST /api/studio/source
 *
 * Expects the client to have uploaded the file directly to Supabase Storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { isPhotoControlMimeType } from '@/lib/studio/storage-paths'
import { getStudioDish } from '@/lib/studio/dishes'
import { registerStudioSourceImage, StudioImageLoadError } from '@/lib/studio/persistence'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      imageId?: unknown
      dishId?: unknown
      mimeType?: unknown
      /** Rejected: old clients sent base64 through Vercel (413 risk). */
      imageDataUrl?: unknown
    }
    const { imageId, dishId, mimeType, imageDataUrl } = body

    if (imageDataUrl !== undefined) {
      return NextResponse.json(
        {
          error:
            'This page is using an outdated upload client. Hard-refresh the browser (Ctrl+Shift+R) and try again.',
          code: 'LEGACY_UPLOAD_PAYLOAD',
        },
        { status: 400 },
      )
    }

    if (typeof imageId !== 'string' || !imageId) {
      return NextResponse.json(
        { error: 'imageId is required and must be a string' },
        { status: 400 },
      )
    }

    if (typeof dishId !== 'string' || !dishId) {
      return NextResponse.json({ error: 'dishId is required' }, { status: 400 })
    }

    if (typeof mimeType !== 'string' || !isPhotoControlMimeType(mimeType)) {
      return NextResponse.json(
        { error: 'mimeType must be image/png, image/jpeg, or image/webp' },
        { status: 400 },
      )
    }

    const dish = await getStudioDish(auth.user.id, dishId)
    if (!dish) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
    }

    const record = await registerStudioSourceImage({
      userId: auth.user.id,
      dishId,
      imageId,
      mimeType,
    })

    logger.info('✅ [Studio Source] Registered', {
      userId: auth.user.id,
      imageId: record.id,
      dishId,
    })

    return NextResponse.json({
      imageId: record.id,
      imageUrl: record.public_url,
      dishId: record.dish_id,
    })
  } catch (error) {
    if (error instanceof StudioImageLoadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    logger.error('❌ [Studio Source] Internal error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
