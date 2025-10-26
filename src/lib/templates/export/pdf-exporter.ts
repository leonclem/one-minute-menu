/**
 * PDF Export Module
 * 
 * Exports menu layouts as PDF documents using pdf-lib.
 * Supports A4 portrait and landscape orientations with proper pagination.
 * 
 * Features:
 * - A4 page dimensions with configurable orientation
 * - Proper margins and baseline grid
 * - Page break handling to prevent orphaned section headers
 * - Design token consistency for spacing and typography
 * - Optimized for synchronous execution within Next.js API routes
 */

import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import type { LayoutMenuData, LayoutPreset, OutputContext, GridLayout } from '../types'
import { generateGridLayout } from '../grid-generator'
import {
  A4_DIMENSIONS,
  PRINT_MARGINS,
  FONT_SIZE_PX,
  SPACING_PX,
  FONT_WEIGHT
} from '../design-tokens'

// ============================================================================
// Export Options
// ============================================================================

export interface PDFExportOptions {
  /** Page orientation */
  orientation?: 'portrait' | 'landscape'
  /** Custom page title */
  title?: string
  /** Include page numbers */
  includePageNumbers?: boolean
  /** Custom margins (overrides defaults) */
  margins?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

export interface PDFExportResult {
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
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Export menu layout as PDF document
 * 
 * @param data - Normalized menu data
 * @param preset - Selected layout preset
 * @param options - PDF export configuration
 * @returns PDF export result with document bytes
 */
export async function exportToPDF(
  data: LayoutMenuData,
  preset: LayoutPreset,
  options: PDFExportOptions = {}
): Promise<PDFExportResult> {
  const startTime = Date.now()

  const {
    orientation = 'portrait',
    title = data.metadata.title,
    includePageNumbers = true,
    margins
  } = options

  // Create PDF document
  const pdfDoc = await PDFDocument.create()

  // Embed fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Get page dimensions
  const pageDimensions = orientation === 'portrait'
    ? A4_DIMENSIONS.portrait
    : A4_DIMENSIONS.landscape

  // Calculate margins
  const pageMargins = {
    top: margins?.top ?? PRINT_MARGINS.top,
    right: margins?.right ?? PRINT_MARGINS.right,
    bottom: margins?.bottom ?? PRINT_MARGINS.bottom,
    left: margins?.left ?? PRINT_MARGINS.left
  }

  // Calculate content area
  const contentWidth = pageDimensions.width - pageMargins.left - pageMargins.right
  const contentHeight = pageDimensions.height - pageMargins.top - pageMargins.bottom

  // Generate grid layout for print context
  const gridLayout = generateGridLayout(data, preset, 'print')

  // Render content to PDF
  let currentPage = pdfDoc.addPage([pageDimensions.width, pageDimensions.height])
  let currentY = pageDimensions.height - pageMargins.top

  // Render title
  currentY = renderTitle(currentPage, title, pageMargins.left, currentY, contentWidth, boldFont)
  currentY -= SPACING_PX.lg

  // Render sections
  for (const section of gridLayout.sections) {
    // Check if we need a new page for section header
    const sectionHeaderHeight = FONT_SIZE_PX['2xl'] + SPACING_PX.md
    if (currentY - sectionHeaderHeight < pageMargins.bottom + SPACING_PX.xl) {
      currentPage = pdfDoc.addPage([pageDimensions.width, pageDimensions.height])
      currentY = pageDimensions.height - pageMargins.top
    }

    // Render section header
    currentY = renderSectionHeader(
      currentPage,
      section.name,
      pageMargins.left,
      currentY,
      contentWidth,
      boldFont
    )
    currentY -= SPACING_PX.md

    // Render items in section
    for (const tile of section.tiles) {
      if (tile.type === 'item') {
        const itemHeight = calculateItemHeight(tile.item, preset, contentWidth)

        // Check if we need a new page
        if (currentY - itemHeight < pageMargins.bottom) {
          currentPage = pdfDoc.addPage([pageDimensions.width, pageDimensions.height])
          currentY = pageDimensions.height - pageMargins.top
        }

        // Render item
        currentY = renderMenuItem(
          currentPage,
          tile.item,
          data.metadata.currency,
          pageMargins.left,
          currentY,
          contentWidth,
          regularFont,
          boldFont,
          preset
        )
        currentY -= SPACING_PX.sm
      }
    }

    currentY -= SPACING_PX.lg // Extra spacing between sections
  }

  // Add page numbers if requested
  if (includePageNumbers) {
    addPageNumbers(pdfDoc, regularFont, pageMargins, pageDimensions)
  }

  // Serialize PDF to bytes
  const pdfBytes = await pdfDoc.save()

  const endTime = Date.now()
  const duration = endTime - startTime

  console.log(`[PDFExporter] Generated PDF in ${duration}ms (${pdfBytes.length} bytes, ${pdfDoc.getPageCount()} pages)`)

  return {
    pdfBytes,
    size: pdfBytes.length,
    pageCount: pdfDoc.getPageCount(),
    timestamp: new Date(),
    duration
  }
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render document title
 */
function renderTitle(
  page: PDFPage,
  title: string,
  x: number,
  y: number,
  maxWidth: number,
  font: any
): number {
  const fontSize = FONT_SIZE_PX['3xl']
  const textWidth = font.widthOfTextAtSize(title, fontSize)

  // Center title if it fits, otherwise left-align
  const textX = textWidth <= maxWidth ? x + (maxWidth - textWidth) / 2 : x

  page.drawText(title, {
    x: textX,
    y: y - fontSize,
    size: fontSize,
    font,
    color: rgb(0, 0, 0)
  })

  return y - fontSize - SPACING_PX.sm
}

/**
 * Render section header
 */
function renderSectionHeader(
  page: PDFPage,
  sectionName: string,
  x: number,
  y: number,
  maxWidth: number,
  font: any
): number {
  const fontSize = FONT_SIZE_PX['2xl']

  page.drawText(sectionName, {
    x,
    y: y - fontSize,
    size: fontSize,
    font,
    color: rgb(0, 0, 0)
  })

  return y - fontSize - SPACING_PX.xs
}

/**
 * Render menu item
 */
function renderMenuItem(
  page: PDFPage,
  item: any,
  currency: string,
  x: number,
  y: number,
  maxWidth: number,
  regularFont: any,
  boldFont: any,
  preset: LayoutPreset
): number {
  const nameSize = FONT_SIZE_PX.base
  const priceSize = FONT_SIZE_PX.base
  const descSize = FONT_SIZE_PX.sm

  let currentY = y

  // Render item name and price on same line
  const priceText = `${currency}${item.price.toFixed(2)}`
  const priceWidth = boldFont.widthOfTextAtSize(priceText, priceSize)

  // Item name (truncate if too long)
  const maxNameWidth = maxWidth - priceWidth - SPACING_PX.md
  let itemName = item.name
  let nameWidth = boldFont.widthOfTextAtSize(itemName, nameSize)

  if (nameWidth > maxNameWidth) {
    // Truncate name with ellipsis
    while (nameWidth > maxNameWidth - boldFont.widthOfTextAtSize('...', nameSize) && itemName.length > 0) {
      itemName = itemName.slice(0, -1)
      nameWidth = boldFont.widthOfTextAtSize(itemName, nameSize)
    }
    itemName += '...'
  }

  page.drawText(itemName, {
    x,
    y: currentY - nameSize,
    size: nameSize,
    font: boldFont,
    color: rgb(0, 0, 0)
  })

  page.drawText(priceText, {
    x: x + maxWidth - priceWidth,
    y: currentY - priceSize,
    size: priceSize,
    font: boldFont,
    color: rgb(0, 0, 0)
  })

  currentY -= nameSize + SPACING_PX.xs

  // Render description if present
  if (item.description) {
    const wrappedDesc = wrapText(item.description, maxWidth, regularFont, descSize)
    for (const line of wrappedDesc) {
      page.drawText(line, {
        x,
        y: currentY - descSize,
        size: descSize,
        font: regularFont,
        color: rgb(0.3, 0.3, 0.3)
      })
      currentY -= descSize + 2
    }
  }

  return currentY
}

/**
 * Calculate height needed for a menu item
 */
function calculateItemHeight(
  item: any,
  preset: LayoutPreset,
  maxWidth: number
): number {
  const nameSize = FONT_SIZE_PX.base
  const descSize = FONT_SIZE_PX.sm

  let height = nameSize + SPACING_PX.xs + SPACING_PX.sm

  if (item.description) {
    // Estimate wrapped lines (rough calculation)
    const avgCharWidth = descSize * 0.5
    const charsPerLine = Math.floor(maxWidth / avgCharWidth)
    const lines = Math.ceil(item.description.length / charsPerLine)
    height += lines * (descSize + 2)
  }

  return height
}

/**
 * Wrap text to fit within max width
 */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, fontSize)

