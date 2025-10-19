/**
 * Export Service
 * 
 * Converts rendered HTML to various output formats (PDF, PNG, HTML) using headless Chromium.
 * Uses Playwright for pixel-perfect fidelity between preview and export.
 */

import { chromium, type Browser, type Page } from 'playwright'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type {
  RenderResult,
  ExportOptions,
  ExportResult,
  ExportFormat,
  PageSize,
} from '@/types/templates'

/**
 * Page size dimensions in pixels (at 96 DPI)
 */
const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 }, // 210mm x 297mm at 96 DPI
  US_LETTER: { width: 816, height: 1056 }, // 8.5" x 11" at 96 DPI
  TABLOID: { width: 1056, height: 1632 }, // 11" x 17" at 96 DPI
}

/**
 * Default DPI for exports
 */
const DEFAULT_DPI = 96
const HIGH_DPI = 300

export class ExportService {
  private browser: Browser | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the browser instance
   * Lazy initialization to avoid starting browser until needed
   */
  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    // Ensure only one initialization happens at a time
    if (!this.initPromise) {
      this.initPromise = this.initBrowser()
    }

    await this.initPromise
    return this.browser!
  }

  /**
   * Initialize browser with appropriate settings
   */
  private async initBrowser(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
    } catch (error) {
      console.error('Failed to launch browser:', error)
      throw new Error('Failed to initialize export service')
    }
  }

  /**
   * Export rendered menu to PDF format
   */
  async exportToPDF(
    renderResult: RenderResult,
    options: ExportOptions
  ): Promise<Buffer> {
    const browser = await this.ensureBrowser()
    const page = await browser.newPage()

    try {
      // Set viewport and page size
      const pageSize = options.pageSize || 'A4'
      const dimensions = PAGE_SIZES[pageSize]
      
      await page.setViewportSize({
        width: dimensions.width,
        height: dimensions.height,
      })

      // Load the HTML content
      const fullHtml = this.buildFullHtml(renderResult)
      await page.setContent(fullHtml, {
        waitUntil: 'networkidle',
      })

      // Wait for fonts to load
      await page.evaluate(() => document.fonts.ready)

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: pageSize === 'A4' ? 'A4' : pageSize === 'US_LETTER' ? 'Letter' : 'Tabloid',
        printBackground: true,
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
        preferCSSPageSize: true,
      })

      return Buffer.from(pdfBuffer)
    } finally {
      await page.close()
    }
  }

  /**
   * Export rendered menu to PNG format
   */
  async exportToPNG(
    renderResult: RenderResult,
    options: ExportOptions
  ): Promise<Buffer> {
    const browser = await this.ensureBrowser()
    const page = await browser.newPage()

    try {
      // Calculate dimensions based on DPI
      const pageSize = options.pageSize || 'A4'
      const dpi = options.dpi || DEFAULT_DPI
      const scale = dpi / DEFAULT_DPI
      
      const baseDimensions = PAGE_SIZES[pageSize]
      const dimensions = {
        width: Math.round(baseDimensions.width * scale),
        height: Math.round(baseDimensions.height * scale),
      }

      await page.setViewportSize(dimensions)

      // Load the HTML content
      const fullHtml = this.buildFullHtml(renderResult)
      await page.setContent(fullHtml, {
        waitUntil: 'networkidle',
      })

      // Wait for fonts to load
      await page.evaluate(() => document.fonts.ready)

      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: false,
      })

      return Buffer.from(screenshot)
    } finally {
      await page.close()
    }
  }

  /**
   * Export rendered menu to HTML format with embedded styles and fonts
   */
  async exportToHTML(
    renderResult: RenderResult,
    options: ExportOptions
  ): Promise<Buffer> {
    // Build complete HTML with embedded styles
    const fullHtml = this.buildFullHtml(renderResult, true)
    return Buffer.from(fullHtml, 'utf-8')
  }

  /**
   * Build complete HTML document with styles
   */
  private buildFullHtml(renderResult: RenderResult, embedAssets: boolean = false): string {
    const { html, css, assets } = renderResult

    // Extract body content from HTML
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    const bodyContent = bodyMatch ? bodyMatch[1] : html

    // Build font face declarations
    const fontFaces = embedAssets
      ? this.buildEmbeddedFontFaces(assets)
      : this.buildLinkedFontFaces(assets)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Menu Export</title>
  <style>
${fontFaces}

${css}
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`
  }

  /**
   * Build font-face declarations with linked URLs
   */
  private buildLinkedFontFaces(assets: Array<{ type: string; url: string }>): string {
    const fontAssets = assets.filter(asset => asset.type === 'font')
    
    if (fontAssets.length === 0) {
      return ''
    }

    return fontAssets
      .map(font => {
        // Extract font family from URL or use generic name
        const fontFamily = this.extractFontFamily(font.url)
        return `@font-face {
  font-family: '${fontFamily}';
  src: url('${font.url}');
}`
      })
      .join('\n\n')
  }

  /**
   * Build font-face declarations with embedded data URIs
   * Note: This is a placeholder - actual implementation would need to fetch and encode fonts
   */
  private buildEmbeddedFontFaces(assets: Array<{ type: string; url: string }>): string {
    // For now, just link to fonts
    // In a full implementation, we would fetch the font files and embed them as data URIs
    return this.buildLinkedFontFaces(assets)
  }

  /**
   * Extract font family name from URL
   */
  private extractFontFamily(url: string): string {
    const filename = url.split('/').pop() || 'CustomFont'
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  }

  /**
   * Upload exported file to Supabase Storage
   * Uploads to the 'rendered-menus' bucket with user-specific folder structure
   */
  async uploadToStorage(
    buffer: Buffer,
    filename: string,
    userId: string
  ): Promise<string> {
    const supabase = createServerSupabaseClient()
    
    // Create file path: userId/timestamp-filename
    const timestamp = Date.now()
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${userId}/${timestamp}-${sanitizedFilename}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('rendered-menus')
      .upload(filePath, buffer, {
        contentType: this.getContentType(filename),
        upsert: false,
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(`Failed to upload file: ${error.message}`)
    }

    // Generate signed URL with 24-hour expiration
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('rendered-menus')
      .createSignedUrl(filePath, 24 * 60 * 60) // 24 hours in seconds

    if (signedUrlError) {
      console.error('Signed URL generation error:', signedUrlError)
      throw new Error(`Failed to generate signed URL: ${signedUrlError.message}`)
    }

    return signedUrlData.signedUrl
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    switch (ext) {
      case 'pdf':
        return 'application/pdf'
      case 'png':
        return 'image/png'
      case 'html':
        return 'text/html'
      default:
        return 'application/octet-stream'
    }
  }

  /**
   * Clean up old exports for a user
   * Removes files older than the specified number of days
   */
  async cleanupOldExports(userId: string, olderThanDays: number = 7): Promise<number> {
    const supabase = createServerSupabaseClient()
    
    // List all files for the user
    const { data: files, error: listError } = await supabase.storage
      .from('rendered-menus')
      .list(userId)

    if (listError) {
      console.error('Error listing files:', listError)
      return 0
    }

    if (!files || files.length === 0) {
      return 0
    }

    // Filter files older than specified days
    const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)
    const filesToDelete = files.filter(file => {
      const createdAt = new Date(file.created_at).getTime()
      return createdAt < cutoffDate
    })

    if (filesToDelete.length === 0) {
      return 0
    }

    // Delete old files
    const filePaths = filesToDelete.map(file => `${userId}/${file.name}`)
    const { error: deleteError } = await supabase.storage
      .from('rendered-menus')
      .remove(filePaths)

    if (deleteError) {
      console.error('Error deleting files:', deleteError)
      return 0
    }

    return filesToDelete.length
  }

  /**
   * Main export method that handles the full export pipeline
   */
  async export(
    renderResult: RenderResult,
    options: ExportOptions,
    userId: string
  ): Promise<ExportResult> {
    const startTime = Date.now()

    try {
      // Generate the export based on format
      let buffer: Buffer
      
      switch (options.format) {
        case 'pdf':
          buffer = await this.exportToPDF(renderResult, options)
          break
        case 'png':
          buffer = await this.exportToPNG(renderResult, options)
          break
        case 'html':
          buffer = await this.exportToHTML(renderResult, options)
          break
        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }

      // Upload to storage (will be implemented in Task 7.2)
      // For now, we'll return a placeholder URL
      const url = await this.uploadToStorage(buffer, options.filename, userId)

      const result: ExportResult = {
        url,
        filename: options.filename,
        fileSize: buffer.length,
        format: options.format,
        createdAt: new Date(),
      }

      return result
    } catch (error) {
      console.error('Export failed:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Close the browser instance
   * Should be called when the service is no longer needed
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.initPromise = null
    }
  }

  /**
   * Check if browser is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null
  }
}

// Export singleton instance
export const exportService = new ExportService()

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await exportService.close()
  })
}
