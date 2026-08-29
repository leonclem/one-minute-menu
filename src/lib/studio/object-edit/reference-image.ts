import 'server-only'

import { createHash } from 'crypto'

import sharp from 'sharp'

import {
  PHOTO_CONTROL_VALID_MIME_TYPES,
  type PhotoControlMimeType,
} from '@/lib/photo-control/request-validation'
import {
  StructuredEditIntentZ,
  type NormalizedPoint,
  type StructuredEditIntent,
} from '@/lib/studio/object-edit/contracts'

export const ANNOTATION_RENDERER_VERSION = 1 as const

const PNG_OPTIONS = {
  compressionLevel: 9,
  adaptiveFiltering: false,
  palette: false,
} as const

const SOURCE_FORMAT_BY_MIME: Record<PhotoControlMimeType, 'png' | 'jpeg' | 'webp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
}

export class ObjectEditImagePreparationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ObjectEditImagePreparationError'
  }
}

export interface PreparedObjectEditImage {
  data: string
  mimeType: 'image/png'
  width: number
  height: number
}

export interface ObjectEditGuidanceManifest {
  selectionStrokeCount: number
  targetMarkerCount: number
  destinationMarkerCount: number
  moveArrowCount: number
  hasMovePlacementGuide: false
  hasTranslatedBoundingGuide: false
}

export interface PreparedObjectEditImages {
  clean: PreparedObjectEditImage
  annotated: PreparedObjectEditImage
  rendererVersion: typeof ANNOTATION_RENDERER_VERSION
  renderDigest: string
  guidance: ObjectEditGuidanceManifest
}

export interface PrepareObjectEditImagesInput {
  sourceBytes: Buffer
  sourceMimeType: PhotoControlMimeType
  intent: StructuredEditIntent
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new ObjectEditImagePreparationError('Guidance contains a non-finite coordinate.')
  }

  const fixed = value.toFixed(3)
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
}

