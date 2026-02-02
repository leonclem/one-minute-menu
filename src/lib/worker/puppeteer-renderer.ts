/**
 * PuppeteerRenderer - Manages Puppeteer instances and rendering logic
 * 
 * Responsibilities:
 * - Initialize Puppeteer with Railway Chromium path
 * - Configure browser launch options (no-sandbox, incognito)
 * - Implement browser pool with max 3 concurrent instances
 * - Provide resource management (getBrowser/releaseBrowser)
 * 
 * Requirements: 12.1, 14.3
 */

import puppeteer, { Browser } from 'puppeteer'
import { PDFOptions, ImageOptions } from '@/types'

interface BrowserInstance {
  browser: Browser
  inUse: boolean
  createdAt: Date
}

export class PuppeteerRenderer {
  private browserPool: BrowserInstance[] = []
  private readonly maxConcurrentInstances: number
  private readonly executablePath?: string
  private isInitialized = false

  constructor(config: {
    maxConcurrentInstances?: number
    executablePath?: string
  } = {}) {
    this.maxConcurrentInstances = config.maxConcurrentInstances ?? 3
    this.executablePath = config.executablePath || process.env.PUPPETEER_EXECUTABLE_PATH
  }

  /**
   * Initialize the renderer (optional - browsers are created on-demand)
   */
  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  /**
   * Shutdown all browser instances
   */
  async shutdown(): Promise<void> {
    const closePromises = this.browserPool.map(async (instance) => {
      try {
        await instance.browser.close()
      } catch (error) {
        console.error('Error closing browser:', error)
      }
    })

    await Promise.all(closePromises)
    this.browserPool = []
    this.isInitialized = false
  }

