/**
 * Photo Studio — Phase A Extraction Route (customer-facing)
 *
 * POST /api/studio/extract
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import { GeminiExtractionClient, UnparseableExtractionResponseError } from '@/lib/photo-control/gemini-extraction-client'
import { MinimalSchemaValidator } from '@/lib/photo-control/schema-validator'
import { parseAndValidateImageDataUrl } from '@/lib/photo-control/request-validation'
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

    const body = (await request.json()) as { imageDataUrl?: unknown }
    const { imageDataUrl } = body

    if (typeof imageDataUrl !== 'string' || !imageDataUrl) {
      return NextResponse.json(
        { error: 'imageDataUrl is required and must be a string' },
        { status: 400 },
      )
    }

    const parsed = parseAndValidateImageDataUrl(imageDataUrl, { fieldLabel: 'imageDataUrl' })
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { mimeType, base64: imageBase64, byteLength: imageBytes } = parsed

    logger.info('📸 [Studio Extract] Request', {
      userId: auth.user.id,
      mimeType,
      imageBytes,
    })

    const client = new GeminiExtractionClient()
    const { raw } = await client.extract({ imageBase64, mimeType })

    const validator = new MinimalSchemaValidator()
    const { strictConformance, data, warnings } = validator.validate(raw)

    logger.info('✅ [Studio Extract] Success', {
      userId: auth.user.id,
      strictConformance,
      warningCount: warnings.length,
    })

    return NextResponse.json({ strictConformance, data, warnings })
  } catch (error) {
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
