/**
 * Image Export Module
 * 
 * Exports menu layouts as PNG or JPG images using sharp.
 * Renders HTML to image using server-side rendering with design tokens.
 * 
 * Features:
 * - PNG and JPG format support
 * - Custom width and height parameters
 * - Social media sharing dimensions
 * - Server-side HTML rendering with sharp
 * - Optimized for synchronous execution within Next.js API routes (target <4s)
 */

import sharp from 'sharp'
import { getSharedBrowser } from './puppeteer-shared'
import type { LayoutMenuData, LayoutPreset, OutputContext } from '../types'
import { exportToHTML } from './html-exporter'

// ============================================================================
// Export Options
// ============================================================================

export interface ImageExportOptions {
  /** Image format */
  format?: 'png' | 'jpg'
  /** Image width in pixels */
  width?: number
  /** Image height in pixels */
  height?: number
  /** JPG quality (1-100, only for JPG format) */
  quality?: number
  /** Background color for transparent areas (hex color) */
  backgroundColor?: string
  /** Device pixel ratio for high-DPI displays */
  pixelRatio?: number
  /** Custom CSS to inject */
  customCSS?: string
  /** Optional theme color overrides */
  themeColors?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
}

export interface ImageExportResult {
  /** Image buffer */
  imageBuffer: Buffer
  /** Size in bytes */
  size: number
  /** Image width in pixels */
  width: number
  /** Image height in pixels */
  height: number
  /** Image format */
  format: 'png' | 'jpg'
  /** Generation timestamp */
  timestamp: Date
  /** Generation duration in milliseconds */
  duration: number
}

// ============================================================================
// Preset Dimensions for Common Use Cases
// ============================================================================

export const PRESET_DIMENSIONS = {
  /** Instagram square post */
  instagramSquare: { width: 1080, height: 1080 },
  /** Instagram portrait post */
  instagramPortrait: { width: 1080, height: 1350 },
  /** Instagram landscape post */
  instagramLandscape: { width: 1080, height: 566 },
  /** Instagram story */
  instagramStory: { width: 1080, height: 1920 },
  /** Facebook post */
  facebookPost: { width: 1200, height: 630 },
  /** Twitter post */
  twitterPost: { width: 1200, height: 675 },
  /** LinkedIn post */
  linkedinPost: { width: 1200, height: 627 },
  /** A4 portrait at 300 DPI */
  a4Portrait: { width: 2480, height: 3508 },
  /** A4 landscape at 300 DPI */
  a4Landscape: { width: 3508, height: 2480 },
  /** HD display */
  hd: { width: 1920, height: 1080 },
  /** 4K display */
  uhd: { width: 3840, height: 2160 }
} as const

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Export menu layout as PNG or JPG image
 * 
 * NOTE: This is currently a placeholder implementation that returns a preview image.
 * Full HTML-to-image rendering requires headless browser integration (Puppeteer/Playwright).
 * 
 * @param componentHTML - Pre-rendered HTML string from React components
 * @param data - Normalized menu data
 * @param context - Output context (mobile, tablet, desktop, print)
 * @param options - Image export configuration
 * @returns Image export result with buffer (currently placeholder)
 */
