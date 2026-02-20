/**
 * V2 PDF Renderer - PDF Export for LayoutDocumentV2
 * 
 * This module provides PDF export functionality for LayoutDocumentV2 outputs
 * using the existing Puppeteer infrastructure. Maintains consistency with web preview.
 * 
 * Key Design Decisions:
 * - Uses same positioning logic as web renderer (absolute, margins applied once)
 * - Font embedding with fallback stack
 * - Matches existing PDF export infrastructure patterns
 * - Returns PDF buffer for download/storage
 */

import { getSharedBrowser, acquirePage } from '../export/puppeteer-shared'
import { getTextureDataURL } from '../export/texture-utils'
import { createElement } from 'react'
import LayoutPreviewV2 from './renderer-web-v2'
import { logger } from '../../logger'
import type { 
  LayoutDocumentV2,
  PageSpecV2 
} from './engine-types-v2'
import { 
  getDefaultScale,
  TYPOGRAPHY_TOKENS_V2,
  COLOR_TOKENS_V2,
  PALETTES_V2,
  DEFAULT_PALETTE_V2,
  TEXTURE_REGISTRY,
  getFontSet,
  type RenderOptionsV2 
} from './renderer-v2'

// ============================================================================
// PDF Export Options
// ============================================================================

export interface PDFExportOptionsV2 {
  /** Custom page title for PDF metadata */
  title?: string
  /** Color palette ID to use */
  paletteId?: string
  /** Include page numbers in footer */
  includePageNumbers?: boolean
  /** Custom margins (overrides document pageSpec margins) */
  margins?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  /** Print background graphics */
  printBackground?: boolean
  /** Additional CSS to inject */
  customCSS?: string
  /** Show region boundary rectangles (debug) */
  showRegionBounds?: boolean
  /** Enable textured backgrounds for supported palettes */
  texturesEnabled?: boolean
  /** Image rendering mode */
  imageMode?: string
  /** Enable vignette edge effect */
  showVignette?: boolean
}

export interface PDFExportResultV2 {
  /** PDF document as Uint8Array */
  pdfBytes: Uint8Array
  /** Size in bytes */
  size: number
  /** Number of pages generated */
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
// Main PDF Export Function
// ============================================================================

/**
 * Export LayoutDocumentV2 as PDF document using Puppeteer
 * 
 * Uses the same React components as web preview to ensure consistency.
 * Applies the same positioning logic (absolute, margins applied once).
 */
export async function renderToPdf(
  document: LayoutDocumentV2,
  options: PDFExportOptionsV2 = {}
): Promise<PDFExportResultV2> {
  const startTime = Date.now()

    const {
    title = `Menu Layout - ${document.templateId}`,
    includePageNumbers = true,
    margins,
    printBackground = true,
    customCSS = '',
    showRegionBounds = false
  } = options

  let page
  try {
    logger.info(`[PDFRendererV2] Starting PDF generation for document: ${document.templateId}`)
    
    // Use shared browser instance and acquire a page with concurrency limiting
    const acquireStartTime = Date.now()
    page = await acquirePage()
    logger.info(`[PDFRendererV2] Page acquired in ${Date.now() - acquireStartTime}ms`)
    
    // Set viewport for consistent rendering
    // Use A4 dimensions in pixels at 96 DPI
    const isLandscape = document.pageSpec.width > document.pageSpec.height
    await page.setViewport({
      width: isLandscape ? 1123 : 794,
      height: isLandscape ? 794 : 1123,
      deviceScaleFactor: 2 // High DPI for better rendering
    })

    // Increase timeouts for complex layouts in Production
    const timeout = process.env.NODE_ENV === 'production' ? 90000 : 60000
    if (typeof (page as any).setDefaultTimeout === 'function') {
      (page as any).setDefaultTimeout(timeout)
    }
    if (typeof (page as any).setDefaultNavigationTimeout === 'function') {
      (page as any).setDefaultNavigationTimeout(timeout)
    }

    // Generate HTML content using React renderer
    const htmlStartTime = Date.now()
    const htmlContent = await generatePDFHTML(document, customCSS, { 
      showRegionBounds,
      paletteId: options.paletteId,
      texturesEnabled: options.texturesEnabled,
      imageMode: options.imageMode,
      showVignette: options.showVignette
    })
    logger.info(`[PDFRendererV2] HTML generated in ${Date.now() - htmlStartTime}ms (HTML length: ${htmlContent.length})`)

    // Set HTML content and wait for fonts and styles load
    // Note: since we optimize images to base64 before this call, 
    // we don't need networkidle2 anymore. domcontentloaded + document.fonts.ready 
    // is much faster and more reliable.
    const contentStartTime = Date.now()
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: timeout
    })
    logger.info(`[PDFRendererV2] Page content set in ${Date.now() - contentStartTime}ms`)
    
