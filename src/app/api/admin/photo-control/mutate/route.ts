/**
 * Photo Control — Phase B Mutation Route
 *
 * POST /api/admin/photo-control/mutate
 *
 * Accepts a source image data URL, original/target MinimalSchema states, and a
 * directive. Composes the mutation prompt via `composePrompt`, dispatches to
 * `MutationEngine`, and returns the mutated image as a data URL.
 *
 * Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 13.1, 13.2, 13.3,
 *               14.1, 14.2, 14.3, 14.4, 16.2, 16.3
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { NanoBananaError } from '@/lib/nano-banana'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'
import { composePrompt } from '@/lib/photo-control/prompt-composer'
import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
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
    const body = (await request.json()) as {
      sourceImageDataUrl?: unknown
      originalState?: unknown
      targetState?: unknown
      directive?: unknown
      model?: unknown
    }

    const { sourceImageDataUrl, originalState, targetState, directive, model } = body

    if (typeof sourceImageDataUrl !== 'string' || !sourceImageDataUrl) {
      return NextResponse.json(
        { error: 'sourceImageDataUrl is required and must be a string' },
        { status: 400 },
      )
    }

    if (!originalState || typeof originalState !== 'object') {
      return NextResponse.json(
        { error: 'originalState is required and must be an object' },
        { status: 400 },
      )
    }

    if (!targetState || typeof targetState !== 'object') {
      return NextResponse.json(
        { error: 'targetState is required and must be an object' },
        { status: 400 },
      )
    }

    if (typeof directive !== 'string' || !directive.trim()) {
      return NextResponse.json(
        { error: 'directive is required and must be a non-empty string' },
        { status: 400 },
      )
    }

    // ── 4. Validate sourceImageDataUrl format ─────────────────────────────────
    const dataUrlMatch = sourceImageDataUrl.match(
      /^data:(image\/png|image\/jpeg|image\/webp);base64,/,
    )
    if (!dataUrlMatch) {
      return NextResponse.json(
        {
          error:
            'Invalid sourceImageDataUrl. Must be a base64 data URL for image/png, image/jpeg, or image/webp.',
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

    const sourceImageBase64 = sourceImageDataUrl
      .substring(dataUrlMatch[0].length)
      .replace(/[\r\n\s]/g, '')

    if (!sourceImageBase64) {
      return NextResponse.json(
        { error: 'Source image data URL contains no data' },
        { status: 400 },
      )
    }

    const imageBytes = Buffer.from(sourceImageBase64, 'base64').length
    if (imageBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Source image exceeds the 7 MB size limit' },
        { status: 400 },
      )
    }

    // ── 5. Compose the mutation prompt (Requirements 10.1, 10.6, 11.2, 16.1) ─
    const compositionResult = composePrompt({
      directive: directive.trim(),
      originalState: originalState as MinimalSchema,
      targetState: targetState as MinimalSchema,
    })

    // ── 6. Handle composition failure → 400 (Requirement 10.6) ───────────────
    if (!compositionResult.ok) {
      return NextResponse.json(
        { error: compositionResult.error, code: compositionResult.code },
        { status: 400 },
      )
    }

    logger.info('🎨 [Photo Control Mutate] Request', {
      userId: admin.user.id,
      mimeType,
      imageBytes,
      promptLength: compositionResult.prompt.length,
    })

    // ── 7. Dispatch to MutationEngine (Requirements 10.2, 10.3, 10.7) ────────
    const engine = getMutationEngine()
    const targetModel = typeof model === 'string' ? model : 'gemini-3.1-flash-image-preview'
    
    const { imageBase64, thoughtSignature } = await engine.mutate({
      sourceImageBase64,
      mimeType,
      prompt: compositionResult.prompt,
      model: targetModel,
    })

    logger.info('✅ [Photo Control Mutate] Success', {
      userId: admin.user.id,
      model: targetModel,
      hasThoughtSignature: !!thoughtSignature,
    })

    // ── 8. Return mutated image as data URL (Requirements 10.4, 16.2, 16.3) ──
    return NextResponse.json({
      imageUrl: `data:image/png;base64,${imageBase64}`,
      thoughtSignature: thoughtSignature ?? undefined,
      model: targetModel,
    })
  } catch (error) {
    // ── 9. Map NanoBananaError codes to HTTP statuses ─────────────────────────
    // Requirements: 14.1, 14.2, 14.3, 14.4
    if (error instanceof NanoBananaError) {
      let status: number

      switch (error.code) {
        case 'CONTENT_POLICY_VIOLATION':
          status = 403
          break
        case 'SAFETY_FILTER_BLOCKED':
          status = 403
          break
        case 'RATE_LIMIT_EXCEEDED':
          status = 429
          break
        case 'AUTHENTICATION_ERROR':
          status = 401
          break
        case 'SERVICE_UNAVAILABLE':
          status = 503
          break
        case 'NO_IMAGE_PRODUCED':
          status = 502
          break
        default:
          status = 400
          break
      }

      logger.warn('⚠️ [Photo Control Mutate] NanoBananaError', {
        code: error.code,
        status,
        message: error.message,
      })

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          retryAfter: error.retryAfter,
          filterReason: error.filterReason,
          suggestions: error.suggestions,
        },
        { status },
      )
    }

    logger.error('❌ [Photo Control Mutate] Internal error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
