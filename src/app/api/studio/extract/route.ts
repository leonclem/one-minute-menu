/**
 * Photo Studio — Phase A Extraction Route (customer-facing)
 *
 * POST /api/studio/extract
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { GeminiExtractionClient, UnparseableExtractionResponseError } from '@/lib/photo-control/gemini-extraction-client'
import { MinimalSchemaValidator } from '@/lib/photo-control/schema-validator'
import { loadStudioImageBytes, StudioImageLoadError } from '@/lib/studio/image-bytes'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 },
      )
    }

    const body = (await request.json()) as { imageId?: unknown; imageDataUrl?: unknown }
    const { imageId, imageDataUrl } = body

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

    const { mimeType, base64: imageBase64, byteLength: imageBytes } =
      await loadStudioImageBytes(auth.user.id, imageId)

    logger.info('📸 [Studio Extract] Request', {
      userId: auth.user.id,
      imageId,
      mimeType,
      imageBytes,
    })

    const client = new GeminiExtractionClient()
    const { raw } = await client.extract({ imageBase64, mimeType })

    const validator = new MinimalSchemaValidator()
    const { strictConformance, data, warnings } = validator.validate(raw)

    logger.info('✅ [Studio Extract] Success', {
      userId: auth.user.id,
      imageId,
      strictConformance,
      warningCount: warnings.length,
    })

    return NextResponse.json({ strictConformance, data, warnings })
  } catch (error) {
    if (error instanceof StudioImageLoadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof UnparseableExtractionResponseError) {
      logger.warn('⚠️ [Studio Extract] Unparseable extraction response', {
        error: error.message,
      })
      return NextResponse.json(
        { error: error.message, code: 'UNPARSEABLE_EXTRACTION_RESPONSE' },
        { status: 502 },
      )
    }

    logger.error('❌ [Studio Extract] Internal error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