    // Wait for fonts to be ready
    const fontsStartTime = Date.now()
    await page.evaluateHandle('document.fonts.ready')
    logger.info(`[PDFRendererV2] Fonts ready in ${Date.now() - fontsStartTime}ms`)

    // Generate PDF with same dimensions as document pageSpec
    // DESIGN DECISION: We set margins to 0 here because our React renderer
    // already applies margins via absolute positioning of the content-box.
    // This ensures consistency between preview and PDF.
    const pdfStartTime = Date.now()
    const pdfBytes = await page.pdf({
      width: `${(document.pageSpec.width / 72).toFixed(4)}in`,
      height: `${(document.pageSpec.height / 72).toFixed(4)}in`,
      printBackground,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: includePageNumbers,
      headerTemplate: '<div></div>',
      footerTemplate: includePageNumbers
        ? '<div style="font-size: 10px; text-align: center; width: 100%; color: #6B7280;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
        : '<div></div>',
      preferCSSPageSize: false // Use our explicit dimensions
    })
    logger.info(`[PDFRendererV2] Puppeteer PDF generated in ${Date.now() - pdfStartTime}ms`)

    await page.close()

    const endTime = Date.now()
    const duration = Math.max(1, endTime - startTime)

    // Use document pages length as page count
    // (Avoiding pdf-lib loading for faster performance on Vercel)
    const pageCount = document.pages.length

    logger.info(`[PDFRendererV2] Generated PDF in ${duration}ms (${pdfBytes.length} bytes, ${pageCount} pages)`)

    return {
      pdfBytes,
      size: pdfBytes.length,
      pageCount,
      timestamp: new Date(),
      duration,
      metadata: {
        templateId: document.templateId,
        templateVersion: document.templateVersion,
        engineVersion: document.debug?.engineVersion || 'v2'
      }
    }
  } catch (error) {
    if (page) {
      await page.close().catch(() => {})
    }
    throw error
  }
}

// ============================================================================
// HTML Generation for PDF
// ============================================================================

/**
 * Generate complete HTML document for PDF rendering
 * Uses React server-side rendering with the same components as web preview
 */