export async function exportToImage(
  componentHTML: string,
  data: LayoutMenuData,
  context: OutputContext,
  options: ImageExportOptions = {}
): Promise<ImageExportResult> {
  const startTime = Date.now()

  const {
    format = 'png',
    width = 1200,
    height = 1600,
    quality = 90,
    backgroundColor = '#ffffff',
    pixelRatio = 1,
    customCSS = '',
    themeColors
  } = options

  // Validate options
  const validation = validateImageExportOptions(options)
  if (!validation.valid) {
    throw new Error(`Invalid image export options: ${validation.errors.join(', ')}`)
  }

  // Calculate actual dimensions with pixel ratio
  const actualWidth = Math.round(width * pixelRatio)
  const actualHeight = Math.round(height * pixelRatio)

  // Build complete HTML document
  const htmlResult = exportToHTML(componentHTML, data, context, {
    includeDoctype: true,
    includeMetaTags: true,
    includeStyles: true,
    customCSS: generateImageCSS(width, height, customCSS),
    pageTitle: data.metadata.title,
    themeColors
  })

  // Convert HTML to image using Puppeteer
  const imageBuffer = await renderHTMLToImage(
    htmlResult.html,
    actualWidth,
    actualHeight,
    format,
    quality,
    backgroundColor
  )

  const endTime = Date.now()
  const duration = Math.max(1, endTime - startTime)

  console.log(
    `[ImageExporter] Generated ${format.toUpperCase()} in ${duration}ms ` +
    `(${imageBuffer.length} bytes, ${actualWidth}x${actualHeight}px)`
  )

  return {
    imageBuffer,
    size: imageBuffer.length,
    width: actualWidth,
    height: actualHeight,
    format,
    timestamp: new Date(),
    duration
  }
}

// ============================================================================
// HTML to Image Rendering
// ============================================================================

// Use shared Puppeteer browser to avoid conflicts across concurrent tests

/**
 * Render HTML string to image buffer using sharp
 * 
 * Note: This is a simplified implementation for MVP.
 * For production use with full HTML rendering, integrate with:
 * - Puppeteer (headless Chrome)
 * - Playwright (cross-browser support)
 * - @vercel/og (Vercel's edge-optimized solution)
 * - html-to-image or similar libraries
 * 
 * Current implementation creates a placeholder image with menu metadata.
 * This allows the export pipeline to function while a full HTML renderer
 * can be integrated in a future iteration.
 */
async function renderHTMLToImage(
  html: string,
  width: number,
  height: number,
  format: 'png' | 'jpg',
  quality: number,
  backgroundColor: string
): Promise<Buffer> {
  let page
  try {
    // Use shared browser instance
    const browser = await getSharedBrowser()
    page = await browser.newPage()

    // Set viewport to match desired dimensions
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 1
    })

    // Set HTML content
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    // Take screenshot
    const screenshot = await page.screenshot({
      type: format === 'jpg' ? 'jpeg' : 'png',
      quality: format === 'jpg' ? quality : undefined,
      fullPage: false,
      omitBackground: format === 'png'
    })

    await page.close()

    return Buffer.from(screenshot)
  } catch (error) {
    if (page) {
      await page.close().catch(() => {})
    }
    throw error
  }
}

// ============================================================================
// CSS Generation for Image Export
// ============================================================================

/**
 * Generate additional CSS for image export
 * Ensures proper sizing and layout for image rendering
 */
function generateImageCSS(width: number, height: number, customCSS: string): string {
  return `
    /* Image Export Specific Styles */
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }
    
    body {
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    
    /* Ensure content fits within bounds */
    .max-w-4xl,
    .max-w-7xl {
      max-width: ${width - 48}px;
      width: 100%;
    }
    
    /* Disable animations for static image */
    * {
      animation: none !important;
      transition: none !important;
    }
    
    ${customCSS}
  `
}

// ============================================================================
// Preset Dimension Helpers
// ============================================================================

/**
 * Get preset dimensions by name
 */
export function getPresetDimensions(
  presetName: keyof typeof PRESET_DIMENSIONS
): { width: number; height: number } {
  return PRESET_DIMENSIONS[presetName]
}

/**
 * Export with preset dimensions
 */
export async function exportToImageWithPreset(
  componentHTML: string,
  data: LayoutMenuData,
  context: OutputContext,
  presetName: keyof typeof PRESET_DIMENSIONS,
  options: Omit<ImageExportOptions, 'width' | 'height'> = {}
): Promise<ImageExportResult> {
  const dimensions = getPresetDimensions(presetName)
  
  return exportToImage(componentHTML, data, context, {
    ...options,
    width: dimensions.width,
    height: dimensions.height
  })
}

