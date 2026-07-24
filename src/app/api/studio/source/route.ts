/**
 * Photo Studio — Persist an uploaded source image
 *
 * POST /api/studio/source
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { parseAndValidateImageDataUrl } from '@/lib/photo-control/request-validation'
import { getStudioDish } from '@/lib/studio/dishes'
import { persistStudioImage } from '@/lib/studio/persistence'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      imageDataUrl?: unknown
      dishId?: unknown
    }
    const { imageDataUrl, dishId } = body

    if (typeof imageDataUrl !== 'string' || !imageDataUrl) {
      return NextResponse.json(
        { error: 'imageDataUrl is required and must be a string' },
        { status: 400 },
      )
    }

    if (typeof dishId !== 'string' || !dishId) {
      return NextResponse.json({ error: 'dishId is required' }, { status: 400 })
    }

    const dish = await getStudioDish(auth.user.id, dishId)
    if (!dish) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
    }

    const parsed = parseAndValidateImageDataUrl(imageDataUrl, { fieldLabel: 'imageDataUrl' })
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const record = await persistStudioImage({
      userId: auth.user.id,
      dishId,
      role: 'source',
      imageBase64: parsed.base64,
      mimeType: parsed.mimeType,
    })

    logger.info('✅ [Studio Source] Persisted', {
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
    logger.error('❌ [Studio Source] Internal error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