async function generatePDFHTML(
  document: LayoutDocumentV2, 
  customCSS: string = '',
  options: { showRegionBounds?: boolean; paletteId?: string; texturesEnabled?: boolean; imageMode?: string; showVignette?: boolean } = {}
): Promise<string> {
  // Use dynamic import to avoid Next.js static analysis issues with react-dom/server
  // in Route Handlers and Server Components.
  const { renderToString } = await import('react-dom/server')

  const palette = PALETTES_V2.find(p => p.id === options.paletteId) ?? DEFAULT_PALETTE_V2

  // Pre-fetch texture data URL if enabled
  let textureDataURL: string | undefined = undefined
  if (options.texturesEnabled) {
    logger.info(`[PDFRendererV2] Textures enabled, fetching for palette: ${palette.id}`)
    const textureConfig = TEXTURE_REGISTRY.get(palette.id)
    if (textureConfig) {
      textureDataURL = await getTextureDataURL(textureConfig.pdfTextureFile) || undefined
    }
    
    if (textureDataURL) {
      logger.info(`[PDFRendererV2] Texture loaded successfully (length: ${textureDataURL.length})`)
      
      // If we have a data URL, we should use a simpler CSS for PDF to ensure it renders
      // Puppeteer can sometimes struggle with complex multi-layer gradients + textures in a single property
      customCSS += `
        .page-container-v2 {
          background-image: url('${textureDataURL}') !important;
          background-size: cover !important;
          background-repeat: no-repeat !important;
          background-blend-mode: normal !important;
        }
      `
    } else if (textureConfig) {
      logger.warn(`[PDFRendererV2] Failed to load texture for palette: ${palette.id}`)
    }
  }

  // Render options optimized for PDF
  const renderOptions: RenderOptionsV2 = {
    scale: 96 / 72, // Convert points to CSS pixels (96 DPI)
    palette,
    texturesEnabled: options.texturesEnabled,
    textureDataURL,
    imageMode: (options.imageMode as any) || 'stretch',
    showVignette: options.showVignette,
    showGridOverlay: false,
    showRegionBounds: options.showRegionBounds || false,
    showTileIds: false,
    showDebugInfo: false,
    isExport: true
  }

  // Render React component to HTML string
  const componentHTML = renderToString(
    createElement(LayoutPreviewV2, {
      document,
      options: renderOptions
    })
  )

  // Generate complete HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${document.templateId} - Layout V2</title>
  <style>
    ${generatePDFCSS(document, options.paletteId)}
    ${customCSS}
  </style>
</head>
<body>
  ${componentHTML}
</body>
</html>`
}

/**
 * Extract font sets used in a layout document
 */
function extractUsedFontSets(document: LayoutDocumentV2): string[] {
  const fontSets = new Set<string>()
  
  // Add default font set
  fontSets.add('modern-sans')
  
  // Extract font sets from tiles
  document.pages.forEach(page => {
    page.tiles.forEach(tile => {
      const tileStyle = (tile as any).style
      if (tileStyle?.typography?.fontSet) {
        fontSets.add(tileStyle.typography.fontSet)
      }
    })
  })
  
  return Array.from(fontSets)
}

/**
 * Generate Google Fonts import URL for multiple font sets
 */
function generateGoogleFontsURL(fontSetIds: string[]): string {
  const fontSets = fontSetIds.map(id => getFontSet(id))
  const googleFontsParams = fontSets
    .map(set => set.googleFonts)
    .filter(Boolean)
    .join('&family=')
  
  return `https://fonts.googleapis.com/css2?family=${googleFontsParams}&display=swap`
}

/**
 * Generate CSS optimized for PDF rendering
 * Includes font loading, print styles, and layout fixes
 */
