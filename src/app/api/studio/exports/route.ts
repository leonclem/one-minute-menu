/**
 * Photo Studio — Export Variants
 *
 * GET  /api/studio/exports?sourceImageId=…  list the export grid for a hero image
 * POST /api/studio/exports                  produce or enqueue one export variant
 *
 * Split by cost of the work:
 *  - `crop_resize` runs inline. It is deterministic, free, and sub-second, so
 *    queueing it would only make the free path slower.
 *  - `ai_expand` / `cutout` call Gemini and Replicate and take ~30s, well past
 *    the serverless budget. Those are enqueued for the Railway worker and the
 *    client polls GET until the tile reaches a terminal state.
 *
 * Credit policy: downloads and resizes are free. Paid methods are quoted up
 * front, checked for affordability at enqueue, re-checked by the worker, and
 * debited only once the asset exists.
 */

import { NextRequest, NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import {
  assertCanAffordStudioCredits,
  getStudioCreditBalance,
  StudioCreditsError,
} from '@/lib/studio/credits'
import { getStudioDish } from '@/lib/studio/dishes'
import {
  getExportPreset,
  isStudioExportVariantType,
} from '@/lib/studio/export-presets'
import {
  assertDishNotBlocked,
  StudioDishBlockedError,
} from '@/lib/studio/generation-failures'
import {
  renderCropResizeVariant,
  StudioExportRenderError,
} from '@/lib/studio/export-renderers'
import {
  buildExportTiles,
  completeExportVariant,
  failExportVariant,
  hasInFlightExportTiles,
  listExportVariantsForSource,
  planExportVariant,
  resolveExportMethodAvailability,
  resolveHeroDimensions,
  stageExportVariant,
  StudioExportError,
} from '@/lib/studio/export-variants'
import { loadStudioImageBytes, StudioImageLoadError } from '@/lib/studio/image-bytes'
import { getStudioImage } from '@/lib/studio/library'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import type { StudioImageRecord } from '@/lib/studio/types'

export const runtime = 'nodejs'
// Inline work is a sub-second sharp resize; paid work is handed to the worker.
export const maxDuration = 30

async function resolveHeroImage(
  userId: string,
  sourceImageId: unknown,
): Promise<
  | { ok: true; image: StudioImageRecord }
  | { ok: false; response: NextResponse }
> {
  if (typeof sourceImageId !== 'string' || !sourceImageId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'sourceImageId is required' },
        { status: 400 },
      ),
    }
  }

  const image = await getStudioImage(userId, sourceImageId)
  if (!image) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Image not found' }, { status: 404 }),
    }
  }
  if (!image.dish_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Image is not assigned to a dish' },
        { status: 400 },
      ),
    }
  }

  return { ok: true, image }
}