// ============================================================================
// Validation and Error Handling
// ============================================================================

/**
 * Validate image export options
 */
export function validateImageExportOptions(options: ImageExportOptions): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate format
  if (options.format && !['png', 'jpg'].includes(options.format)) {
    errors.push('Invalid format. Must be "png" or "jpg"')
  }

  // Validate dimensions
  if (options.width !== undefined) {
    if (options.width < 100 || options.width > 10000) {
      errors.push('Width must be between 100 and 10000 pixels')
    }
  }

  if (options.height !== undefined) {
    if (options.height < 100 || options.height > 10000) {
      errors.push('Height must be between 100 and 10000 pixels')
    }
  }

  // Validate quality
  if (options.quality !== undefined) {
    if (options.quality < 1 || options.quality > 100) {
      errors.push('Quality must be between 1 and 100')
    }
  }

  // Validate pixel ratio
  if (options.pixelRatio !== undefined) {
    if (options.pixelRatio < 1 || options.pixelRatio > 4) {
      errors.push('Pixel ratio must be between 1 and 4')
    }
  }

  // Validate background color
  if (options.backgroundColor) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    if (!hexColorRegex.test(options.backgroundColor)) {
      errors.push('Background color must be a valid hex color (e.g., #ffffff)')
    }
  }

  // Validate custom CSS size
  if (options.customCSS && options.customCSS.length > 100000) {
    errors.push('Custom CSS exceeds maximum size (100KB)')
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
 * Save image to file (Node.js environment only)
 */
export async function saveImageToFile(
  imageBuffer: Buffer,
  filepath: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('saveImageToFile can only be used in Node.js environment')
  }

  const fs = await import('fs/promises')
  await fs.writeFile(filepath, imageBuffer)
}

/**
 * Create downloadable image blob (browser environment only)
 */
export function createImageBlob(imageBuffer: Buffer, format: 'png' | 'jpg'): Blob {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  return new Blob([imageBuffer as any], { type: mimeType })
}

/**
 * Generate data URL for image content
 */
export function createImageDataURL(imageBuffer: Buffer, format: 'png' | 'jpg'): string {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  const base64 = imageBuffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Get optimal format based on content
 * PNG for images with transparency or text-heavy content
 * JPG for photo-heavy content
 */
export function getOptimalFormat(
  data: LayoutMenuData,
  preset: LayoutPreset
): 'png' | 'jpg' {
  // Calculate image ratio
  const totalItems = data.sections.reduce((sum, s) => sum + s.items.length, 0)
  const itemsWithImages = data.sections.reduce(
    (sum, s) => sum + s.items.filter(i => i.imageRef).length,
    0
  )
  const imageRatio = (itemsWithImages / totalItems) * 100

  // Use JPG for image-heavy menus (>50% images)
  // Use PNG for text-heavy menus or when quality is critical
  return imageRatio > 50 ? 'jpg' : 'png'
}

/**
 * Calculate optimal dimensions based on content
 */
export function calculateOptimalDimensions(
  data: LayoutMenuData,
  preset: LayoutPreset,
  context: OutputContext
): { width: number; height: number } {
  const totalItems = data.sections.reduce((sum, s) => sum + s.items.length, 0)
  const sectionCount = data.sections.length

  // Base width on context
  let width: number
  switch (context) {
    case 'mobile':
      width = 640
      break
    case 'tablet':
      width = 1024
      break
    case 'desktop':
      width = 1920
      break
    case 'print':
      width = 2480 // A4 portrait width at 300 DPI
      break
    default:
      width = 1200
  }

  // Estimate height based on content
  // Rough calculation: ~200px per section + ~80px per item
  const estimatedHeight = (sectionCount * 200) + (totalItems * 80)
  const height = Math.min(Math.max(estimatedHeight, 800), 10000)

  return { width, height }
}