function generatePDFCSS(document: LayoutDocumentV2, paletteId?: string): string {
  const palette = PALETTES_V2.find(p => p.id === paletteId) ?? DEFAULT_PALETTE_V2
  const usedFontSets = extractUsedFontSets(document)
  const googleFontsURL = generateGoogleFontsURL(usedFontSets)

  return `
    /* CSS Reset for PDF */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: ${palette.colors.background};
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* Font Loading */
    @import url('${googleFontsURL}');

    /* Body and Document Styles */
    body {
      font-family: ${TYPOGRAPHY_TOKENS_V2.fontFamily.primary};
      font-size: ${TYPOGRAPHY_TOKENS_V2.fontSize.base}px;
      line-height: ${TYPOGRAPHY_TOKENS_V2.lineHeight.normal};
      color: ${palette.colors.itemTitle};
      background: ${palette.colors.background};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Layout Document Container */
    .layout-document-v2 {
      width: 100%;
      height: 100%;
    }

    /* Page Container */
    .page-container-v2 {
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
      background-color: ${palette.colors.background};
    }

    .page-container-v2:last-child {
      page-break-after: auto;
    }

    /* Content Box */
    .content-box-v2 {
      position: relative;
    }

    /* Region Styles */
    .region-v2 {
      position: relative;
    }

    /* Tile Styles */
    .tile-v2 {
      position: absolute;
      overflow: hidden;
    }

    /* Footer tile: allow content to show (preview doesn't clip; PDF was clipping due to overflow: hidden above) */
    .tile-footer_info {
      overflow: visible;
    }

    /* Tile Type Specific Styles */
    .tile-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
    }

    .tile-title {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .tile-section_header {
      display: flex;
      align-items: center;
      padding-left: 8px;
    }

    .tile-item_card,
    .tile-item_text_row {
      background: transparent;
      padding: 8px;
    }

    .tile-filler {
      border-radius: 4px;
    }

    /* Image Styles - center crop so food is in shot (not top crop) */
    .page-container-v2 img,
    .tile-v2 img,
    img {
      max-width: 100%;
      height: auto;
      object-fit: cover;
      object-position: center !important;
      border-radius: 4px;
    }

    /* Text Styles */
    .tile-v2 h1,
    .tile-v2 h2,
    .tile-v2 h3 {
      font-weight: ${TYPOGRAPHY_TOKENS_V2.fontWeight.bold};
      line-height: ${TYPOGRAPHY_TOKENS_V2.lineHeight.tight};
    }

    /* Print Optimizations */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .page-container-v2 {
        box-shadow: none;
        margin-bottom: 0;
      }
      
      .page-info {
        display: none;
      }
    }

    /* Font Fallbacks */
    @font-face {
      font-family: 'Inter-fallback';
      src: local('Arial'), local('Helvetica'), local('sans-serif');
      font-weight: 400;
      font-style: normal;
    }

    /* Ensure text is selectable and copyable */
    .tile-v2 {
      user-select: text;
      -webkit-user-select: text;
    }

    /* Prevent text overflow */
    .tile-v2 div {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Vignette overlay */
    .vignette-overlay {
      position: absolute;
      inset: 0;
      box-shadow: inset 0 0 80px rgba(0,0,0,0.08);
      pointer-events: none;
      z-index: 2;
    }
  `
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize margins to Puppeteer-supported units (converting pt to in)
 */
function normalizeMargins(margins: {
  top?: string
  right?: string
  bottom?: string
  left?: string
}): {
  top?: string
  right?: string
  bottom?: string
  left?: string
} {
  const normalized: Record<string, string | undefined> = {}
  
  for (const [key, value] of Object.entries(margins)) {
    if (value && value.endsWith('pt')) {
      const points = parseFloat(value)
      normalized[key] = `${(points / 72).toFixed(4)}in`
    } else {
      normalized[key] = value
    }
  }
  
  return normalized as any
}

/**
 * Convert PageSpecV2 margins to Puppeteer margin format
 */
function convertPageSpecMargins(pageSpec: PageSpecV2): {
  top: string
  right: string
  bottom: string
  left: string
} {
  return {
    top: `${(pageSpec.margins.top / 72).toFixed(4)}in`,
    right: `${(pageSpec.margins.right / 72).toFixed(4)}in`,
    bottom: `${(pageSpec.margins.bottom / 72).toFixed(4)}in`,
    left: `${(pageSpec.margins.left / 72).toFixed(4)}in`
  }
}

/**
 * Validate PDF export options
 */
export function validatePDFExportOptionsV2(options: PDFExportOptionsV2): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (options.title && options.title.length > 200) {
    errors.push('Title exceeds maximum length (200 characters)')
  }

  if (options.margins) {
    const marginKeys = ['top', 'right', 'bottom', 'left'] as const
    for (const key of marginKeys) {
      const value = options.margins[key]
      if (value && !value.match(/^\d+(\.\d+)?(pt|mm|in|px)$/)) {
        errors.push(`Invalid ${key} margin format. Use format like "20pt", "15mm", "1in"`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ============================================================================
// Export Utilities (matching existing infrastructure)
// ============================================================================

/**
 * Save PDF to file (Node.js environment only)
 */
export async function savePDFToFileV2(
  pdfBytes: Uint8Array,
  filepath: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('savePDFToFileV2 can only be used in Node.js environment')
  }

  const fs = await import('fs/promises')
  await fs.writeFile(filepath, pdfBytes)
}

/**
 * Create downloadable PDF blob (browser environment only)
 */
export function createPDFBlobV2(pdfBytes: Uint8Array): Blob {
  return new Blob([pdfBytes as any], { type: 'application/pdf' })
}

/**
 * Generate data URL for PDF content
 */
export function createPDFDataURLV2(pdfBytes: Uint8Array): string {
  const base64 = Buffer.from(pdfBytes).toString('base64')
  return `data:application/pdf;base64,${base64}`
}

// ============================================================================
// Integration with Existing Infrastructure
// ============================================================================

/**
 * Export function that matches existing PDF exporter interface
 * for easier integration with existing API routes
 */
export async function exportLayoutDocumentToPDF(
  document: LayoutDocumentV2,
  options: PDFExportOptionsV2 = {}
): Promise<{
  pdfBytes: Uint8Array
  size: number
  pageCount: number
  duration: number
}> {
  const result = await renderToPdf(document, options)
  
  return {
    pdfBytes: result.pdfBytes,
    size: result.size,
    pageCount: result.pageCount,
    duration: result.duration
  }
}