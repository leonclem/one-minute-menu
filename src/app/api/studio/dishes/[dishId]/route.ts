/**
 * Photo Studio dish — rename / set current image / delete
 *
 * PATCH  /api/studio/dishes/[dishId]  { name? } | { currentImageId? }
 * DELETE /api/studio/dishes/[dishId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import {
  deleteStudioDish,
  getStudioDish,
  renameStudioDish,
  setStudioDishCurrentImage,
} from '@/lib/studio/dishes'
import { getStudioImage } from '@/lib/studio/library'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { dishId: string } },
) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const { dishId } = params
    const existing = await getStudioDish(auth.user.id, dishId)
    if (!existing) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      name?: unknown
      currentImageId?: unknown
    }

    if (typeof body.name === 'string') {
      try {
        const dish = await renameStudioDish(auth.user.id, dishId, body.name)
        return NextResponse.json({ dish })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rename dish'
        if (message.includes('required')) {
          return NextResponse.json({ error: message }, { status: 400 })
        }
        throw err
      }
    }

    if (body.currentImageId === null || typeof body.currentImageId === 'string') {
      const imageId = body.currentImageId
      if (typeof imageId === 'string') {
        const image = await getStudioImage(auth.user.id, imageId)
        if (!image || image.dish_id !== dishId) {
          return NextResponse.json(
            { error: 'Image not found on this dish' },
            { status: 404 },
          )
        }
      }
      const dish = await setStudioDishCurrentImage(auth.user.id, dishId, imageId)
      return NextResponse.json({ dish })
    }

    return NextResponse.json(
      { error: 'Provide name or currentImageId' },
      { status: 400 },
    )
  } catch (error) {
    logger.error('❌ [Studio Dishes] PATCH failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { dishId: string } },
) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const { dishId } = params
    const existing = await getStudioDish(auth.user.id, dishId)
    if (!existing) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
    }

    try {
      await deleteStudioDish(auth.user.id, dishId)
      return NextResponse.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete dish'
      if (message.includes('Archive or delete')) {
        return NextResponse.json({ error: message }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    logger.error('❌ [Studio Dishes] DELETE failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
