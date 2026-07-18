/**
 * Photo Studio image library actions
 *
 * PATCH  /api/studio/images/[imageId]  { isFavourite? | archive? }
 * DELETE /api/studio/images/[imageId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUserApi } from '@/lib/user-api-auth'
import {
  archiveStudioImage,
  deleteStudioImage,
  getStudioImage,
  setStudioImageFavourite,
} from '@/lib/studio/library'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { imageId: string } },
) {
  try {
    const auth = await requireUserApi()
    if (!auth.ok) return auth.response

    const { imageId } = params
    const existing = await getStudioImage(auth.user.id, imageId)
    if (!existing) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      isFavourite?: unknown
      archive?: unknown
    }

    if (body.archive === true) {
      const image = await archiveStudioImage(auth.user.id, imageId)
      return NextResponse.json({ image })
    }

    if (typeof body.isFavourite === 'boolean') {
      try {
        const image = await setStudioImageFavourite(
          auth.user.id,
          imageId,
          body.isFavourite,
        )
        return NextResponse.json({ image })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update favourite'
        if (
          message.includes('archived') ||
          message.includes('not assigned') ||
          message.includes('not found')
        ) {
          return NextResponse.json({ error: message }, { status: 400 })
        }
        throw err
      }
    }

    return NextResponse.json(
      { error: 'Provide isFavourite (boolean) and/or archive: true' },
      { status: 400 },
    )
  } catch (error) {
    logger.error('❌ [Studio Images] PATCH failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { imageId: string } },
) {
  try {
    const auth = await requireUserApi()
    if (!auth.ok) return auth.response

    const { imageId } = params
    const existing = await getStudioImage(auth.user.id, imageId)
    if (!existing) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    try {
      await deleteStudioImage(auth.user.id, imageId)
      return NextResponse.json({ ok: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete image'
      if (message.includes('Archive or delete')) {
        return NextResponse.json({ error: message }, { status: 409 })
      }
      throw err
    }
  } catch (error) {
    logger.error('❌ [Studio Images] DELETE failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
