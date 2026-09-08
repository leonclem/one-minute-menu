/**
 * Isolated Reframe spike runner. Does not touch Studio mutate, crop, or export.
 */

import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

import { STUDIO_FLASH_MODEL, configuredStudioImageSize } from '@/lib/studio/model-config'
import type { NanoBananaParams } from '@/types'
import {
  type ExpandLayout,
  insetPixels,
  padCanvas,
  paddingPixels,
  paintSourceBoundsOverlay,
  restoreRectAfterInset,
  restoreSourcePixels,
} from './canvas'
import { aspectRatioHonoured, nearestFlashAspectRatio, type FlashAspectRatio } from './aspect'
import { buildReframeSpikePrompt } from './prompt'
import { writeSpikeReport, type SpikeLayoutReport } from './report'

const MAX_SOURCE_SIDE = 1600

export type RunReframeSpikeInput = {
  sourceBuffer: Buffer
  sourceLabel: string
  outDir: string
  live: boolean
  layouts: ExpandLayout[]
  padRatio: number
  featherPx: number
  insetRatio: number
}

export type RunReframeSpikeResult = {
  reportPath: string
  outDir: string
  live: boolean
}

async function prepareSourcePng(sourceBuffer: Buffer): Promise<Buffer> {
  const oriented = sharp(sourceBuffer).rotate()
  const meta = await oriented.metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) throw new Error('Could not read the source image.')

  const longSide = Math.max(width, height)
  const pipeline =
    longSide > MAX_SOURCE_SIDE
      ? oriented.resize({
          width: width >= height ? MAX_SOURCE_SIDE : undefined,
          height: height > width ? MAX_SOURCE_SIDE : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : oriented

  return pipeline.ensureAlpha().png().toBuffer()
}

function mutationParams(
  prompt: string,
  paddedPng: Buffer,
  aspectRatio: FlashAspectRatio,
): NanoBananaParams {
  return {
    prompt,
    model: STUDIO_FLASH_MODEL,
    reference_images: [
      {
        mimeType: 'image/png',
        data: paddedPng.toString('base64'),
        role: 'dish',
        comment: 'Padded source photograph. Zoom out; fill transparent pixels with existing scene.',
      },
    ],
    person_generation: 'dont_allow',
    safety_filter_level: 'block_some',
    number_of_images: 1,
    image_size: configuredStudioImageSize(),
    aspect_ratio: aspectRatio,
    request_scope: 'studio_foh_mutation',
  }
}

export async function runReframeSpike(
  input: RunReframeSpikeInput,
): Promise<RunReframeSpikeResult> {
  const sourcePng = await prepareSourcePng(input.sourceBuffer)
  await mkdir(input.outDir, { recursive: true })
  await writeFile(join(input.outDir, 'source.png'), sourcePng)

  const { buildGeminiRequest } = await import('@/lib/nano-banana')
  const layoutReports: SpikeLayoutReport[] = []

  for (const layout of input.layouts) {
    const layoutDir = join(input.outDir, layout)
    await mkdir(layoutDir, { recursive: true })

    const sourceMeta = await sharp(sourcePng).metadata()
    const sourceWidth = sourceMeta.width ?? 0
    const sourceHeight = sourceMeta.height ?? 0
    const padding = paddingPixels(sourceWidth, sourceHeight, layout, input.padRatio)
    const padded = await padCanvas(sourcePng, padding)
    const insetPx = insetPixels(sourceWidth, sourceHeight, input.insetRatio)
    const restoreRect = restoreRectAfterInset(padded.sourceRect, padding, insetPx)
    const requestedAspect = nearestFlashAspectRatio(padded.width, padded.height)
    const overlay = await paintSourceBoundsOverlay(
      padded.buffer,
      padded.sourceRect,
      restoreRect,
    )
    const instructionPrompt = buildReframeSpikePrompt(layout, requestedAspect)
    const params = mutationParams(instructionPrompt, padded.buffer, requestedAspect)
    const loggedPrompt = buildGeminiRequest(params, { apiKey: 'not-sent' }).loggedPrompt

    await writeFile(join(layoutDir, 'padded.png'), padded.buffer)
    await writeFile(join(layoutDir, 'overlay.png'), overlay)
    await writeFile(join(layoutDir, 'prompt.txt'), `${instructionPrompt}\n`, 'utf8')
    await writeFile(join(layoutDir, 'logged-prompt.txt'), `${loggedPrompt}\n`, 'utf8')

    const files: Record<string, string> = {
      source: '../source.png',
      padded: `${layout}/padded.png`,
      overlay: `${layout}/overlay.png`,
    }

    const layoutReport: SpikeLayoutReport = {
      layout,
      instructionPrompt,
      loggedPrompt,
      paddedWidth: padded.width,
      paddedHeight: padded.height,
      sourceRect: padded.sourceRect,
      restoreRect,
      insetPx,
      requestedAspectRatio: requestedAspect,
      files,
      live: input.live,
      model: input.live ? STUDIO_FLASH_MODEL : null,
    }

    if (input.live) {
      const { getMutationEngine } = await import('@/lib/photo-control/mutation-engine')
      const engine = getMutationEngine()
      const result = await engine.mutate({
        sourceImageBase64: padded.buffer.toString('base64'),
        mimeType: 'image/png',
        prompt: instructionPrompt,
        model: STUDIO_FLASH_MODEL,
        aspectRatio: requestedAspect,
        styleReferences: [],
        request_scope: 'studio_foh_mutation',
      })

      const gemini = Buffer.from(result.imageBase64, 'base64')
      const geminiMeta = await sharp(gemini).metadata()
      await writeFile(join(layoutDir, 'gemini.png'), gemini)

      const restoreInput = {
        generated: gemini,
        source: sourcePng,
        paddedWidth: padded.width,
        paddedHeight: padded.height,
        sourceRect: padded.sourceRect,
      }
      const restoredHard = await restoreSourcePixels(restoreInput)
      const restoredInner = await restoreSourcePixels({
        ...restoreInput,
        restoreRect,
      })
      const restoredInnerFeather = await restoreSourcePixels({
        ...restoreInput,
        restoreRect,
        featherPx: input.featherPx,
      })
      await writeFile(join(layoutDir, 'restored-hard.png'), restoredHard)
      await writeFile(join(layoutDir, 'restored-inner.png'), restoredInner)
      await writeFile(join(layoutDir, 'restored-inner-feather.png'), restoredInnerFeather)

      files.gemini = `${layout}/gemini.png`
      files.restoredHard = `${layout}/restored-hard.png`
      files.restoredInner = `${layout}/restored-inner.png`
      files.restoredInnerFeather = `${layout}/restored-inner-feather.png`
      layoutReport.modelWidth = geminiMeta.width ?? null
      layoutReport.modelHeight = geminiMeta.height ?? null
      layoutReport.model = result.providerModelIdentity ?? STUDIO_FLASH_MODEL
      layoutReport.aspectRatioHonoured =
        geminiMeta.width && geminiMeta.height
          ? aspectRatioHonoured(geminiMeta.width, geminiMeta.height, requestedAspect)
          : null
    }

    layoutReports.push(layoutReport)
  }

  const reportPath = await writeSpikeReport(input.outDir, {
    sourceLabel: input.sourceLabel,
    live: input.live,
    padRatio: input.padRatio,
    featherPx: input.featherPx,
    insetRatio: input.insetRatio,
    createdAt: new Date().toISOString(),
    layouts: layoutReports,
  })

  return { reportPath, outDir: input.outDir, live: input.live }
}
