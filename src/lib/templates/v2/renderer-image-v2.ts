/**
 * V2 Image Renderer - PNG Export for LayoutDocumentV2
 *
 * Generates a PNG screenshot of a LayoutDocumentV2 using the same React components
 * as the web preview / PDF renderer, to keep visual output consistent.
 *
 * Notes:
 * - This renderer currently exports the FIRST page only.
 * - Images should already be optimized/inlined (base64) by the caller when running
 *   in restricted network environments (e.g. worker Docker sandbox).
 */

import { acquirePage } from '../export/puppeteer-shared'
import { getTextureDataURL, fetchImageAsDataURL } from '../export/texture-utils'
import { logger } from '../../logger'
import type { ImageModeV2, LayoutDocumentV2 } from './engine-types-v2'
import {
  DEFAULT_PALETTE_V2,
  PALETTES_V2,
} from './palettes-v2'
import {
  PALETTE_TEXTURE_MAP,
  TEXTURE_REGISTRY,
  getFontStylePresetGoogleFontsUrl,
  getFontSet,
  type RenderOptionsV2,
} from './renderer-v2'
import type { BannerContentV2, FontStylePreset } from './engine-types-v2'

// Import default component (TSX) for rendering LayoutDocumentV2
import LayoutPreviewV2 from './renderer-web-v2'

// ============================================================================
// Image Export Options / Result
// ============================================================================

export interface ImageExportOptionsV2 {
  /** Color palette ID to use */
  paletteId?: string
  /** Optional texture ID (overrides palette-based texture when set) */
  textureId?: string
  /** Enable textured backgrounds for supported palettes */
  texturesEnabled?: boolean
  /** Additional CSS to inject */
  customCSS?: string
  /** Device pixel ratio for high-DPI outputs */
  deviceScaleFactor?: number
  /** Enable vignette edge effect */
  showVignette?: boolean
  /** Add very subtle borders to every menu item tile */
  itemBorders?: boolean
  /** Add drop shadow to every menu item tile */
  itemDropShadow?: boolean
  /** Fill menu item tiles with the palette background colour */
  fillItemTiles?: boolean
  /** Override spacer (filler) tile rendering with this pattern ID */
  spacerTilePatternId?: string
  /** Font style preset for banner title and section headers */
  fontStylePreset?: any
  /** Centre-align category headings and item text */
  centreAlignment?: boolean
  /** Image rendering mode */
  imageMode?: ImageModeV2
  /** When true, suppress the "SAMPLE" stamp overlay on placeholder item tiles */
  hideSampleLabels?: boolean
}

export interface ImageExportResultV2 {
  /** PNG image buffer */
  imageBuffer: Buffer
  /** Size in bytes */
  size: number
  /** Image width in pixels */
  width: number
  /** Image height in pixels */
  height: number
  /** Number of pages in the document (export currently returns first page only) */
  pageCount: number
  /** Generation timestamp */
  timestamp: Date
  /** Generation duration in milliseconds */
  duration: number
  /** Template and engine info */
  metadata: {
    templateId: string
    templateVersion: string
    engineVersion: string
  }
}

// ============================================================================
// Main Image Export Function
// ============================================================================

export async function renderToImageV2(
  document: LayoutDocumentV2,
  options: ImageExportOptionsV2 = {}
): Promise<ImageExportResultV2> {
  const startTime = Date.now()
  let page: any

  try {
    logger.info(`[ImageRendererV2] Starting PNG generation for document: ${document.templateId}`)

    page = await acquirePage()

    // pageSpec dimensions are in points (1pt = 1/72 inch).
    // The React component multiplies all positions/sizes by `scale`.
    // To convert points to CSS pixels (1px = 1/96 inch): px = pt * 96/72.
    // This must match the scale passed to LayoutPreviewV2 below.
    const PT_TO_PX = 96 / 72
    const pageCount = document.pages.length
    const widthPx = Math.ceil(document.pageSpec.width * PT_TO_PX)
    // Add a visible gap between pages so they don't appear flush when stacked.
    const pageGapPx = pageCount > 1 ? 16 : 0
    // Extend the viewport to cover all pages stacked vertically.
    // LayoutPreviewV2 renders every page in sequence with no gap between them
    // (isExport=true sets marginBottom: 0 on .page-container-v2).
    const heightPx = Math.ceil(document.pageSpec.height * PT_TO_PX * pageCount) + pageGapPx * (pageCount - 1)

    await page.setViewport({
      width: widthPx,
      height: heightPx,
      deviceScaleFactor: options.deviceScaleFactor ?? 2,
    })

    // Increase timeouts for complex layouts in Production
    const timeout = process.env.NODE_ENV === 'production' ? 90000 : 60000
    if (typeof (page as any).setDefaultTimeout === 'function') {
      (page as any).setDefaultTimeout(timeout)
    }
    if (typeof (page as any).setDefaultNavigationTimeout === 'function') {
      (page as any).setDefaultNavigationTimeout(timeout)
    }

    const htmlContent = await generateImageHTML(document, options.customCSS ?? '', {
      paletteId: options.paletteId,
      textureId: options.textureId,
      texturesEnabled: options.texturesEnabled,
      imageMode: options.imageMode,
      showVignette: options.showVignette,
      itemBorders: options.itemBorders,
      itemDropShadow: options.itemDropShadow,
      fillItemTiles: options.fillItemTiles,
      spacerTilePatternId: options.spacerTilePatternId,
      fontStylePreset: options.fontStylePreset,
      centreAlignment: options.centreAlignment,
      hideSampleLabels: options.hideSampleLabels,
      pageGapPx,
    })

    // Set HTML content and wait for fonts and styles load
    await page.setContent(htmlContent, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout,
    })

    // Wait for fonts to be ready (same as PDF renderer)
    await page.evaluateHandle('document.fonts.ready')

    // Capture all pages — viewport already covers the full stacked height
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      omitBackground: false,
    })

    await page.close()

    const endTime = Date.now()
    const duration = Math.max(1, endTime - startTime)

    const imageBuffer = Buffer.from(screenshot)

    logger.info(
      `[ImageRendererV2] Generated PNG in ${duration}ms (${imageBuffer.length} bytes, ${widthPx}x${heightPx}px, ${pageCount} pages)`
    )

    return {
      imageBuffer,
      size: imageBuffer.length,
      width: widthPx,
      height: heightPx,
      pageCount: document.pages.length,
      timestamp: new Date(),
      duration,
      metadata: {
        templateId: document.templateId,
        templateVersion: document.templateVersion,
        engineVersion: document.debug?.engineVersion || 'v2',
      },
    }
  } catch (error) {
    if (page) {
      await page.close().catch(() => {})
    }
    throw error
  }
}