  /**
   * Get an available browser instance from the pool
   * Creates a new instance if pool is not at capacity
   * Waits if all instances are in use and pool is at capacity
   */
  private async getBrowser(): Promise<Browser> {
    // Check for available browser in pool
    const availableInstance = this.browserPool.find(instance => !instance.inUse)
    
    if (availableInstance) {
      availableInstance.inUse = true
      return availableInstance.browser
    }

    // Create new browser if under capacity
    if (this.browserPool.length < this.maxConcurrentInstances) {
      const browser = await this.launchBrowser()
      const instance: BrowserInstance = {
        browser,
        inUse: true,
        createdAt: new Date()
      }
      this.browserPool.push(instance)
      return browser
    }

    // Wait for a browser to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const available = this.browserPool.find(instance => !instance.inUse)
        if (available) {
          clearInterval(checkInterval)
          available.inUse = true
          resolve(available.browser)
        }
      }, 100)
    })
  }

  /**
   * Release a browser instance back to the pool
   */
  private async releaseBrowser(browser: Browser): Promise<void> {
    const instance = this.browserPool.find(inst => inst.browser === browser)
    if (instance) {
      instance.inUse = false
    }
  }

  /**
   * Launch a new Puppeteer browser instance with Railway configuration
   */
  private async launchBrowser(): Promise<Browser> {
    const browser = await puppeteer.launch({
      executablePath: this.executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      headless: true
    })

    return browser
  }

  /**
   * Enforce resource limits - ensure concurrent instances don't exceed max
   */
  private enforceResourceLimits(): void {
    const inUseCount = this.browserPool.filter(instance => instance.inUse).length
    if (inUseCount > this.maxConcurrentInstances) {
      throw new Error(
        `Resource limit exceeded: ${inUseCount} browsers in use, max is ${this.maxConcurrentInstances}`
      )
    }
  }

  /**
   * Configure network security for a page
   * - Block file:// protocol access
   * - Allowlist Supabase Storage and application domains
   * - Block all other network requests
   * 
   * Requirements: 14.1, 14.2, 14.6
   */
  private async configureNetworkSecurity(page: any): Promise<void> {
    await page.setRequestInterception(true)

    // Define allowlisted domains
    const allowlistedDomains = [
      // Supabase Storage domains
      'supabase.co',
      'supabase.com',
      // Application domain (if needed)
      process.env.NEXT_PUBLIC_APP_URL || '',
      // Allow data URLs for inline images
      'data:'
    ].filter(Boolean)

    page.on('request', (request: any) => {
      const url = request.url()

      // Block file:// protocol
      if (url.startsWith('file://')) {
        console.warn('Blocked file:// protocol access:', url)
        request.abort()
        return
      }

      // Allow data URLs (inline images)
      if (url.startsWith('data:')) {
        request.continue()
        return
      }

      // Check if URL matches allowlisted domains
      const isAllowlisted = allowlistedDomains.some(domain => {
        if (domain === 'data:') return false // Already handled above
        
        try {
          const urlObj = new URL(url)
          // Check if hostname contains the domain or if the full URL starts with the domain
          return urlObj.hostname.includes(domain) || url.includes(domain)
        } catch {
          return false
        }
      })

      if (isAllowlisted) {
        request.continue()
      } else {
        console.warn('Blocked unauthorized network request:', url)
        request.abort()
      }
    })
  }

  /**
   * Render HTML to PDF
   * 
   * @param html - HTML content to render
   * @param options - PDF rendering options
   * @returns PDF buffer
   * 
   * Requirements: 2.4, 11.2, 12.5, 14.4
   */
  async renderPDF(html: string, options: PDFOptions): Promise<Buffer> {
    this.enforceResourceLimits()
    
    const browser = await this.getBrowser()
    
    try {
      const page = await browser.newPage()
      
      // Disable JavaScript for security (Requirement 14.4)
      // Export templates must be server-side rendered and not rely on client-side JS
      await page.setJavaScriptEnabled(false)
      
      // Configure network security
      await this.configureNetworkSecurity(page)
      
      // Set content with timeout
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000 // 60 second timeout
      })

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: options.format,
        landscape: options.orientation === 'landscape',
        printBackground: options.printBackground,
        margin: options.margin
      })

      await page.close()
      
      return Buffer.from(pdfBuffer)
    } finally {
      await this.releaseBrowser(browser)
    }
  }

  /**
   * Render HTML to image (PNG or JPEG)
   * 
   * @param html - HTML content to render
   * @param options - Image rendering options
   * @returns Image buffer
   * 
   * Requirements: 2.4, 11.3, 12.5, 14.4
   */
  async renderImage(html: string, options: ImageOptions): Promise<Buffer> {
    this.enforceResourceLimits()
    
    const browser = await this.getBrowser()
    
    try {
      const page = await browser.newPage()
      
      // Disable JavaScript for security (Requirement 14.4)
      // Export templates must be server-side rendered and not rely on client-side JS
      await page.setJavaScriptEnabled(false)
      
      // Configure network security
      await this.configureNetworkSecurity(page)
      
      // Set content with timeout
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000 // 60 second timeout
      })

      // Generate screenshot
      const screenshotOptions: any = {
        type: options.type,
        fullPage: options.fullPage,
        omitBackground: options.omitBackground
      }

      if (options.type === 'jpeg' && options.quality !== undefined) {
        screenshotOptions.quality = options.quality
      }

      const imageBuffer = await page.screenshot(screenshotOptions)

      await page.close()
      
      return Buffer.from(imageBuffer)
    } finally {
      await this.releaseBrowser(browser)
    }
  }

  /**
   * Get current pool statistics
   */
  getPoolStats() {
    return {
      total: this.browserPool.length,
      inUse: this.browserPool.filter(i => i.inUse).length,
      available: this.browserPool.filter(i => !i.inUse).length,
      maxCapacity: this.maxConcurrentInstances
    }
  }

  /**
   * Run canary export test to verify Puppeteer on startup
   * Tests PDF generation with simple HTML
   * Validates output format and size
   * Fails worker startup if canary fails
   * 
   * Requirements: 2.2
   */
  async runCanaryExport(): Promise<void> {
    console.log('Running canary export to verify Puppeteer rendering...')
    
    const canaryHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              margin: 0;
            }
            h1 { 
              color: #333; 
              font-size: 24px;
            }
            p {
              color: #666;
              font-size: 14px;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <h1>Canary Export Test</h1>
          <p>This is a test export to verify Puppeteer rendering capability.</p>
          <p>If you see this, the worker is functioning correctly.</p>
        </body>
      </html>
    `
    
    try {
      // Test PDF generation
      const pdfBuffer = await this.renderPDF(canaryHtml, {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      })
      
      // Validate output size
      if (!pdfBuffer || pdfBuffer.length < 256) {
        throw new Error(
          `Canary export produced invalid output: size ${pdfBuffer?.length || 0} bytes (expected > 256 bytes)`
        )
      }
      
      // Validate PDF signature
      const pdfSignature = pdfBuffer.toString('utf8', 0, 5)
      if (!pdfSignature.startsWith('%PDF-')) {
        throw new Error(
          `Canary export did not produce valid PDF: signature "${pdfSignature}" (expected "%PDF-")`
        )
      }
      
      console.log('✓ Canary export successful', {
        outputSize: pdfBuffer.length,
        signature: pdfSignature
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('✗ Canary export failed:', errorMessage)
      throw new Error(`Worker cannot start: Puppeteer rendering failed - ${errorMessage}`)
    }
  }
}
