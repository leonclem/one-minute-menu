/**
 * V2 Image Renderer Tests
 *
 * Unit tests for PNG export utilities and option validation.
 * Heavy dependencies (Puppeteer, SSR) are mocked.
 */

import {
  validateImageExportOptionsV2,
  createImageBlobV2,
  createImageDataURLV2,
  type ImageExportOptionsV2,
} from '../renderer-image-v2'

jest.mock('../../export/puppeteer-shared', () => ({
  acquirePage: jest.fn(),
}))

jest.mock('react-dom/server', () => ({
  renderToString: jest.fn(() => '<div>Mock HTML</div>'),
}))

describe('V2 Image Renderer', () => {
  describe('validateImageExportOptionsV2', () => {
    it('should validate valid options', () => {
      const options: ImageExportOptionsV2 = {
        deviceScaleFactor: 2,
        customCSS: 'body{background:#fff;}',
      }

      const result = validateImageExportOptionsV2(options)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject large customCSS', () => {
      const options: ImageExportOptionsV2 = {
        customCSS: 'x'.repeat(100_001),
      }
      const result = validateImageExportOptionsV2(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Custom CSS exceeds maximum size (100KB)')
    })

    it('should reject invalid deviceScaleFactor', () => {
      const options: ImageExportOptionsV2 = {
        deviceScaleFactor: 10,
      }
      const result = validateImageExportOptionsV2(options)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('deviceScaleFactor must be between 1 and 4')
    })
  })

  describe('createImageBlobV2', () => {
    it('should create an image/png Blob', () => {
      const buf = Buffer.from([0, 1, 2, 3])
      const blob = createImageBlobV2(buf)
      expect(blob.type).toBe('image/png')
      expect(blob.size).toBe(buf.length)
    })
  })

  describe('createImageDataURLV2', () => {
    it('should create a data URL with image/png prefix', () => {
      const buf = Buffer.from('test')
      const url = createImageDataURLV2(buf)
      expect(url.startsWith('data:image/png;base64,')).toBe(true)
    })
  })
})

