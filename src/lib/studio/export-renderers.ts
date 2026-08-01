/**
 * Photo Studio — export variant renderers.
 *
 * Turns an approved hero image into one channel-ready asset. Three strategies:
 *  - `crop_resize`  deterministic sharp centre-crop + resize (free, fast)
 *  - `ai_expand`    outpaint via the shared MutationEngine, then normalise
 *  - `cutout`       background removal, then centre on a transparent canvas
 *
 * Server-only: imports sharp and the provider clients.
 */

import sharp from 'sharp'

import { logger } from '@/lib/logger'
import { getMutationEngine } from '@/lib/photo-control/mutation-engine'
import {
  CUTOUT_CANVAS_PADDING_RATIO,
  EXPORT_JPEG_QUALITY,
  MIME_BY_EXPORT_FILE_TYPE,
  type StudioExportGenerationMethod,
  type StudioExportPreset,
} from '@/lib/studio/export-presets'
import { STUDIO_FLASH_MODEL } from '@/lib/studio/model-config'

export class StudioExportRenderError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status = 502) {
    super(message)
    this.name = 'StudioExportRenderError'
    this.code = code
    this.status = status
  }
}

export interface RenderedExportVariant {
  buffer: Buffer
  mimeType: string
  width: number
  height: number
  /** Prompt sent to the image model, when a generative method was used. */
  prompt?: string
  model?: string
  /**
   * Dimensions the model returned before normalisation to the preset size.
   * Lets us tell "the model honoured the requested aspect ratio" apart from
   * "sharp centre-cropped a square result", which look identical in the output.
   */
  modelWidth?: number | null
  modelHeight?: number | null
  /** Aspect ratio asked of the model, when one was requested. */
  requestedAspectRatio?: string | null
}

/** True unless explicitly disabled — lets operators turn off paid outpainting. */
export function isExportAiExpandEnabled(): boolean {
  return process.env.STUDIO_EXPORT_AI_EXPAND_DISABLED !== 'true'
}

/** Encode a buffer to the preset's output format at the exact target size. */
async function encodeToPreset(
  input: Buffer,
  preset: StudioExportPreset,
  options?: { fit?: 'cover' | 'contain' },
): Promise<RenderedExportVariant> {
  const fit = options?.fit ?? 'cover'
  let pipeline = sharp(input).resize({
    width: preset.width,
    height: preset.height,
    fit,
    position: 'centre',
    withoutEnlargement: false,
    background:
      preset.fileType === 'png'
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : { r: 255, g: 255, b: 255, alpha: 1 },
  })

  if (preset.fileType === 'jpg') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({
      quality: EXPORT_JPEG_QUALITY,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
    })
  } else if (preset.fileType === 'webp') {
    pipeline = pipeline.webp({ quality: EXPORT_JPEG_QUALITY })
  } else {
    pipeline = pipeline.png({ compressionLevel: 9 })
  }

  const buffer = await pipeline.toBuffer()

  return {
    buffer,
    mimeType: MIME_BY_EXPORT_FILE_TYPE[preset.fileType],
    width: preset.width,
    height: preset.height,
  }
}

/**
 * Deterministic crop/resize from the hero image. No credits, no provider call.
 */