/** Stable JSON prevents render digests from depending on object insertion order. */
export function serializeObjectEditValue(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ObjectEditImagePreparationError('Structured object-edit data contains a non-finite number.')
    }
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => serializeObjectEditValue(entry)).join(',')}]`
  }

  if (typeof value === 'object' && value !== undefined) {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serializeObjectEditValue(record[key])}`)
      .join(',')}}`
  }

  throw new ObjectEditImagePreparationError('Structured object-edit data contains an unsupported value.')
}

function svgEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

function pointAt(point: NormalizedPoint, width: number, height: number): { x: number; y: number } {
  return { x: point.x * width, y: point.y * height }
}

function markerSvg(point: NormalizedPoint, width: number, height: number, kind: 'target' | 'destination'): string {
  const { x, y } = pointAt(point, width, height)
  const radius = Math.max(8, Math.min(width, height) * 0.025)
  const crosshair = radius * 1.45
  const innerColor = kind === 'target' ? '#00D9FF' : '#FFD400'
  const label = kind === 'target' ? 'selection target' : 'move destination'

  return `<g data-guidance="${label}" fill="none" stroke-linecap="round">` +
    `<circle cx="${formatNumber(x)}" cy="${formatNumber(y)}" r="${formatNumber(radius)}" stroke="#111827" stroke-width="${formatNumber(radius * 0.5)}"/>` +
    `<circle cx="${formatNumber(x)}" cy="${formatNumber(y)}" r="${formatNumber(radius)}" stroke="${innerColor}" stroke-width="${formatNumber(Math.max(2, radius * 0.22))}"/>` +
    `<path d="M ${formatNumber(x - crosshair)} ${formatNumber(y)} H ${formatNumber(x + crosshair)} M ${formatNumber(x)} ${formatNumber(y - crosshair)} V ${formatNumber(y + crosshair)}" stroke="#111827" stroke-width="${formatNumber(Math.max(3, radius * 0.32))}"/>` +
    `<path d="M ${formatNumber(x - crosshair)} ${formatNumber(y)} H ${formatNumber(x + crosshair)} M ${formatNumber(x)} ${formatNumber(y - crosshair)} V ${formatNumber(y + crosshair)}" stroke="${innerColor}" stroke-width="${formatNumber(Math.max(1.5, radius * 0.13))}"/>` +
    `</g>`
}

function pathStrokeSvg(points: readonly NormalizedPoint[], width: number, height: number): string {
  const commands = points
    .map((point, index) => {
      const { x, y } = pointAt(point, width, height)
      return `${index === 0 ? 'M' : 'L'} ${formatNumber(x)} ${formatNumber(y)}`
    })
    .join(' ')
  const strokeWidth = Math.max(5, Math.min(width, height) * 0.012)

  return `<path data-guidance="selection stroke" d="${svgEscape(commands)}" fill="none" stroke="#111827" stroke-width="${formatNumber(strokeWidth + 4)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path data-guidance="selection stroke" d="${svgEscape(commands)}" fill="none" stroke="#00D9FF" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function arrowSvg(source: NormalizedPoint, destination: NormalizedPoint, width: number, height: number): string {
  const start = pointAt(source, width, height)
  const end = pointAt(destination, width, height)
  const angle = Math.atan2(end.y - start.y, end.x - start.x) || -Math.PI / 2
  const headLength = Math.max(12, Math.min(width, height) * 0.04)
  const left = {
    x: end.x - headLength * Math.cos(angle - Math.PI / 6),
    y: end.y - headLength * Math.sin(angle - Math.PI / 6),
  }
  const right = {
    x: end.x - headLength * Math.cos(angle + Math.PI / 6),
    y: end.y - headLength * Math.sin(angle + Math.PI / 6),
  }
  const strokeWidth = Math.max(5, Math.min(width, height) * 0.012)
  const line = `M ${formatNumber(start.x)} ${formatNumber(start.y)} L ${formatNumber(end.x)} ${formatNumber(end.y)}`
  const head = `M ${formatNumber(left.x)} ${formatNumber(left.y)} L ${formatNumber(end.x)} ${formatNumber(end.y)} L ${formatNumber(right.x)} ${formatNumber(right.y)}`

  return `<g data-guidance="move arrow" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${line}" stroke="#111827" stroke-width="${formatNumber(strokeWidth + 4)}"/>` +
    `<path d="${head}" stroke="#111827" stroke-width="${formatNumber(strokeWidth + 4)}"/>` +
    `<path d="${line}" stroke="#FF7A00" stroke-width="${formatNumber(strokeWidth)}"/>` +
    `<path d="${head}" stroke="#FF7A00" stroke-width="${formatNumber(strokeWidth)}"/>` +
    `</g>`
}

function buildGuidanceSvg(intent: StructuredEditIntent, width: number, height: number): {
  svg: Buffer
  guidance: ObjectEditGuidanceManifest
} {
  const selectionGraphics = intent.selection.strokes.map((stroke) =>
    stroke.kind === 'tap'
      ? markerSvg(stroke.points[0], width, height, 'target')
      : pathStrokeSvg(stroke.points, width, height),
  )
  const targetMarkerCount = intent.selection.strokes.filter((stroke) => stroke.kind === 'tap').length
  const moveGraphics =
    intent.operation === 'move'
      ? [
          arrowSvg(intent.placement.source, intent.placement.destination, width, height),
          markerSvg(intent.placement.destination, width, height, 'destination'),
        ]
      : []

  return {
    svg: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        [...selectionGraphics, ...moveGraphics].join('') +
        `</svg>`,
      'utf8',
    ),
    guidance: {
      selectionStrokeCount: intent.selection.strokes.length,
      targetMarkerCount,
      destinationMarkerCount: intent.operation === 'move' ? 1 : 0,
      moveArrowCount: intent.operation === 'move' ? 1 : 0,
      hasMovePlacementGuide: false,
      hasTranslatedBoundingGuide: false,
    },
  }
}

async function decodePng(buffer: Buffer, label: string): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(buffer, { failOn: 'error' }).metadata()
    if (!metadata.width || !metadata.height || metadata.width <= 0 || metadata.height <= 0) {
      throw new ObjectEditImagePreparationError(`${label} has unavailable decoded dimensions.`)
    }
    return { width: metadata.width, height: metadata.height }
  } catch (error) {
    if (error instanceof ObjectEditImagePreparationError) throw error
    throw new ObjectEditImagePreparationError(`${label} could not be decoded.`)
  }
}

