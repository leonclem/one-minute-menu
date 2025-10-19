/**
 * Unit tests for ExportService
 */

import { ExportService, exportService } from '../export-service'
import type {
  RenderResult,
  ExportOptions,
} from '@/types/templates'

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setViewportSize: jest.fn(),
        setContent: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-png-content')),
        close: jest.fn(),
      }),
      close: jest.fn(),
    }),
  },
}))

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'test-path' },
          error: null,
        }),
        createSignedUrl: jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed-url' },
          error: null,
        }),
        list: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
        remove: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })),
    },
  })),
}))

describe('ExportService', () => {
  let service: ExportService

  beforeEach(() => {
    service = new ExportService()
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await service.close()
  })

  // Mock render result
  const mockRenderResult: RenderResult = {
    html: `
<!DOCTYPE html>
<html>
<head><title>Test Menu</title></head>
<body>
  <div class="menu-container">
    <div class="restaurant-name">Test Restaurant</div>
    <div class="category">
      <h2>Appetizers</h2>
      <div class="menu-item">
        <span class="item-name">Spring Rolls</span>
        <span class="item-price">$8.99</span>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    css: `
.menu-container { padding: 24px; }
.restaurant-name { font-size: 32px; }
.category { margin-bottom: 24px; }
.menu-item { display: flex; justify-content: space-between; }
    `,
    assets: [
      { type: 'font', url: 'https://fonts.example.com/inter.woff2', embedded: false },
    ],
    metadata: {
      templateId: 'test-template',
      templateVersion: '1.0.0',
      renderedAt: new Date(),
      itemCount: 1,
      categoryCount: 1,
      estimatedPrintSize: '1 page',
    },
  }

  describe('exportToPDF', () => {
    it('should generate PDF from render result', async () => {
      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test-menu.pdf',
        pageSize: 'A4',
      }

      const buffer = await service.exportToPDF(mockRenderResult, options)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.toString()).toContain('mock-pdf-content')
    })

    it('should use correct page size for A4', async () => {
      const playwright = require('playwright')
      const mockPage = {
        setViewportSize: jest.fn(),
        setContent: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
        close: jest.fn(),
      }
      
      playwright.chromium.launch.mockResolvedValueOnce({
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      })

      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf',
        pageSize: 'A4',
      }

      await service.exportToPDF(mockRenderResult, options)

      expect(mockPage.setViewportSize).toHaveBeenCalledWith({
        width: 794,
        height: 1123,
      })
    })

    it('should use correct page size for US_LETTER', async () => {
      const playwright = require('playwright')
      const mockPage = {
        setViewportSize: jest.fn(),
        setContent: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
        close: jest.fn(),
      }
      
      playwright.chromium.launch.mockResolvedValueOnce({
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      })

      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf',
        pageSize: 'US_LETTER',
      }

      await service.exportToPDF(mockRenderResult, options)

      expect(mockPage.setViewportSize).toHaveBeenCalledWith({
        width: 816,
        height: 1056,
      })
    })

    it('should wait for fonts to load before generating PDF', async () => {
      const playwright = require('playwright')
      const mockPage = {
        setViewportSize: jest.fn(),
        setContent: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
        close: jest.fn(),
      }
      
      playwright.chromium.launch.mockResolvedValueOnce({
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      })

      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf',
      }

      await service.exportToPDF(mockRenderResult, options)

      expect(mockPage.evaluate).toHaveBeenCalled()
    })
  })

  describe('exportToPNG', () => {
    it('should generate PNG from render result', async () => {
      const options: ExportOptions = {
        format: 'png',
        filename: 'test-menu.png',
        pageSize: 'A4',
      }

      const buffer = await service.exportToPNG(mockRenderResult, options)

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.toString()).toContain('mock-png-content')
    })

    it('should scale dimensions based on DPI', async () => {
      const playwright = require('playwright')
      const mockPage = {
        setViewportSize: jest.fn(),
        setContent: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
        close: jest.fn(),
      }
      
      playwright.chromium.launch.mockResolvedValueOnce({
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      })

      const options: ExportOptions = {
        format: 'png',
        filename: 'test.png',
        pageSize: 'A4',
        dpi: 300, // High DPI
      }

      await service.exportToPNG(mockRenderResult, options)

      // 300 DPI is 3.125x the default 96 DPI
      const scale = 300 / 96
      expect(mockPage.setViewportSize).toHaveBeenCalledWith({
        width: Math.round(794 * scale),
        height: Math.round(1123 * scale),
      })
    })

    it('should use default DPI when not specified', async () => {
      const playwright = require('playwright')
      const mockPage = {
        setViewportSize: jest.fn(),
        setContent: jest.fn(),
        evaluate: jest.fn().mockResolvedValue(undefined),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
        close: jest.fn(),
      }
      
      playwright.chromium.launch.mockResolvedValueOnce({
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      })

      const options: ExportOptions = {
        format: 'png',
        filename: 'test.png',
        pageSize: 'A4',
      }

      await service.exportToPNG(mockRenderResult, options)

      // Default DPI is 96, so scale is 1
      expect(mockPage.setViewportSize).toHaveBeenCalledWith({
        width: 794,
        height: 1123,
      })
    })
  })

  describe('exportToHTML', () => {
    it('should generate HTML with embedded styles', async () => {
      const options: ExportOptions = {
        format: 'html',
        filename: 'test-menu.html',
      }

      const buffer = await service.exportToHTML(mockRenderResult, options)

      expect(buffer).toBeInstanceOf(Buffer)
      
      const html = buffer.toString('utf-8')
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Test Restaurant')
      expect(html).toContain('.menu-container')
      expect(html).toContain('padding: 24px')
    })

    it('should include font-face declarations', async () => {
      const options: ExportOptions = {
        format: 'html',
        filename: 'test-menu.html',
      }

      const buffer = await service.exportToHTML(mockRenderResult, options)
      const html = buffer.toString('utf-8')

      expect(html).toContain('@font-face')
      expect(html).toContain('https://fonts.example.com/inter.woff2')
    })

    it('should extract body content from HTML', async () => {
      const options: ExportOptions = {
        format: 'html',
        filename: 'test-menu.html',
      }

      const buffer = await service.exportToHTML(mockRenderResult, options)
      const html = buffer.toString('utf-8')

      expect(html).toContain('menu-container')
      expect(html).toContain('Spring Rolls')
    })
  })

  describe('uploadToStorage', () => {
    it('should upload file to Supabase Storage', async () => {
      const buffer = Buffer.from('test content')
      const filename = 'test-menu.pdf'
      const userId = 'user-123'

      const url = await service.uploadToStorage(buffer, filename, userId)

      expect(url).toBe('https://example.com/signed-url')
    })

    it('should sanitize filename', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      })
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            upload: mockUpload,
            createSignedUrl: jest.fn().mockResolvedValue({
              data: { signedUrl: 'https://example.com/signed-url' },
              error: null,
            }),
          })),
        },
      })

      const buffer = Buffer.from('test')
      const filename = 'test menu with spaces!.pdf'
      const userId = 'user-123'

      await service.uploadToStorage(buffer, filename, userId)

      // Check that upload was called with sanitized filename
      const uploadCall = mockUpload.mock.calls[0]
      expect(uploadCall[0]).toMatch(/test_menu_with_spaces_\.pdf$/)
    })

    it('should use correct content type for PDF', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      })
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            upload: mockUpload,
            createSignedUrl: jest.fn().mockResolvedValue({
              data: { signedUrl: 'https://example.com/signed-url' },
              error: null,
            }),
          })),
        },
      })

      const buffer = Buffer.from('test')
      await service.uploadToStorage(buffer, 'test.pdf', 'user-123')

      const uploadOptions = mockUpload.mock.calls[0][2]
      expect(uploadOptions.contentType).toBe('application/pdf')
    })

    it('should use correct content type for PNG', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'test-path' },
        error: null,
      })
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            upload: mockUpload,
            createSignedUrl: jest.fn().mockResolvedValue({
              data: { signedUrl: 'https://example.com/signed-url' },
              error: null,
            }),
          })),
        },
      })

      const buffer = Buffer.from('test')
      await service.uploadToStorage(buffer, 'test.png', 'user-123')

      const uploadOptions = mockUpload.mock.calls[0][2]
      expect(uploadOptions.contentType).toBe('image/png')
    })

    it('should throw error on upload failure', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            upload: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Upload failed' },
            }),
          })),
        },
      })

      const buffer = Buffer.from('test')
      
      await expect(
        service.uploadToStorage(buffer, 'test.pdf', 'user-123')
      ).rejects.toThrow('Failed to upload file')
    })

    it('should throw error on signed URL generation failure', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            upload: jest.fn().mockResolvedValue({
              data: { path: 'test-path' },
              error: null,
            }),
            createSignedUrl: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Signed URL failed' },
            }),
          })),
        },
      })

      const buffer = Buffer.from('test')
      
      await expect(
        service.uploadToStorage(buffer, 'test.pdf', 'user-123')
      ).rejects.toThrow('Failed to generate signed URL')
    })
  })

  describe('export', () => {
    it('should export PDF and upload to storage', async () => {
      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test-menu.pdf',
        pageSize: 'A4',
      }

      const result = await service.export(mockRenderResult, options, 'user-123')

      expect(result.url).toBe('https://example.com/signed-url')
      expect(result.filename).toBe('test-menu.pdf')
      expect(result.format).toBe('pdf')
      expect(result.fileSize).toBeGreaterThan(0)
      expect(result.createdAt).toBeInstanceOf(Date)
    })

    it('should export PNG and upload to storage', async () => {
      const options: ExportOptions = {
        format: 'png',
        filename: 'test-menu.png',
        pageSize: 'A4',
        dpi: 300,
      }

      const result = await service.export(mockRenderResult, options, 'user-123')

      expect(result.url).toBe('https://example.com/signed-url')
      expect(result.filename).toBe('test-menu.png')
      expect(result.format).toBe('png')
    })

    it('should export HTML and upload to storage', async () => {
      const options: ExportOptions = {
        format: 'html',
        filename: 'test-menu.html',
      }

      const result = await service.export(mockRenderResult, options, 'user-123')

      expect(result.url).toBe('https://example.com/signed-url')
      expect(result.filename).toBe('test-menu.html')
      expect(result.format).toBe('html')
    })

    it('should throw error for unsupported format', async () => {
      const options = {
        format: 'svg' as any,
        filename: 'test-menu.svg',
      }

      await expect(
        service.export(mockRenderResult, options, 'user-123')
      ).rejects.toThrow('Unsupported export format')
    })
  })

  describe('cleanupOldExports', () => {
    it('should delete files older than specified days', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      
      const mockRemove = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      })
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            list: jest.fn().mockResolvedValue({
              data: [
                { name: 'old-file.pdf', created_at: oldDate.toISOString() },
                { name: 'recent-file.pdf', created_at: recentDate.toISOString() },
              ],
              error: null,
            }),
            remove: mockRemove,
          })),
        },
      })

      const deletedCount = await service.cleanupOldExports('user-123', 7)

      expect(deletedCount).toBe(1)
      expect(mockRemove).toHaveBeenCalledWith(['user-123/old-file.pdf'])
    })

    it('should return 0 when no files to delete', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            list: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          })),
        },
      })

      const deletedCount = await service.cleanupOldExports('user-123', 7)

      expect(deletedCount).toBe(0)
    })

    it('should handle list error gracefully', async () => {
      const { createServerSupabaseClient } = require('@/lib/supabase-server')
      
      createServerSupabaseClient.mockReturnValueOnce({
        storage: {
          from: jest.fn(() => ({
            list: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'List failed' },
            }),
          })),
        },
      })

      const deletedCount = await service.cleanupOldExports('user-123', 7)

      expect(deletedCount).toBe(0)
    })
  })

  describe('browser lifecycle', () => {
    it('should initialize browser on first use', async () => {
      expect(service.isInitialized()).toBe(false)

      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf',
      }

      await service.exportToPDF(mockRenderResult, options)

      expect(service.isInitialized()).toBe(true)
    })

    it('should close browser', async () => {
      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf',
      }

      await service.exportToPDF(mockRenderResult, options)
      expect(service.isInitialized()).toBe(true)

      await service.close()
      expect(service.isInitialized()).toBe(false)
    })

    it('should reuse browser instance for multiple exports', async () => {
      const playwright = require('playwright')
      const launchSpy = jest.spyOn(playwright.chromium, 'launch')

      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf',
      }

      await service.exportToPDF(mockRenderResult, options)
      await service.exportToPDF(mockRenderResult, options)

      // Should only launch once
      expect(launchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(exportService).toBeInstanceOf(ExportService)
    })
  })

  describe('pixel-perfect fidelity', () => {
    it('should use same HTML/CSS for preview and export', async () => {
      const playwright = require('playwright')
      const mockSetContent = jest.fn()
      const mockPage = {
        setViewportSize: jest.fn(),
        setContent: mockSetContent,
        evaluate: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
        close: jest.fn(),
      }
      
      playwright.chromium.launch.mockResolvedValueOnce({
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn(),
      })

      const options: ExportOptions = {
        format: 'pdf',
        filename: 'test.pdf',
      }

      await service.exportToPDF(mockRenderResult, options)

      // Verify that the HTML content includes both HTML and CSS
      const setContentCall = mockSetContent.mock.calls[0][0]
      expect(setContentCall).toContain('Test Restaurant')
      expect(setContentCall).toContain('.menu-container')
      expect(setContentCall).toContain('padding: 24px')
    })
  })
})