export async function renderCropResizeVariant(
  sourceBuffer: Buffer,
  preset: StudioExportPreset,
): Promise<RenderedExportVariant> {
  try {
    return await encodeToPreset(sourceBuffer, preset)
  } catch (error) {
    throw new StudioExportRenderError(
      `Failed to resize image for ${preset.label}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      'EXPORT_RESIZE_FAILED',
      500,
    )
  }
}

/**
 * Prompt for background expansion. Deliberately narrow: the dish must survive
 * untouched, only the surface and backdrop may be extended.
 */
export function buildExportExpandPrompt(preset: StudioExportPreset): string {
  const orientation =
    preset.width > preset.height
      ? 'landscape'
      : preset.width < preset.height
        ? 'portrait'
        : 'square'

  return [
    `Reframe this food photograph as a ${orientation} ${preset.aspectRatio} composition by extending the existing scene outward.`,
    'Preserve the dish exactly as photographed: identical food, plating, vessel, garnishes, portion, colour, and lighting. Do not re-cook, re-plate, or restyle it.',
    'Only continue the existing tabletop surface and background into the new area, matching its texture, colour, grain direction, shadow direction, and depth of field.',
    'Keep the dish centred with comfortable margin on all sides and do not crop it.',
    'Do not add new food, props, hands, people, text, logos, or watermarks.',
  ].join(' ')
}

/**
 * AI background expansion for formats a centre crop would damage.
 * Output is normalised to the exact preset dimensions afterwards.
 */
export async function renderAiExpandVariant(input: {
  sourceBase64: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  preset: StudioExportPreset
}): Promise<RenderedExportVariant> {
  const prompt = buildExportExpandPrompt(input.preset)
  const engine = getMutationEngine()

  const { imageBase64 } = await engine.mutate({
    sourceImageBase64: input.sourceBase64,
    mimeType: input.mimeType,
    prompt,
    model: STUDIO_FLASH_MODEL,
    aspectRatio: input.preset.requestAspectRatio,
    styleReferences: [],
    request_scope: 'studio_foh_mutation',
  })

  const expanded = Buffer.from(imageBase64, 'base64')

  let modelWidth: number | null = null
  let modelHeight: number | null = null
  try {
    const meta = await sharp(expanded).metadata()
    modelWidth = meta.width ?? null
    modelHeight = meta.height ?? null
  } catch {
    // Diagnostics only — never fail a produced asset over a metadata read.
  }

  const requested = input.preset.requestAspectRatio ?? null
  const targetAspect = input.preset.width / input.preset.height
  const honoured =
    modelWidth && modelHeight
      ? Math.abs(modelWidth / modelHeight - targetAspect) / targetAspect <= 0.1
      : null

  logger.info('🖼️ [Studio Export] AI expand returned', {
    variantType: input.preset.key,
    requestedAspectRatio: requested,
    modelWidth,
    modelHeight,
    // False means the model ignored the aspect hint and the result was
    // centre-cropped to fit, so the reframe was weaker than intended.
    aspectRatioHonoured: honoured,
  })

  const encoded = await encodeToPreset(expanded, input.preset)

  return {
    ...encoded,
    prompt,
    model: STUDIO_FLASH_MODEL,
    modelWidth,
    modelHeight,
    requestedAspectRatio: requested,
  }
}

/**
 * Transparent cut-out: remove the background, trim to the subject, then centre
 * it on a square transparent canvas with comfortable padding.
 */
export async function renderCutoutVariant(input: {
  imageUrl: string
  preset: StudioExportPreset
}): Promise<RenderedExportVariant> {
  // Imported lazily so the Replicate SDK is only loaded when a cut-out is asked for.
  const { getBackgroundRemovalProvider } = await import(
    '@/lib/background-removal/provider-factory'
  )

  const provider = getBackgroundRemovalProvider()
  const { imageBuffer, modelVersion, processingTimeMs } = await provider.removeBackground(
    input.imageUrl,
  )

  logger.info('🪄 [Studio Export] Background removed', {
    modelVersion,
    processingTimeMs,
    bytes: imageBuffer.length,
  })

  const { preset } = input
  const size = preset.width
  const inner = Math.max(
    1,
    Math.round(size * (1 - CUTOUT_CANVAS_PADDING_RATIO * 2)),
  )

  // Trim the transparent border so padding is measured from the dish itself.
  let subject = imageBuffer
  try {
    subject = await sharp(imageBuffer).ensureAlpha().trim({ threshold: 1 }).toBuffer()
  } catch (error) {
    logger.warn('⚠️ [Studio Export] Cut-out trim failed; using untrimmed subject', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const fitted = await sharp(subject)
    .ensureAlpha()
    .resize({
      width: inner,
      height: inner,
      fit: 'inside',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const meta = await sharp(fitted).metadata()
  const fittedWidth = meta.width ?? inner
  const fittedHeight = meta.height ?? inner
  const left = Math.max(0, Math.floor((size - fittedWidth) / 2))
  const top = Math.max(0, Math.floor((preset.height - fittedHeight) / 2))

  const buffer = await sharp(fitted)
    .extend({
      top,
      bottom: Math.max(0, preset.height - fittedHeight - top),
      left,
      right: Math.max(0, size - fittedWidth - left),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer()

  return {
    buffer,
    mimeType: MIME_BY_EXPORT_FILE_TYPE.png,
    width: preset.width,
    height: preset.height,
    model: modelVersion,
  }
}

/** Dispatch to the renderer for a resolved generation method. */
export async function renderExportVariant(input: {
  method: StudioExportGenerationMethod
  preset: StudioExportPreset
  sourceBuffer: Buffer
  sourceBase64: string
  sourceMimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  sourceUrl: string
}): Promise<RenderedExportVariant> {
  switch (input.method) {
    case 'crop_resize':
      return renderCropResizeVariant(input.sourceBuffer, input.preset)
    case 'ai_expand':
    case 'ai_recompose':
      return renderAiExpandVariant({
        sourceBase64: input.sourceBase64,
        mimeType: input.sourceMimeType,
        preset: input.preset,
      })
    case 'cutout':
      return renderCutoutVariant({ imageUrl: input.sourceUrl, preset: input.preset })
    default:
      throw new StudioExportRenderError(
        `Unsupported export generation method: ${input.method}`,
        'EXPORT_METHOD_UNSUPPORTED',
        400,
      )
  }
}
