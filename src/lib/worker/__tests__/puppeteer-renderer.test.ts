/**
 * Unit tests for PuppeteerRenderer
 */

import { PuppeteerRenderer } from '../puppeteer-renderer'
import type { PDFOptions, ImageOptions } from '@/types'

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn()
}))

import puppeteer from 'puppeteer'

describe('PuppeteerRenderer', () => {
  let renderer: PuppeteerRenderer
  let mockBrowser: any
  let mockPage: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create mock page
    mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test')),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('PNG test')),
      close: jest.fn().mockResolvedValue(undefined),
      setRequestInterception: jest.fn().mockResolvedValue(undefined),
      setJavaScriptEnabled: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    }

    // Create mock browser
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined)
    }

    // Mock puppeteer.launch
    ;(puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser)

    // Create renderer instance
    renderer = new PuppeteerRenderer({
      maxConcurrentInstances: 3,
      executablePath: '/usr/bin/chromium'
    })
  })

  afterEach(async () => {
    await renderer.shutdown()
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(renderer.initialize()).resolves.not.toThrow()
    })

    it('should shutdown all browser instances', async () => {
      // Render something to create a browser
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      // Shutdown
      await renderer.shutdown()

      expect(mockBrowser.close).toHaveBeenCalled()
    })
  })

  describe('renderPDF', () => {
    it('should render HTML to PDF successfully', async () => {
      const html = '<html><body><h1>Test Menu</h1></body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
      }

      const result = await renderer.renderPDF(html, options)

      expect(result).toBeInstanceOf(Buffer)
      expect(mockPage.setContent).toHaveBeenCalledWith(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      })
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        landscape: false,
        printBackground: true,
        margin: options.margin
      })
      expect(mockPage.close).toHaveBeenCalled()
    })

    it('should render landscape PDF', async () => {
      const html = '<html><body>Landscape</body></html>'
      const options: PDFOptions = {
        format: 'Letter',
        orientation: 'landscape',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      expect(mockPage.pdf).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'Letter',
          landscape: true
        })
      )
    })

    it('should handle rendering errors', async () => {
      mockPage.setContent.mockRejectedValue(new Error('Rendering failed'))

      const html = '<html><body>Error</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await expect(renderer.renderPDF(html, options)).rejects.toThrow('Rendering failed')
    })
  })

  describe('renderImage', () => {
    it('should render HTML to PNG successfully', async () => {
      const html = '<html><body><h1>Test Menu</h1></body></html>'
      const options: ImageOptions = {
        type: 'png',
        fullPage: true,
        omitBackground: false
      }

      const result = await renderer.renderImage(html, options)

      expect(result).toBeInstanceOf(Buffer)
      expect(mockPage.setContent).toHaveBeenCalledWith(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      })
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'png',
        fullPage: true,
        omitBackground: false
      })
      expect(mockPage.close).toHaveBeenCalled()
    })

    it('should render HTML to JPEG with quality', async () => {
      const html = '<html><body>JPEG</body></html>'
      const options: ImageOptions = {
        type: 'jpeg',
        quality: 85,
        fullPage: true,
        omitBackground: false
      }

      await renderer.renderImage(html, options)

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        type: 'jpeg',
        quality: 85,
        fullPage: true,
        omitBackground: false
      })
    })

    it('should handle image rendering errors', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'))

      const html = '<html><body>Error</body></html>'
      const options: ImageOptions = {
        type: 'png',
        fullPage: true,
        omitBackground: false
      }

      await expect(renderer.renderImage(html, options)).rejects.toThrow('Screenshot failed')
    })
  })

  describe('browser pool management', () => {
    it('should reuse browser instances from pool', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      // First render - creates browser
      await renderer.renderPDF(html, options)
      expect(puppeteer.launch).toHaveBeenCalledTimes(1)

      // Second render - reuses browser
      await renderer.renderPDF(html, options)
      expect(puppeteer.launch).toHaveBeenCalledTimes(1) // Still 1, browser was reused
    })

    it('should create multiple browsers up to max capacity', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      // Mock slow rendering to keep browsers busy
      mockPage.pdf.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(Buffer.from('PDF')), 100))
      )

      // Start 3 concurrent renders
      const renders = [
        renderer.renderPDF(html, options),
        renderer.renderPDF(html, options),
        renderer.renderPDF(html, options)
      ]

      await Promise.all(renders)

      // Should have created 3 browsers (max capacity)
      expect(puppeteer.launch).toHaveBeenCalledTimes(3)
    })

    it('should provide accurate pool statistics', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      // Initial state
      let stats = renderer.getPoolStats()
      expect(stats.total).toBe(0)
      expect(stats.inUse).toBe(0)
      expect(stats.available).toBe(0)
      expect(stats.maxCapacity).toBe(3)

      // After one render
      await renderer.renderPDF(html, options)
      stats = renderer.getPoolStats()
      expect(stats.total).toBe(1)
      expect(stats.available).toBe(1)
    })
  })

  describe('browser launch configuration', () => {
    it('should launch browser with correct Railway configuration', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      expect(puppeteer.launch).toHaveBeenCalledWith({
        executablePath: '/usr/bin/chromium',
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
    })

    it('should use environment variable for executable path if not provided', async () => {
      process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chromium'
      
      const customRenderer = new PuppeteerRenderer({
        maxConcurrentInstances: 3
      })

      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await customRenderer.renderPDF(html, options)

      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          executablePath: '/custom/chromium'
        })
      )

      await customRenderer.shutdown()
      delete process.env.PUPPETEER_EXECUTABLE_PATH
    })
  })

  describe('timeout enforcement', () => {
    it('should enforce 60 second timeout on setContent', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      expect(mockPage.setContent).toHaveBeenCalledWith(
        html,
        expect.objectContaining({
          timeout: 60000
        })
      )
    })
  })

  describe('network security', () => {
    it('should configure request interception for PDF rendering', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true)
      expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function))
    })

    it('should configure request interception for image rendering', async () => {
      const html = '<html><body>Test</body></html>'
      const options: ImageOptions = {
        type: 'png',
        fullPage: true,
        omitBackground: false
      }

      await renderer.renderImage(html, options)

      expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true)
      expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function))
    })

    it('should block file:// protocol requests', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      // Get the request handler
      const requestHandler = mockPage.on.mock.calls.find(
        (call: any) => call[0] === 'request'
      )?.[1]

      expect(requestHandler).toBeDefined()

      // Test file:// protocol blocking
      const mockRequest = {
        url: () => 'file:///etc/passwd',
        abort: jest.fn(),
        continue: jest.fn()
      }

      requestHandler(mockRequest)

      expect(mockRequest.abort).toHaveBeenCalled()
      expect(mockRequest.continue).not.toHaveBeenCalled()
    })

    it('should allow Supabase Storage domains', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      // Get the request handler
      const requestHandler = mockPage.on.mock.calls.find(
        (call: any) => call[0] === 'request'
      )?.[1]

      // Test Supabase Storage URL
      const mockRequest = {
        url: () => 'https://storage.supabase.co/bucket/image.jpg',
        abort: jest.fn(),
        continue: jest.fn()
      }

      requestHandler(mockRequest)

      expect(mockRequest.continue).toHaveBeenCalled()
      expect(mockRequest.abort).not.toHaveBeenCalled()
    })

    it('should allow data URLs', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      // Get the request handler
      const requestHandler = mockPage.on.mock.calls.find(
        (call: any) => call[0] === 'request'
      )?.[1]

      // Test data URL
      const mockRequest = {
        url: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        abort: jest.fn(),
        continue: jest.fn()
      }

      requestHandler(mockRequest)

      expect(mockRequest.continue).toHaveBeenCalled()
      expect(mockRequest.abort).not.toHaveBeenCalled()
    })

    it('should block unauthorized domains', async () => {
      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      // Get the request handler
      const requestHandler = mockPage.on.mock.calls.find(
        (call: any) => call[0] === 'request'
      )?.[1]

      // Test unauthorized domain
      const mockRequest = {
        url: () => 'https://evil.com/malicious.js',
        abort: jest.fn(),
        continue: jest.fn()
      }

      requestHandler(mockRequest)

      expect(mockRequest.abort).toHaveBeenCalled()
      expect(mockRequest.continue).not.toHaveBeenCalled()
    })

    it('should allow application domain if configured', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com'

      const customRenderer = new PuppeteerRenderer({
        maxConcurrentInstances: 3,
        executablePath: '/usr/bin/chromium'
      })

      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await customRenderer.renderPDF(html, options)

      // Get the request handler
      const requestHandler = mockPage.on.mock.calls.find(
        (call: any) => call[0] === 'request'
      )?.[1]

      // Test application domain
      const mockRequest = {
        url: () => 'https://myapp.com/api/data',
        abort: jest.fn(),
        continue: jest.fn()
      }

      requestHandler(mockRequest)

      expect(mockRequest.continue).toHaveBeenCalled()
      expect(mockRequest.abort).not.toHaveBeenCalled()

      await customRenderer.shutdown()
      delete process.env.NEXT_PUBLIC_APP_URL
    })
  })

  describe('canary export test', () => {
    it('should successfully run canary export with valid PDF output', async () => {
      // Mock PDF output with valid signature and size
      mockPage.pdf.mockResolvedValue(Buffer.from('%PDF-1.4\ntest content that makes it larger than 256 bytes\n' + 'x'.repeat(300)))

      await expect(renderer.runCanaryExport()).resolves.not.toThrow()

      // Verify renderPDF was called with canary HTML
      expect(mockPage.setContent).toHaveBeenCalled()
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        landscape: false,
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      })
    })

    it('should fail if PDF output is too small', async () => {
      // Mock PDF output that's too small (< 256 bytes)
      mockPage.pdf.mockResolvedValue(Buffer.from('%PDF-1.4\nsmall'))

      await expect(renderer.runCanaryExport()).rejects.toThrow(
        'Worker cannot start: Puppeteer rendering failed'
      )
      await expect(renderer.runCanaryExport()).rejects.toThrow(
        'size'
      )
    })

    it('should fail if PDF signature is invalid', async () => {
      // Mock PDF output with invalid signature but valid size
      mockPage.pdf.mockResolvedValue(Buffer.from('INVALID' + 'x'.repeat(300)))

      await expect(renderer.runCanaryExport()).rejects.toThrow(
        'Worker cannot start: Puppeteer rendering failed'
      )
      await expect(renderer.runCanaryExport()).rejects.toThrow(
        'did not produce valid PDF'
      )
    })

    it('should fail if rendering throws an error', async () => {
      mockPage.setContent.mockRejectedValue(new Error('Puppeteer launch failed'))

      await expect(renderer.runCanaryExport()).rejects.toThrow(
        'Worker cannot start: Puppeteer rendering failed'
      )
      await expect(renderer.runCanaryExport()).rejects.toThrow(
        'Puppeteer launch failed'
      )
    })

    it('should fail if PDF buffer is null or undefined', async () => {
      mockPage.pdf.mockResolvedValue(null)

      await expect(renderer.runCanaryExport()).rejects.toThrow(
        'Worker cannot start: Puppeteer rendering failed'
      )
      // The error message will contain TypeError details about null buffer
    })

    it('should log success message on successful canary export', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      // Mock valid PDF output
      mockPage.pdf.mockResolvedValue(Buffer.from('%PDF-1.4\n' + 'x'.repeat(300)))

      await renderer.runCanaryExport()

      expect(consoleSpy).toHaveBeenCalledWith(
        '✓ Canary export successful',
        expect.objectContaining({
          outputSize: expect.any(Number),
          signature: '%PDF-'
        })
      )

      consoleSpy.mockRestore()
    })

    it('should log error message on failed canary export', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock rendering failure
      mockPage.setContent.mockRejectedValue(new Error('Browser crashed'))

      await expect(renderer.runCanaryExport()).rejects.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '✗ Canary export failed:',
        expect.stringContaining('Browser crashed')
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('JavaScript-disabled rendering', () => {
    it('should disable JavaScript for PDF rendering', async () => {
      // Add setJavaScriptEnabled mock
      mockPage.setJavaScriptEnabled = jest.fn().mockResolvedValue(undefined)

      const html = '<html><body><h1>Test Menu</h1></body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false)
    })

    it('should disable JavaScript for image rendering', async () => {
      // Add setJavaScriptEnabled mock
      mockPage.setJavaScriptEnabled = jest.fn().mockResolvedValue(undefined)

      const html = '<html><body><h1>Test Menu</h1></body></html>'
      const options: ImageOptions = {
        type: 'png',
        fullPage: true,
        omitBackground: false
      }

      await renderer.renderImage(html, options)

      expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false)
    })

    it('should render templates correctly without JavaScript', async () => {
      // Add setJavaScriptEnabled mock
      mockPage.setJavaScriptEnabled = jest.fn().mockResolvedValue(undefined)

      // HTML with inline script that should NOT execute
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; }
              .menu-item { padding: 10px; }
            </style>
          </head>
          <body>
            <h1>Restaurant Menu</h1>
            <div class="menu-item">
              <h2>Burger</h2>
              <p>$10.99</p>
            </div>
            <script>
              // This script should NOT execute
              document.body.innerHTML = 'SCRIPT EXECUTED';
            </script>
          </body>
        </html>
      `

      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      const result = await renderer.renderPDF(html, options)

      // Verify JavaScript was disabled
      expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false)
      
      // Verify rendering completed successfully
      expect(result).toBeInstanceOf(Buffer)
      expect(mockPage.setContent).toHaveBeenCalledWith(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      })
    })

    it('should render server-side styled content without JavaScript', async () => {
      // Add setJavaScriptEnabled mock
      mockPage.setJavaScriptEnabled = jest.fn().mockResolvedValue(undefined)

      // HTML with only CSS styling (no JavaScript needed)
      const html = `
        <html>
          <head>
            <style>
              .menu { max-width: 800px; margin: 0 auto; }
              .item { display: flex; justify-content: space-between; }
              .price { font-weight: bold; color: #333; }
            </style>
          </head>
          <body>
            <div class="menu">
              <div class="item">
                <span>Pizza</span>
                <span class="price">$12.99</span>
              </div>
            </div>
          </body>
        </html>
      `

      const options: ImageOptions = {
        type: 'png',
        fullPage: true,
        omitBackground: false
      }

      const result = await renderer.renderImage(html, options)

      // Verify JavaScript was disabled
      expect(mockPage.setJavaScriptEnabled).toHaveBeenCalledWith(false)
      
      // Verify rendering completed successfully
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should call setJavaScriptEnabled before configuring network security', async () => {
      // Track call order
      const callOrder: string[] = []
      
      mockPage.setJavaScriptEnabled = jest.fn().mockImplementation(() => {
        callOrder.push('setJavaScriptEnabled')
        return Promise.resolve()
      })
      
      mockPage.setRequestInterception = jest.fn().mockImplementation(() => {
        callOrder.push('setRequestInterception')
        return Promise.resolve()
      })

      const html = '<html><body>Test</body></html>'
      const options: PDFOptions = {
        format: 'A4',
        orientation: 'portrait',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      }

      await renderer.renderPDF(html, options)

      // Verify setJavaScriptEnabled was called before network security setup
      expect(callOrder[0]).toBe('setJavaScriptEnabled')
      expect(callOrder[1]).toBe('setRequestInterception')
    })
  })
})

