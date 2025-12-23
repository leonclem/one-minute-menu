/**
 * V2 PDF Renderer Tests
 * 
 * Tests for PDF export functionality. These tests verify the PDF renderer
 * can generate valid output without requiring a full browser setup.
 */

import { 
  validatePDFExportOptionsV2,
  createPDFBlobV2,
  createPDFDataURLV2,
  type PDFExportOptionsV2 
} from '../renderer-pdf-v2'

// Mock the heavy dependencies for unit testing
jest.mock('../../export/puppeteer-shared', () => ({
  getSharedBrowser: jest.fn()
}))

jest.mock('react-dom/server', () => ({
  renderToString: jest.fn(() => '<div>Mock HTML</div>')
}))

describe('V2 PDF Renderer', () => {
  describe('validatePDFExportOptionsV2', () => {
    it('should validate valid options', () => {
      const options: PDFExportOptionsV2 = {
        title: 'Test Menu',
        includePageNumbers: true,
        margins: {
          top: '20pt',
          right: '15pt',
          bottom: '20pt',
          left: '15pt'
        }
      }

      const result = validatePDFExportOptionsV2(options)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid title length', () => {
      const options: PDFExportOptionsV2 = {
        title: 'x'.repeat(201) // Too long
      }

      const result = validatePDFExportOptionsV2(options)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Title exceeds maximum length (200 characters)')
    })

    it('should reject invalid margin formats', () => {
      const options: PDFExportOptionsV2 = {
        margins: {
          top: 'invalid',
          right: '15pt',
          bottom: '20pt',
          left: '15pt'
        }
      }

      const result = validatePDFExportOptionsV2(options)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Invalid top margin format'))).toBe(true)
    })

    it('should accept valid margin formats', () => {
      const validFormats = ['20pt', '15mm', '1in', '96px']
      
      for (const format of validFormats) {
        const options: PDFExportOptionsV2 = {
          margins: { top: format, right: format, bottom: format, left: format }
        }

        const result = validatePDFExportOptionsV2(options)
        expect(result.valid).toBe(true)
      }
    })
  })

  describe('PDF Utilities', () => {
    it('should create PDF blob', () => {
      const mockBytes = new Uint8Array([1, 2, 3, 4])
      const blob = createPDFBlobV2(mockBytes)
      
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/pdf')
    })

    it('should create PDF data URL', () => {
      const mockBytes = new Uint8Array([1, 2, 3, 4])
      const dataUrl = createPDFDataURLV2(mockBytes)
      
      expect(dataUrl).toMatch(/^data:application\/pdf;base64,/)
      expect(dataUrl.length).toBeGreaterThan(30) // Base64 encoded content
    })
  })

  describe('Integration Points', () => {
    it('should have consistent interface with existing PDF infrastructure', () => {
      // Verify the export function signature matches expectations
      const { exportLayoutDocumentToPDF } = require('../renderer-pdf-v2')
      
      expect(typeof exportLayoutDocumentToPDF).toBe('function')
      expect(exportLayoutDocumentToPDF.length).toBe(1) // document (options has default)
    })
  })
})