// ============================================================================
// HTML Generation for Image Rendering
// ============================================================================

// ============================================================================
// Font Helpers (mirrors renderer-pdf-v2.ts — keep in sync)
// ============================================================================

function extractUsedFontSets(document: LayoutDocumentV2): string[] {
  const fontSets = new Set<string>()
  fontSets.add('modern-sans')
  document.pages.forEach(page => {
    page.tiles.forEach(tile => {
      const tileStyle = (tile as any).style
      if (tileStyle?.typography?.fontSet) fontSets.add(tileStyle.typography.fontSet)
    })
  })
  return Array.from(fontSets)
}

function generateBaseFontsUrl(fontSetIds: string[]): string | null {
  const googleFontsParams = fontSetIds
    .map(id => getFontSet(id).googleFonts)
    .filter(Boolean)
    .join('&family=')
  if (!googleFontsParams) return null
  return `https://fonts.googleapis.com/css2?family=${googleFontsParams}&display=swap`
}

function extractFontStylePresetFromDoc(document: LayoutDocumentV2): FontStylePreset {
  for (const page of document.pages) {
    for (const tile of page.tiles) {
      if (tile.type === 'BANNER') {
        return (tile.content as BannerContentV2).fontStylePreset ?? 'standard'
      }
    }
  }
  return 'standard'
}

// ============================================================================

