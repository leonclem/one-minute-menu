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
import { buildExtractionDiagnostics } from '@/lib/studio/extraction-diagnostics'
import { parseAndValidateImageDataUrl } from '@/lib/photo-control/request-validation'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

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

    // ── 4–5. Validate data URL format + size ──────────────────────────────────
    const parsed = parseAndValidateImageDataUrl(imageDataUrl, { fieldLabel: 'imageDataUrl' })
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { mimeType, base64: imageBase64, byteLength: imageBytes } = parsed

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
    const validated = validator.validate(raw)
    const { strictConformance, data, warnings } = validated
    const diagnostics = buildExtractionDiagnostics({
      raw,
      validated,
      warnings,
      strictConformance,
    })

    if (diagnostics.omittedFields.length > 0 || diagnostics.warnings.length > 0) {
      logger.warn('⚠️ [Photo Control Extract] Extraction diagnostics', {
        userId: admin.user.id,
        strictConformance,
        omittedFields: diagnostics.omittedFields,
        warningCount: diagnostics.warnings.length,
      })
    }

    logger.info('✅ [Photo Control Extract] Success', {
      userId: admin.user.id,
      strictConformance,
      warningCount: warnings.length,
    })

    // ── 8. Return validated result + bounded diagnostics ---------------------
    return NextResponse.json({ strictConformance, data, warnings, diagnostics })
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
