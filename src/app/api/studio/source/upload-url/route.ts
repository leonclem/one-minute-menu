/**
 * Photo Studio — Issue a signed URL for a direct source-image upload.
 *
 * POST   /api/studio/source/upload-url  { mimeType }
 * DELETE /api/studio/source/upload-url  { storagePath }
 *
 * The browser PUTs the file to Storage with the signed URL so it never has to
 * call supabase.auth.getSession() (which can deadlock on the GoTrue auth lock).
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import {
  assertStudioStoragePathOwnedByUser,
  buildStudioStoragePath,
  isPhotoControlMimeType,
  normalizeStoragePublicUrl,
  STUDIO_STORAGE_BUCKET,
  toBrowserPublicUrl,
} from '@/lib/studio/storage-paths'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as { mimeType?: unknown }
    const { mimeType } = body

    if (typeof mimeType !== 'string' || !isPhotoControlMimeType(mimeType)) {
      return NextResponse.json(
        { error: 'mimeType must be image/png, image/jpeg, or image/webp' },
        { status: 400 },
      )
    }

    const imageId = randomUUID()
    const storagePath = buildStudioStoragePath(auth.user.id, imageId, mimeType)
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin.storage
      .from(STUDIO_STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath)

    if (error || !data?.signedUrl) {
      logger.error('❌ [Studio Source] Failed to create signed upload URL', { error })
      return NextResponse.json({ error: 'Failed to prepare image upload.' }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from(STUDIO_STORAGE_BUCKET).getPublicUrl(storagePath)

    return NextResponse.json({
      imageId,
      storagePath,
      signedUrl: toBrowserPublicUrl(data.signedUrl),
      publicUrl: normalizeStoragePublicUrl(urlData.publicUrl),
    })
  } catch (error) {
    logger.error('❌ [Studio Source] Signed upload URL error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as { storagePath?: unknown }
    const storagePath = body.storagePath

    if (typeof storagePath !== 'string' || !storagePath) {
      return NextResponse.json({ error: 'storagePath is required' }, { status: 400 })
    }

    try {
      assertStudioStoragePathOwnedByUser(storagePath, auth.user.id)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminSupabaseClient()
    await admin.storage.from(STUDIO_STORAGE_BUCKET).remove([storagePath])

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('❌ [Studio Source] Upload cleanup error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