// ---------------------------------------------------------------------------
// GET — the export grid for one hero image (also the polling endpoint)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const sourceImageId = request.nextUrl.searchParams.get('sourceImageId')
    const hero = await resolveHeroImage(auth.user.id, sourceImageId)
    if (!hero.ok) return hero.response

    const [rows, balance] = await Promise.all([
      listExportVariantsForSource(auth.user.id, hero.image.id),
      getStudioCreditBalance(auth.user.id),
    ])

    // Only downloads bytes when the image predates dimension tracking; the
    // measured values are backfilled so this happens at most once per image.
    const source = await resolveHeroDimensions(hero.image, async () => {
      const { base64 } = await loadStudioImageBytes(auth.user.id, hero.image.id)
      return Buffer.from(base64, 'base64')
    })
    const tiles = buildExportTiles({ rows, source })

    const response = NextResponse.json({
      sourceImageId: hero.image.id,
      dishId: hero.image.dish_id,
      source,
      tiles,
      pending: hasInFlightExportTiles(tiles),
      credits: { balance },
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    logger.error('❌ [Studio Exports] GET failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — produce (inline) or enqueue (worker) one export variant
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let inlineVariantId: string | null = null

  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      sourceImageId?: unknown
      variantType?: unknown
    }

    if (!isStudioExportVariantType(body.variantType)) {
      return NextResponse.json(
        { error: 'variantType is not a supported export format' },
        { status: 400 },
      )
    }

    const preset = getExportPreset(body.variantType)
    if (!preset) {
      return NextResponse.json({ error: 'Unknown export format' }, { status: 400 })
    }

    const hero = await resolveHeroImage(auth.user.id, body.sourceImageId)
    if (!hero.ok) return hero.response

    const dishId = hero.image.dish_id as string
    const dish = await getStudioDish(auth.user.id, dishId)
    if (!dish) {
      return NextResponse.json({ error: 'Dish not found' }, { status: 404 })
    }

    const { base64: sourceBase64 } = await loadStudioImageBytes(
      auth.user.id,
      hero.image.id,
    )
    const sourceBuffer = Buffer.from(sourceBase64, 'base64')
    const source = await resolveHeroDimensions(hero.image, async () => sourceBuffer)

    const availability = resolveExportMethodAvailability()
    const plan = planExportVariant(preset, source, availability)

    if (!plan.available) {
      return NextResponse.json(
        {
          error: plan.unavailableReason ?? 'This export format is unavailable.',
          code: 'STUDIO_EXPORT_UNAVAILABLE',
        },
        { status: 503 },
      )
    }

    // Deterministic resizes are unaffected by the provider circuit breaker;
    // anything that calls a paid provider respects it.
    if (plan.queued) {
      assertDishNotBlocked(dish)
    }

    if (plan.estimatedCredits > 0) {
      await assertCanAffordStudioCredits(auth.user.id, plan.estimatedCredits)
    }

    const variant = await stageExportVariant({
      userId: auth.user.id,
      dishId,
      sourceImageId: hero.image.id,
      preset,
      method: plan.method,
      estimatedCredits: plan.estimatedCredits,
      status: plan.queued ? 'queued' : 'generating',
    })

    // ---- Worker path: hand off and let the client poll -------------------
    if (plan.queued) {
      const rows = await listExportVariantsForSource(auth.user.id, hero.image.id)
      const tiles = buildExportTiles({ rows, source, availability })

      logger.info('📥 [Studio Exports] Variant queued for worker', {
        userId: auth.user.id,
        variantId: variant.id,
        variantType: preset.key,
        method: plan.method,
        estimatedCredits: plan.estimatedCredits,
      })

      return NextResponse.json(
        {
          queued: true,
          tile: tiles.find((tile) => tile.variantType === preset.key) ?? null,
          tiles,
          pending: hasInFlightExportTiles(tiles),
          credits: {
            cost: plan.estimatedCredits,
            balanceAfter: await getStudioCreditBalance(auth.user.id),
          },
        },
        { status: 202 },
      )
    }

    // ---- Inline path: deterministic, free, sub-second --------------------
    inlineVariantId = variant.id
    const startedAt = Date.now()
    const rendered = await renderCropResizeVariant(sourceBuffer, preset)

    await completeExportVariant({
      userId: auth.user.id,
      variant,
      buffer: rendered.buffer,
      mimeType: rendered.mimeType,
      creditsCharged: 0,
      metadata: {
        generation_method: plan.method,
        duration_ms: Date.now() - startedAt,
        bytes: rendered.buffer.length,
        source_width: source?.width ?? null,
        source_height: source?.height ?? null,
      },
    })
    inlineVariantId = null

    const rows = await listExportVariantsForSource(auth.user.id, hero.image.id)
    const tiles = buildExportTiles({ rows, source, availability })

    logger.info('✅ [Studio Exports] Inline variant ready', {
      userId: auth.user.id,
      variantType: preset.key,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      queued: false,
      tile: tiles.find((tile) => tile.variantType === preset.key) ?? null,
      tiles,
      pending: hasInFlightExportTiles(tiles),
      credits: { cost: 0, balanceAfter: await getStudioCreditBalance(auth.user.id) },
    })
  } catch (error) {
    if (inlineVariantId) {
      const message = error instanceof Error ? error.message : 'Export failed'
      await failExportVariant(inlineVariantId, message).catch(() => undefined)
    }

    if (error instanceof StudioDishBlockedError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }

    if (error instanceof StudioExportError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }

    if (error instanceof StudioCreditsError) {
      return NextResponse.json(
        { error: error.message, code: 'STUDIO_INSUFFICIENT_CREDITS' },
        { status: error.status },
      )
    }

    if (error instanceof StudioImageLoadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof StudioExportRenderError) {
      logger.warn('⚠️ [Studio Exports] Inline render failed', {
        code: error.code,
        message: error.message,
      })
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }

    logger.error('❌ [Studio Exports] POST failed', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
