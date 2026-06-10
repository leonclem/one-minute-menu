/**
 * Photo Control — Phase A Extraction Route
 *
 * POST /api/admin/photo-control/extract
 *
 * Accepts a source image as a data URL, calls `GeminiExtractionClient` to
 * extract the visual structure, validates the raw JSON through
 * `MinimalSchemaValidator`, and returns the coerced schema + warnings.
 *
 * Requirements: 2.5, 13.1, 13.2, 13.3, 14.4
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { GeminiExtractionClient, UnparseableExtractionResponseError } from '@/lib/photo-control/gemini-extraction-client'
import { MinimalSchemaValidator } from '@/lib/photo-control/schema-validator'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const VALID_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_IMAGE_BYTES = 7 * 1024 * 1024 // 7 MB

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth gate (Requirements 13.1, 13.2, 13.3) ─────────────────────────
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    // ── 2. API key check (Requirement 14.4) ───────────────────────────────────
    if (!process.env.NANO_BANANA_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 },
      )
    }

    // ── 3. Parse request body ─────────────────────────────────────────────────
    const body = (await request.json()) as { imageDataUrl?: unknown }
    const { imageDataUrl } = body

    if (typeof imageDataUrl !== 'string' || !imageDataUrl) {
      return NextResponse.json(
        { error: 'imageDataUrl is required and must be a string' },
        { status: 400 },
      )
    }

    // ── 4. Validate data URL format (MIME type) ───────────────────────────────
    const dataUrlMatch = imageDataUrl.match(
      /^data:(image\/png|image\/jpeg|image\/webp);base64,/,
    )
    if (!dataUrlMatch) {
      return NextResponse.json(
        {
          error:
            'Invalid imageDataUrl. Must be a base64 data URL for image/png, image/jpeg, or image/webp.',
        },
        { status: 400 },
      )
    }

    const mimeType = dataUrlMatch[1] as 'image/png' | 'image/jpeg' | 'image/webp'
    if (!VALID_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid image MIME type. Allowed: image/png, image/jpeg, image/webp.' },
        { status: 400 },
      )
    }

    // ── 5. Extract base64 and validate size ───────────────────────────────────
    const imageBase64 = imageDataUrl.substring(dataUrlMatch[0].length).replace(/[\r\n\s]/g, '')

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data URL contains no data' }, { status: 400 })
    }

    const imageBytes = Buffer.from(imageBase64, 'base64').length
    if (imageBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Image exceeds the 7 MB size limit' },
        { status: 400 },
      )
    }

    logger.info('📸 [Photo Control Extract] Request', {
      userId: admin.user.id,
      mimeType,
      imageBytes,
    })

    // ── 6. Call GeminiExtractionClient (Requirement 2.5) ─────────────────────
    const client = new GeminiExtractionClient()
    const { raw } = await client.extract({ imageBase64, mimeType })

    // ── 7. Validate raw JSON through MinimalSchemaValidator (Requirement 2.5) ─
    const validator = new MinimalSchemaValidator()
    const { strictConformance, data, warnings } = validator.validate(raw)

    logger.info('✅ [Photo Control Extract] Success', {
      userId: admin.user.id,
      strictConformance,
      warningCount: warnings.length,
    })

    // ── 8. Return validated result ────────────────────────────────────────────
    return NextResponse.json({ strictConformance, data, warnings })
  } catch (error) {
    // ── 9. Handle unparseable extraction response → 502 ──────────────────────
    if (error instanceof UnparseableExtractionResponseError) {
      logger.warn('⚠️ [Photo Control Extract] Unparseable extraction response', {
        error: error.message,
      })
      return NextResponse.json(
        { error: error.message, code: 'UNPARSEABLE_EXTRACTION_RESPONSE' },
        { status: 502 },
      )
    }

    logger.error('❌ [Photo Control Extract] Internal error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
