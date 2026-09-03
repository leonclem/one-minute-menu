/**
 * Photo Studio — workbench crop (deterministic, free).
 *
 * POST /api/studio/crop
 *
 * Cuts a normalised window from the current variant with sharp. Does not call
 * Gemini, debit credits, or count toward the daily generation cap.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStudioApi } from '@/lib/studio/studio-api-auth'
import {
  loadOwnedDishSource,
  OwnedStudioSourceNotFoundError,
} from '@/lib/studio/owned-source'
import { loadStudioImageBytes, StudioImageLoadError } from '@/lib/studio/image-bytes'
import { persistStudioImage } from '@/lib/studio/persistence'
import { setStudioDishCurrentImage } from '@/lib/studio/dishes'
import { CROP_ASPECT_PRESET_IDS } from '@/lib/studio/crop/constants'
import { type NormalizedCropRect } from '@/lib/studio/crop/geometry'
import { buildCropChildMetadata, parseCropAspectPreset } from '@/lib/studio/crop/metadata'
import { renderWorkbenchCrop, StudioCropRenderError } from '@/lib/studio/crop/render'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 30

const CropRectZ = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().gt(0).max(1),
    height: z.number().finite().gt(0).max(1),
  })
  .strict()
  .refine((rect) => rect.x + rect.width <= 1 + 1e-6 && rect.y + rect.height <= 1 + 1e-6, {
    message: 'Crop window must sit inside the image.',
  })

const CropBodyZ = z
  .object({
    sourceImageId: z.string().min(1),
    dishId: z.string().min(1),
    crop: CropRectZ,
    aspectPreset: z.enum(CROP_ASPECT_PRESET_IDS).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStudioApi()
    if (!auth.ok) return auth.response

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'A valid crop window is required.', code: 'CROP_INVALID' },
        { status: 400 },
      )
    }

    const parsed = CropBodyZ.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'A valid crop window is required.', code: 'CROP_INVALID' },
        { status: 400 },
      )
    }

    const { sourceImageId, dishId, crop } = parsed.data
    const aspectPreset = parseCropAspectPreset(parsed.data.aspectPreset)
    const cropRect: NormalizedCropRect = {
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
    }

    const { dish, image: parent } = await loadOwnedDishSource({
      userId: auth.user.id,
      dishId,
      sourceImageId,
    })

    if (dish.generation_blocked_at) {
      // Crop is free, but a blocked dish should not grow new working variants
      // until support clears the circuit breaker — same FOH gate as Edit image.
      return NextResponse.json(
        { error: 'Generations for this dish are paused.', code: 'STUDIO_DISH_GENERATION_BLOCKED' },
        { status: 409 },
      )
    }

    const loaded = await loadStudioImageBytes(auth.user.id, parent.id)
    const sourceBuffer = Buffer.from(loaded.base64, 'base64')

    const rendered = await renderWorkbenchCrop({
      sourceBuffer,
      sourceMimeType: loaded.mimeType,
      crop: cropRect,
    })

    const record = await persistStudioImage({
      userId: auth.user.id,
      dishId,
      role: 'generated',
      imageBase64: rendered.buffer.toString('base64'),
      mimeType: rendered.mimeType,
      sourceImageId: parent.id,
      prompt: null,
      model: null,
      metadata: buildCropChildMetadata({
        parentMetadata: parent.metadata,
        crop: cropRect,
        aspectPreset,
      }),
    })

    await setStudioDishCurrentImage(auth.user.id, dishId, record.id).catch(() => undefined)

    logger.info('Studio workbench crop persisted', {
      userId: auth.user.id,
      dishId,
      parentImageId: parent.id,
      imageId: record.id,
    })

    return NextResponse.json({ image: record })
  } catch (error) {
    if (error instanceof OwnedStudioSourceNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error instanceof StudioImageLoadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof StudioCropRenderError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }

    logger.error('Studio workbench crop failed', {
      error: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'Could not crop this image.' }, { status: 500 })
  }
}