async function generateImageHTML(
  document: LayoutDocumentV2,
  customCSS: string = '',
  options: Partial<RenderOptionsV2> & {
    paletteId?: string
    textureId?: string
    texturesEnabled?: boolean
    fontStylePreset?: any
    pageGapPx?: number
    hideSampleLabels?: boolean
  } = {}
): Promise<string> {
  const { renderToString } = await import('react-dom/server')
  const { createElement } = await import('react')

  const palette = PALETTES_V2.find(p => p.id === options.paletteId) ?? DEFAULT_PALETTE_V2
  const textureLookupId =
    options.textureId || (options.texturesEnabled && palette.id ? PALETTE_TEXTURE_MAP[palette.id] : undefined)

  let textureDataURL: string | undefined = undefined
  if (textureLookupId) {
    const textureConfig = TEXTURE_REGISTRY.get(textureLookupId)
    if (textureConfig?.pdfTextureFile) {
      textureDataURL = (await getTextureDataURL(textureConfig.pdfTextureFile)) || undefined
      if (textureDataURL && textureConfig.overlayOpacity !== undefined) {
        // Overlay texture: inject as a separate div so palette colour shows through
        customCSS += `
        .page-texture-overlay-v2 {
          background-image: url('${textureDataURL}') !important;
          background-size: cover !important;
          background-repeat: no-repeat !important;
          opacity: ${textureConfig.overlayOpacity} !important;
        }
      `
        textureDataURL = undefined // Don't pass to renderer — CSS handles it
      }
    } else if (textureConfig) {
      // For CSS-based textures, inject the CSS props
      const cssProps = textureConfig.webCssExport('')
      const rules = Object.entries(cssProps)
        .map(([prop, val]) => {
          const cssProp = prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)
          return `${cssProp}: ${val} !important;`
        })
        .join('\n')
      customCSS += `
        .page-container-v2 {
          ${rules}
        }
      `
    }
  }

  // Resolve font style preset: prefer explicit option, fall back to what's embedded in the document
  // (mirrors the PDF renderer's generatePDFCSS fallback logic)
  const effectiveFontStylePreset: FontStylePreset =
    (options.fontStylePreset as FontStylePreset | undefined) ?? extractFontStylePresetFromDoc(document)

  // Load base font sets (item names, descriptions, etc.) AND preset-specific fonts
  // (section headers, logo tiles, banner title). Both are needed for a correct render.
  const baseFontsUrl = generateBaseFontsUrl(extractUsedFontSets(document))
  const presetFontsUrl = getFontStylePresetGoogleFontsUrl(effectiveFontStylePreset)
  const fontLinks = [baseFontsUrl, presetFontsUrl]
    .filter(Boolean)
    .map(url => `<link rel="stylesheet" href="${url}" />`)
    .join('\n    ')

  // Pre-fetch social media icons as base64 data URLs for export
  const socialIconDataUrls: Record<string, string> = {}
  const socialIconFiles = { instagram: 'instagram.png', facebook: 'facebook.png', x: 'x.png', tiktok: 'tiktok.png' }
  await Promise.all(
    Object.entries(socialIconFiles).map(async ([key, file]) => {
      const dataUrl = await fetchImageAsDataURL(`/logos/${file}`, undefined, 2000, false).catch(() => null)
      if (dataUrl) socialIconDataUrls[key] = dataUrl
    })
  )

  // Render React component to HTML
  const PT_TO_PX = 96 / 72

  const componentHTML = renderToString(
    createElement(LayoutPreviewV2 as any, {
      document,
      options: {
        scale: PT_TO_PX,
        palette,
        isExport: true,
        texturesEnabled: options.texturesEnabled !== false,
        textureDataURL,
        textureId: options.textureId,
        imageMode: options.imageMode,
        showVignette: options.showVignette !== false,
        itemBorders: options.itemBorders === true,
        itemDropShadow: options.itemDropShadow === true,
        fillItemTiles: options.fillItemTiles === true,
        spacerTilePatternId: options.spacerTilePatternId,
        fontStylePreset: effectiveFontStylePreset,
        centreAlignment: options.centreAlignment === true,
        hideSampleLabels: options.hideSampleLabels,
        socialIconDataUrls,
        showGridOverlay: false,
        showRegionBounds: false,
        showTileIds: false,
      },
    })
  )

  // Ensure the background is correct for PNG (body background matches palette)
  const gapPx = options.pageGapPx ?? 0
  // Soft grey strip between pages — neutral enough to work against any palette.
  const bgColor = palette.colors.background
  const bodyBackground = gapPx > 0 ? '#c8c8c8' : bgColor
  const baseCSS = `
    html, body {
      margin: 0;
      padding: 0;
      background: ${bodyBackground};
      overflow: visible;
    }
    /* Remove shadow/margins for clean export */
    .page-container-v2 {
      box-shadow: none !important;
      margin-bottom: 0 !important;
    }
    /* Directional drop shadow on pages that have a page below them,
       giving a "stacked pages" effect across the grey strip */
    .page-container-v2:not(:last-child) {
      margin-bottom: ${gapPx}px !important;
      box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.3) !important;
    }
    * {
      animation: none !important;
      transition: none !important;
    }
  `

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${fontLinks}
    <style>
      ${baseCSS}
      ${customCSS || ''}
    </style>
  </head>
  <body>
    ${componentHTML}
  </body>
</html>
  `.trim()
}

// ============================================================================
// Validation / Utilities (mirrors renderer-pdf-v2.ts)
// ============================================================================

export function validateImageExportOptionsV2(options: ImageExportOptionsV2): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (options.customCSS && options.customCSS.length > 100000) {
    errors.push('Custom CSS exceeds maximum size (100KB)')
  }

  const dsf = options.deviceScaleFactor
  if (dsf !== undefined && (dsf < 1 || dsf > 4)) {
    errors.push('deviceScaleFactor must be between 1 and 4')
  }

  return { valid: errors.length === 0, errors }
}

export async function saveImageToFileV2(imageBuffer: Buffer, filepath: string): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('saveImageToFileV2 can only be used in Node.js environment')
  }
  const fs = await import('fs/promises')
  await fs.writeFile(filepath, imageBuffer)
}

export function createImageBlobV2(imageBuffer: Buffer): Blob {
  return new Blob([imageBuffer as any], { type: 'image/png' })
}

export function createImageDataURLV2(imageBuffer: Buffer): string {
  const base64 = imageBuffer.toString('base64')
  return `data:image/png;base64,${base64}`
}

export async function exportLayoutDocumentToPNG(
  document: LayoutDocumentV2,
  options: ImageExportOptionsV2 = {}
): Promise<{ imageBuffer: Buffer; size: number; duration: number }> {
  const result = await renderToImageV2(document, options)
  return { imageBuffer: result.imageBuffer, size: result.size, duration: result.duration }
}