    if (testWidth <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      currentLine = word
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * Add page numbers to all pages
 */
function addPageNumbers(
  pdfDoc: PDFDocument,
  font: any,
  margins: any,
  dimensions: any
): void {
  const pages = pdfDoc.getPages()
  const totalPages = pages.length

  pages.forEach((page, index) => {
    const pageNumber = index + 1
    const text = `${pageNumber} / ${totalPages}`
    const fontSize = FONT_SIZE_PX.xs
    const textWidth = font.widthOfTextAtSize(text, fontSize)

    page.drawText(text, {
      x: (dimensions.width - textWidth) / 2,
      y: margins.bottom / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5)
    })
  })
}

// ============================================================================
// Validation and Error Handling
// ============================================================================

/**
 * Validate PDF export options
 */
export function validatePDFExportOptions(options: PDFExportOptions): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (options.orientation && !['portrait', 'landscape'].includes(options.orientation)) {
    errors.push('Invalid orientation. Must be "portrait" or "landscape"')
  }

  if (options.title && options.title.length > 200) {
    errors.push('Title exceeds maximum length (200 characters)')
  }

  if (options.margins) {
    const { top, right, bottom, left } = options.margins
    if (top !== undefined && (top < 0 || top > 500)) {
      errors.push('Invalid top margin. Must be between 0 and 500')
    }
    if (right !== undefined && (right < 0 || right > 500)) {
      errors.push('Invalid right margin. Must be between 0 and 500')
    }
    if (bottom !== undefined && (bottom < 0 || bottom > 500)) {
      errors.push('Invalid bottom margin. Must be between 0 and 500')
    }
    if (left !== undefined && (left < 0 || left > 500)) {
      errors.push('Invalid left margin. Must be between 0 and 500')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ============================================================================
// Export Utilities
// ============================================================================

/**
 * Save PDF to file (Node.js environment only)
 */
export async function savePDFToFile(
  pdfBytes: Uint8Array,
  filepath: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('savePDFToFile can only be used in Node.js environment')
  }

  const fs = await import('fs/promises')
  await fs.writeFile(filepath, pdfBytes)
}

/**
 * Create downloadable PDF blob (browser environment only)
 */
export function createPDFBlob(pdfBytes: Uint8Array): Blob {
  return new Blob([pdfBytes as any], { type: 'application/pdf' })
}

/**
 * Generate data URL for PDF content
 */
export function createPDFDataURL(pdfBytes: Uint8Array): string {
  const base64 = Buffer.from(pdfBytes).toString('base64')
  return `data:application/pdf;base64,${base64}`
}