/**
 * Produces the server-authoritative clean Image A and operation-specific annotated Image B.
 * The accepted intent is validated but its normalized coordinates are never rounded or altered.
 */
export async function prepareObjectEditImages(
  input: PrepareObjectEditImagesInput,
): Promise<PreparedObjectEditImages> {
  if (!Buffer.isBuffer(input.sourceBytes) || input.sourceBytes.length === 0) {
    throw new ObjectEditImagePreparationError('Source image bytes are required.')
  }
  if (!PHOTO_CONTROL_VALID_MIME_TYPES.has(input.sourceMimeType)) {
    throw new ObjectEditImagePreparationError('Source image MIME type is unsupported.')
  }

  let intent: StructuredEditIntent
  try {
    const intentResult = StructuredEditIntentZ.safeParse(input.intent)
    if (!intentResult.success) {
      throw new ObjectEditImagePreparationError('Object-edit guidance is invalid.')
    }
    intent = intentResult.data
  } catch (error) {
    if (error instanceof ObjectEditImagePreparationError) throw error
    throw new ObjectEditImagePreparationError('Object-edit guidance is invalid.')
  }

  let cleanBuffer: Buffer
  try {
    const source = sharp(input.sourceBytes, { failOn: 'error' })
    const metadata = await source.metadata()
    if (metadata.format !== SOURCE_FORMAT_BY_MIME[input.sourceMimeType]) {
      throw new ObjectEditImagePreparationError('Source image bytes do not match the declared MIME type.')
    }

    // Decode and auto-orient exactly once, then derive both output images from these pixels.
    const normalized = await source.rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (!normalized.info.width || !normalized.info.height) {
      throw new ObjectEditImagePreparationError('Source image has unavailable decoded dimensions.')
    }
    cleanBuffer = await sharp(normalized.data, {
      raw: {
        width: normalized.info.width,
        height: normalized.info.height,
        channels: normalized.info.channels,
      },
    })
      .png(PNG_OPTIONS)
      .toBuffer()
  } catch (error) {
    if (error instanceof ObjectEditImagePreparationError) throw error
    throw new ObjectEditImagePreparationError('Source image data could not be decoded.')
  }

  const cleanDimensions = await decodePng(cleanBuffer, 'Clean source image')
  const overlay = buildGuidanceSvg(intent, cleanDimensions.width, cleanDimensions.height)

  let annotatedBuffer: Buffer
  try {
    annotatedBuffer = await sharp(cleanBuffer, { failOn: 'error' })
      .composite([{ input: overlay.svg, top: 0, left: 0 }])
      .png(PNG_OPTIONS)
      .toBuffer()
  } catch {
    throw new ObjectEditImagePreparationError('Annotated reference image could not be prepared.')
  }

  const annotatedDimensions = await decodePng(annotatedBuffer, 'Annotated reference image')
  if (
    cleanDimensions.width !== annotatedDimensions.width ||
    cleanDimensions.height !== annotatedDimensions.height ||
    cleanDimensions.width / cleanDimensions.height !== annotatedDimensions.width / annotatedDimensions.height
  ) {
    throw new ObjectEditImagePreparationError('Clean and annotated image dimensions do not match.')
  }

  const renderDigest = createHash('sha256')
    .update(createHash('sha256').update(cleanBuffer).digest('hex'))
    .update(serializeObjectEditValue(intent))
    .update(String(ANNOTATION_RENDERER_VERSION))
    .digest('hex')

  return {
    clean: {
      data: cleanBuffer.toString('base64'),
      mimeType: 'image/png',
      width: cleanDimensions.width,
      height: cleanDimensions.height,
    },
    annotated: {
      data: annotatedBuffer.toString('base64'),
      mimeType: 'image/png',
      width: annotatedDimensions.width,
      height: annotatedDimensions.height,
    },
    rendererVersion: ANNOTATION_RENDERER_VERSION,
    renderDigest,
    guidance: overlay.guidance,
  }
}
