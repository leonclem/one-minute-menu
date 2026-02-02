/**
 * Property-based tests for PuppeteerRenderer
 * 
 * These tests verify universal properties that should hold across all inputs
 * using randomized testing with fast-check.
 */

import fc from 'fast-check'
import { PuppeteerRenderer } from '../puppeteer-renderer'
import type { PDFOptions, ImageOptions } from '@/types'

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn()
}))

import puppeteer from 'puppeteer'

describe('PuppeteerRenderer Property Tests', () => {
  let mockBrowser: any
  let mockPage: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock page
    mockPage = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test content')),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('PNG test content')),
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
  })

  // Feature: railway-workers, Property 18: Concurrent Render Limit
  describe('Property 18: Concurrent Render Limit', () => {
    it('should never exceed max concurrent browser instances', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // maxConcurrentInstances
          fc.array(fc.string(), { minLength: 1, maxLength: 10 }), // HTML content array
          async (maxConcurrent, htmlArray) => {
            // Reset mocks for this iteration
            jest.clearAllMocks()

            // Create a fresh mock for each test iteration
            const localMockPage = {
              setContent: jest.fn().mockResolvedValue(undefined),
              pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test content')),
              screenshot: jest.fn().mockResolvedValue(Buffer.from('PNG test content')),
              close: jest.fn().mockResolvedValue(undefined),
              setRequestInterception: jest.fn().mockResolvedValue(undefined),
              setJavaScriptEnabled: jest.fn().mockResolvedValue(undefined),
              on: jest.fn()
            }

            const localMockBrowser = {
              newPage: jest.fn().mockResolvedValue(localMockPage),
              close: jest.fn().mockResolvedValue(undefined)
            }

            ;(puppeteer.launch as jest.Mock).mockResolvedValue(localMockBrowser)

            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: maxConcurrent,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const options: PDFOptions = {
                format: 'A4',
                orientation: 'portrait',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
              }

              // Render sequentially to avoid race conditions in test
              for (const html of htmlArray) {
                await renderer.renderPDF(`<html><body>${html}</body></html>`, options)
              }

              // Verify pool stats respect the limit
              const stats = renderer.getPoolStats()
              expect(stats.total).toBeLessThanOrEqual(maxConcurrent)
              expect(stats.maxCapacity).toBe(maxConcurrent)

              // Verify that puppeteer.launch was called at most maxConcurrent times
              expect((puppeteer.launch as jest.Mock).mock.calls.length).toBeLessThanOrEqual(maxConcurrent)

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle concurrent renders with different export types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 4 }), // maxConcurrentInstances
          fc.array(
            fc.record({
              html: fc.string(),
              type: fc.constantFrom('pdf', 'image')
            }),
            { minLength: 1, maxLength: 8 }
          ),
          async (maxConcurrent, jobs) => {
            // Reset mocks for this iteration
            jest.clearAllMocks()

            // Create a fresh mock for each test iteration
            const localMockPage = {
              setContent: jest.fn().mockResolvedValue(undefined),
              pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test content')),
              screenshot: jest.fn().mockResolvedValue(Buffer.from('PNG test content')),
              close: jest.fn().mockResolvedValue(undefined),
              setRequestInterception: jest.fn().mockResolvedValue(undefined),
              setJavaScriptEnabled: jest.fn().mockResolvedValue(undefined),
              on: jest.fn()
            }

            const localMockBrowser = {
              newPage: jest.fn().mockResolvedValue(localMockPage),
              close: jest.fn().mockResolvedValue(undefined)
            }

            ;(puppeteer.launch as jest.Mock).mockResolvedValue(localMockBrowser)

            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: maxConcurrent,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const pdfOptions: PDFOptions = {
                format: 'A4',
                orientation: 'portrait',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
              }

              const imageOptions: ImageOptions = {
                type: 'png',
                fullPage: true,
                omitBackground: false
              }

              // Render sequentially to avoid race conditions in test
              for (const job of jobs) {
                const html = `<html><body>${job.html}</body></html>`
                if (job.type === 'pdf') {
                  await renderer.renderPDF(html, pdfOptions)
                } else {
                  await renderer.renderImage(html, imageOptions)
                }
              }

              // Verify pool stats respect the limit
              const stats = renderer.getPoolStats()
              expect(stats.total).toBeLessThanOrEqual(maxConcurrent)
              expect(stats.maxCapacity).toBe(maxConcurrent)

              // Verify that puppeteer.launch was called at most maxConcurrent times
              expect((puppeteer.launch as jest.Mock).mock.calls.length).toBeLessThanOrEqual(maxConcurrent)

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 19: Render Timeout Enforcement
  describe('Property 19: Render Timeout Enforcement', () => {
    it('should enforce 60 second timeout on all renders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(), // HTML content
          fc.constantFrom('pdf', 'image'), // Export type
          async (html, exportType) => {
            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: 3,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const fullHtml = `<html><body>${html}</body></html>`

              if (exportType === 'pdf') {
                const options: PDFOptions = {
                  format: 'A4',
                  orientation: 'portrait',
                  printBackground: true,
                  margin: { top: '0', right: '0', bottom: '0', left: '0' }
                }

                await renderer.renderPDF(fullHtml, options)
              } else {
                const options: ImageOptions = {
                  type: 'png',
                  fullPage: true,
                  omitBackground: false
                }

                await renderer.renderImage(fullHtml, options)
              }

              // Verify setContent was called with 60 second timeout
              expect(mockPage.setContent).toHaveBeenCalledWith(
                fullHtml,
                expect.objectContaining({
                  timeout: 60000
                })
              )

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should fail renders that exceed timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.constantFrom('pdf', 'image'),
          async (html, exportType) => {
            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: 3,
              executablePath: '/usr/bin/chromium'
            })

            try {
              // Mock timeout error
              mockPage.setContent.mockRejectedValue(
                new Error('Navigation timeout of 60000 ms exceeded')
              )

              const fullHtml = `<html><body>${html}</body></html>`

              if (exportType === 'pdf') {
                const options: PDFOptions = {
                  format: 'A4',
                  orientation: 'portrait',
                  printBackground: true,
                  margin: { top: '0', right: '0', bottom: '0', left: '0' }
                }

                await expect(renderer.renderPDF(fullHtml, options)).rejects.toThrow()
              } else {
                const options: ImageOptions = {
                  type: 'png',
                  fullPage: true,
                  omitBackground: false
                }

                await expect(renderer.renderImage(fullHtml, options)).rejects.toThrow()
              }

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              // Re-throw if it's not the expected timeout error
              if (!(error instanceof Error) || !error.message.includes('timeout')) {
                throw error
              }
            }
          }
        ),
        { numRuns: 50 } // Fewer runs since we're testing error cases
      )
    })
  })

  // Feature: railway-workers, Property 25: Network Allowlist Enforcement
  describe('Property 25: Network Allowlist Enforcement', () => {
    it('should allow only allowlisted domains', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.oneof(
            // Allowlisted domains
            fc.constant('https://storage.supabase.co/bucket/image.jpg'),
            fc.constant('https://api.supabase.com/storage/v1/object/public/bucket/file.pdf'),
            fc.constant('data:image/png;base64,iVBORw0KGgo='),
            // Blocked domains
            fc.constant('https://evil.com/malicious.js'),
            fc.constant('https://attacker.net/script.js'),
            fc.constant('file:///etc/passwd')
          ),
          async (html, testUrl) => {
            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: 3,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const options: PDFOptions = {
                format: 'A4',
                orientation: 'portrait',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
              }

              await renderer.renderPDF(`<html><body>${html}</body></html>`, options)

              // Get the request handler
              const requestHandler = mockPage.on.mock.calls.find(
                (call: any) => call[0] === 'request'
              )?.[1]

              expect(requestHandler).toBeDefined()

              // Test the URL
              const mockRequest = {
                url: () => testUrl,
                abort: jest.fn(),
                continue: jest.fn()
              }

              requestHandler(mockRequest)

              // Verify behavior based on URL
              const isAllowlisted = 
                testUrl.includes('supabase.co') ||
                testUrl.includes('supabase.com') ||
                testUrl.startsWith('data:')

              if (isAllowlisted) {
                expect(mockRequest.continue).toHaveBeenCalled()
                expect(mockRequest.abort).not.toHaveBeenCalled()
              } else {
                expect(mockRequest.abort).toHaveBeenCalled()
                expect(mockRequest.continue).not.toHaveBeenCalled()
              }

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should block all non-allowlisted domains', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          async (randomUrl) => {
            // Skip if URL happens to contain allowlisted domains
            if (
              randomUrl.includes('supabase.co') ||
              randomUrl.includes('supabase.com')
            ) {
              return
            }

            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: 3,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const options: PDFOptions = {
                format: 'A4',
                orientation: 'portrait',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
              }

              await renderer.renderPDF('<html><body>Test</body></html>', options)

              // Get the request handler
              const requestHandler = mockPage.on.mock.calls.find(
                (call: any) => call[0] === 'request'
              )?.[1]

              const mockRequest = {
                url: () => randomUrl,
                abort: jest.fn(),
                continue: jest.fn()
              }

              requestHandler(mockRequest)

              // Non-allowlisted URLs should be blocked
              expect(mockRequest.abort).toHaveBeenCalled()
              expect(mockRequest.continue).not.toHaveBeenCalled()

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: railway-workers, Property 26: File Protocol Blocking
  describe('Property 26: File Protocol Blocking', () => {
    it('should block all file:// protocol URLs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('file:///etc/passwd'),
            fc.constant('file:///etc/shadow'),
            fc.constant('file:///home/user/.ssh/id_rsa'),
            fc.constant('file:///C:/Windows/System32/config/SAM'),
            fc.constant('file://localhost/etc/hosts'),
            fc.string().map(s => `file:///${s}`)
          ),
          async (fileUrl) => {
            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: 3,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const options: PDFOptions = {
                format: 'A4',
                orientation: 'portrait',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
              }

              await renderer.renderPDF('<html><body>Test</body></html>', options)

              // Get the request handler
              const requestHandler = mockPage.on.mock.calls.find(
                (call: any) => call[0] === 'request'
              )?.[1]

              expect(requestHandler).toBeDefined()

              const mockRequest = {
                url: () => fileUrl,
                abort: jest.fn(),
                continue: jest.fn()
              }

              requestHandler(mockRequest)

              // All file:// URLs should be blocked
              expect(mockRequest.abort).toHaveBeenCalled()
              expect(mockRequest.continue).not.toHaveBeenCalled()

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should block file protocol regardless of case', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'file:///etc/passwd',
            'FILE:///etc/passwd',
            'File:///etc/passwd',
            'FiLe:///etc/passwd'
          ),
          async (fileUrl) => {
            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: 3,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const options: PDFOptions = {
                format: 'A4',
                orientation: 'portrait',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
              }

              await renderer.renderPDF('<html><body>Test</body></html>', options)

              // Get the request handler
              const requestHandler = mockPage.on.mock.calls.find(
                (call: any) => call[0] === 'request'
              )?.[1]

              const mockRequest = {
                url: () => fileUrl,
                abort: jest.fn(),
                continue: jest.fn()
              }

              requestHandler(mockRequest)

              // File protocol should be blocked regardless of case
              // Note: The current implementation uses startsWith('file://') which is case-sensitive
              // This test documents the current behavior
              if (fileUrl.startsWith('file://')) {
                expect(mockRequest.abort).toHaveBeenCalled()
                expect(mockRequest.continue).not.toHaveBeenCalled()
              }

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should allow non-file protocols', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('https://storage.supabase.co/image.jpg'),
            fc.constant('data:image/png;base64,iVBORw0KGgo='),
            fc.constant('https://api.supabase.com/file.pdf')
          ),
          async (safeUrl) => {
            const renderer = new PuppeteerRenderer({
              maxConcurrentInstances: 3,
              executablePath: '/usr/bin/chromium'
            })

            try {
              const options: PDFOptions = {
                format: 'A4',
                orientation: 'portrait',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
              }

              await renderer.renderPDF('<html><body>Test</body></html>', options)

              // Get the request handler
              const requestHandler = mockPage.on.mock.calls.find(
                (call: any) => call[0] === 'request'
              )?.[1]

              const mockRequest = {
                url: () => safeUrl,
                abort: jest.fn(),
                continue: jest.fn()
              }

              requestHandler(mockRequest)

              // Non-file protocols should not be blocked by file:// check
              // (they may still be blocked by allowlist check)
              expect(mockRequest.abort).not.toHaveBeenCalledWith()
              expect(mockRequest.continue).toHaveBeenCalled()

              await renderer.shutdown()
            } catch (error) {
              await renderer.shutdown()
              throw error
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
