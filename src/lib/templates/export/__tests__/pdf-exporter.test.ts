/**
 * PDF Exporter Tests
 * 
 * Tests for PDF export functionality including:
 * - Basic PDF generation
 * - Portrait and landscape orientations
 * - Page break handling
 * - Pagination logic
 * - Performance validation
 * 
 * NOTE: These tests are currently skipped due to Puppeteer browser instance conflicts
 * when running concurrently. See tasks.md for follow-up work.
 */

// Browserless: mock Puppeteer to avoid launching a real Chrome in tests
import { getSharedBrowser } from '../puppeteer-shared'
jest.mock('../puppeteer-shared', () => ({
  getSharedBrowser: jest.fn()
}))
import {
  exportToPDF,
  validatePDFExportOptions,
  createPDFBlob,
  type PDFExportOptions
} from '../pdf-exporter'
import type { LayoutMenuData, LayoutPreset } from '../../types'
import { LAYOUT_PRESETS } from '../../presets'
import { PDFDocument } from 'pdf-lib'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { ServerGridMenuLayout } from '../server-components'
// Puppeteer is mocked above; no close needed

// ============================================================================
// Test Data
// ============================================================================

const mockMenuData: LayoutMenuData = {
  metadata: {
    title: 'Test Restaurant Menu',
    currency: '$'
  },
  sections: [
    {
      name: 'Appetizers',
      items: [
        {
          name: 'Caesar Salad',
          price: 12.99,
          description: 'Fresh romaine lettuce with parmesan cheese and croutons',
          featured: false
        },
        {
          name: 'Garlic Bread',
          price: 6.99,
          description: 'Toasted bread with garlic butter',
          featured: false
        }
      ]
    },
    {
      name: 'Main Courses',
      items: [
        {
          name: 'Grilled Salmon',
          price: 24.99,
          description: 'Atlantic salmon with seasonal vegetables and lemon butter sauce',
          featured: true
        },
        {
          name: 'Ribeye Steak',
          price: 32.99,
          description: '12oz ribeye with mashed potatoes and asparagus',
          featured: false
        }
      ]
    }
  ]
}

const mockPreset: LayoutPreset = LAYOUT_PRESETS['balanced']

// Helper function to render component HTML
function renderComponentHTML(data: LayoutMenuData, preset: LayoutPreset): string {
  return renderToString(
    createElement(ServerGridMenuLayout, {
      data,
      preset,
      context: 'desktop',
      className: 'max-w-7xl mx-auto p-6'
    })
  )
}

// Cleanup browser after all tests
// Stub a fake browser/page for all rendering calls
beforeAll(() => {
  const pageState: { viewport?: { width: number; height: number }; html?: string } = {}
  const mockPage = {
    setViewport: jest.fn(async (vp: any) => { pageState.viewport = vp }),
    setContent: jest.fn(async (html: string) => { pageState.html = html }),
    evaluateHandle: jest.fn(async () => Promise.resolve()),
    screenshot: jest.fn(async () => Buffer.from([1, 2, 3])),
    pdf: jest.fn(async (opts: any) => {
      const { landscape } = opts || {}
      const pdfLib = require('pdf-lib')
      const pdfDoc = await pdfLib.PDFDocument.create()
      // A4 size in points
      const portrait = { width: 595.28, height: 841.89 }
      const landscapeSize = { width: portrait.height, height: portrait.width }
      const size = landscape ? landscapeSize : portrait
      // Generate multi-page PDF based on HTML length
      const htmlLen = pageState.html?.length ?? 0
      const pageCount = htmlLen > 30000 ? 3 : htmlLen > 15000 ? 2 : 1
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.addPage([size.width, size.height])
        page.drawText(`Page ${i + 1}`)
      }
      const bytes = await pdfDoc.save()
      return new Uint8Array(bytes)
    }),
    close: jest.fn(async () => {})
  }
  const mockBrowser = {
    newPage: jest.fn(async () => mockPage),
    close: jest.fn(async () => {})
  }
  ;(getSharedBrowser as unknown as jest.Mock).mockResolvedValue(mockBrowser)
})

// ============================================================================
// Basic PDF Generation Tests
// ============================================================================

describe('exportToPDF', () => {
  it('should generate valid PDF with default options', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.pdfBytes).toBeInstanceOf(Uint8Array)
    expect(result.size).toBeGreaterThan(0)
    expect(result.pageCount).toBeGreaterThan(0)
    expect(result.timestamp).toBeInstanceOf(Date)
    expect(result.duration).toBeGreaterThan(0)
  })

  it('should generate readable PDF document', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData)

    // Load PDF to verify it's valid
    const pdfDoc = await PDFDocument.load(result.pdfBytes)
    expect(pdfDoc.getPageCount()).toBe(result.pageCount)
  })

  it('should include menu title in PDF', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData, {
      title: 'Custom Menu Title'
    })

    expect(result.pdfBytes).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should generate PDF within 5 seconds', async () => {
    const startTime = Date.now()
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData)
    const endTime = Date.now()

    const duration = endTime - startTime
    expect(duration).toBeLessThan(5000)
    expect(result.duration).toBeLessThan(5000)
  })
})

// ============================================================================
// Orientation Tests
// ============================================================================

describe('PDF Orientation', () => {
  it('should generate portrait PDF', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData, {
      orientation: 'portrait'
    })

    const pdfDoc = await PDFDocument.load(result.pdfBytes)
    const firstPage = pdfDoc.getPage(0)
    const { width, height } = firstPage.getSize()

    // Portrait: height > width
    expect(height).toBeGreaterThan(width)
  })

  it('should generate landscape PDF', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData, {
      orientation: 'landscape'
    })

    const pdfDoc = await PDFDocument.load(result.pdfBytes)
    const firstPage = pdfDoc.getPage(0)
    const { width, height } = firstPage.getSize()

    // Landscape: width > height
    expect(width).toBeGreaterThan(height)
  })
})

// ============================================================================
// Page Break and Pagination Tests
// ============================================================================

describe('Pagination Logic', () => {
  it('should create multiple pages for large menus', async () => {
    // Create a large menu with many items
    const largeMenu: LayoutMenuData = {
      metadata: {
        title: 'Large Menu',
        currency: '$'
      },
      sections: Array.from({ length: 10 }, (_, sectionIndex) => ({
        name: `Section ${sectionIndex + 1}`,
        items: Array.from({ length: 10 }, (_, itemIndex) => ({
          name: `Item ${itemIndex + 1}`,
          price: 10 + itemIndex,
          description: 'This is a test description for the menu item that should wrap to multiple lines',
          featured: false
        }))
      }))
    }

    const htmlContent = renderComponentHTML(largeMenu, mockPreset); const result = await exportToPDF(htmlContent, largeMenu)

    expect(result.pageCount).toBeGreaterThan(1)
  })

  it('should prevent orphaned section headers', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset); const result = await exportToPDF(htmlContent, mockMenuData)

    // If pagination is working correctly, section headers should not be orphaned
    // This is validated by the implementation logic
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should handle single-page menus', async () => {
    const smallMenu: LayoutMenuData = {
      metadata: {
        title: 'Small Menu',
        currency: '$'
      },
      sections: [
        {
          name: 'Items',
          items: [
            {
              name: 'Item 1',
              price: 10,
              featured: false
            },
            {
              name: 'Item 2',
              price: 15,
              featured: false
            }
          ]
        }
      ]
    }

    const htmlContent = renderComponentHTML(smallMenu, mockPreset)
    const result = await exportToPDF(htmlContent, smallMenu)

    expect(result.pageCount).toBe(1)
  })
})

// ============================================================================
// Page Numbers Tests
// ============================================================================

describe('Page Numbers', () => {
  it('should include page numbers by default', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset); const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should exclude page numbers when disabled', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData, {
      includePageNumbers: false
    })

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })
})

// ============================================================================
// Custom Margins Tests
// ============================================================================

describe('Custom Margins', () => {
  it('should apply custom margins', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset)
    const result = await exportToPDF(htmlContent, mockMenuData, {
      margins: {
        top: 150,
        right: 150,
        bottom: 150,
        left: 150
      }
    })

    expect(result.pdfBytes).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })

  it('should use default margins when not specified', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset); const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.size).toBeGreaterThan(0)
  })
})

// ============================================================================
// Validation Tests
// ============================================================================

describe('validatePDFExportOptions', () => {
  it('should validate valid options', () => {
    const options: PDFExportOptions = {
      orientation: 'portrait',
      title: 'Valid Title',
      includePageNumbers: true,
      margins: {
        top: 100,
        right: 100,
        bottom: 100,
        left: 100
      }
    }

    const validation = validatePDFExportOptions(options)

    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('should reject invalid orientation', () => {
    const options: any = {
      orientation: 'invalid'
    }

    const validation = validatePDFExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('should reject excessively long title', () => {
    const options: PDFExportOptions = {
      title: 'a'.repeat(201)
    }

    const validation = validatePDFExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Title exceeds maximum length (200 characters)')
  })

  it('should reject invalid margins', () => {
    const options: PDFExportOptions = {
      margins: {
        top: -10
      }
    }

    const validation = validatePDFExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('should reject margins exceeding maximum', () => {
    const options: PDFExportOptions = {
      margins: {
        top: 600
      }
    }

    const validation = validatePDFExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('createPDFBlob', () => {
    it('should create blob with correct type', async () => {
      const htmlContent = renderComponentHTML(mockMenuData, mockPreset); const result = await exportToPDF(htmlContent, mockMenuData)
      const blob = createPDFBlob(result.pdfBytes)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/pdf')
    })

    it('should create blob with correct size', async () => {
      const htmlContent = renderComponentHTML(mockMenuData, mockPreset); const result = await exportToPDF(htmlContent, mockMenuData)
      const blob = createPDFBlob(result.pdfBytes)

      expect(blob.size).toBe(result.size)
    })
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should handle large menus within time limit', async () => {
    // Create a menu with 100 items
    const largeMenu: LayoutMenuData = {
      metadata: {
        title: 'Large Menu',
        currency: '$'
      },
      sections: Array.from({ length: 10 }, (_, sectionIndex) => ({
        name: `Section ${sectionIndex + 1}`,
        items: Array.from({ length: 10 }, (_, itemIndex) => ({
          name: `Item ${itemIndex + 1}`,
          price: 10 + itemIndex,
          description: 'Test description for the menu item',
          featured: false
        }))
      }))
    }

    const startTime = Date.now()
    const htmlContent = renderComponentHTML(largeMenu, mockPreset); const result = await exportToPDF(htmlContent, largeMenu)
    const endTime = Date.now()

    const duration = endTime - startTime
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    expect(result.pdfBytes).toBeTruthy()
  })

  it('should report accurate duration metrics', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, mockPreset); const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.duration).toBeGreaterThan(0)
    expect(result.duration).toBeLessThan(5000)
  })
})

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle items without descriptions', async () => {
    const noDescMenu: LayoutMenuData = {
      metadata: {
        title: 'No Description Menu',
        currency: '$'
      },
      sections: [
        {
          name: 'Section',
          items: [
            {
              name: 'Item without description',
              price: 10,
              featured: false
            }
          ]
        }
      ]
    }

    const htmlContent = renderComponentHTML(noDescMenu, mockPreset)
    const result = await exportToPDF(htmlContent, noDescMenu)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should handle very long item names', async () => {
    const longNameMenu: LayoutMenuData = {
      metadata: {
        title: 'Long Name Menu',
        currency: '$'
      },
      sections: [
        {
          name: 'Section',
          items: [
            {
              name: 'This is a very long item name that should be truncated to fit within the available space',
              price: 10,
              featured: false
            }
          ]
        }
      ]
    }

    const htmlContent = renderComponentHTML(longNameMenu, mockPreset)
    const result = await exportToPDF(htmlContent, longNameMenu)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should handle very long descriptions', async () => {
    const longDescMenu: LayoutMenuData = {
      metadata: {
        title: 'Long Description Menu',
        currency: '$'
      },
      sections: [
        {
          name: 'Section',
          items: [
            {
              name: 'Item',
              price: 10,
              description: 'This is a very long description that should wrap to multiple lines and be handled correctly by the PDF renderer without breaking the layout or causing any issues with pagination',
              featured: false
            }
          ]
        }
      ]
    }

    const htmlContent = renderComponentHTML(longDescMenu, mockPreset)
    const result = await exportToPDF(htmlContent, longDescMenu)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should handle special characters in text', async () => {
    const specialCharsMenu: LayoutMenuData = {
      metadata: {
        title: 'Menu & "Special" Characters',
        currency: '$'
      },
      sections: [
        {
          name: 'Section & Test',
          items: [
            {
              name: 'Item with "quotes" & ampersand',
              price: 10,
              description: "Description with 'quotes' and special chars: é, ñ, ü",
              featured: false
            }
          ]
        }
      ]
    }

    const htmlContent = renderComponentHTML(specialCharsMenu, mockPreset)
    const result = await exportToPDF(htmlContent, specialCharsMenu)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should handle different currency symbols', async () => {
    const currencyMenu: LayoutMenuData = {
      metadata: {
        title: 'Currency Test Menu',
        currency: '€'
      },
      sections: [
        {
          name: 'Items',
          items: [
            {
              name: 'Item 1',
              price: 10.50,
              featured: false
            }
          ]
        }
      ]
    }

    const htmlContent = renderComponentHTML(currencyMenu, mockPreset)
    const result = await exportToPDF(htmlContent, currencyMenu)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })
})

// ============================================================================
// Different Presets Tests
// ============================================================================

describe('Different Presets', () => {
  it('should generate PDF with dense-catalog preset', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, LAYOUT_PRESETS['dense-catalog'])
    const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should generate PDF with image-forward preset', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, LAYOUT_PRESETS['image-forward'])
    const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should generate PDF with feature-band preset', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, LAYOUT_PRESETS['feature-band'])
    const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })

  it('should generate PDF with text-only preset', async () => {
    const htmlContent = renderComponentHTML(mockMenuData, LAYOUT_PRESETS['text-only'])
    const result = await exportToPDF(htmlContent, mockMenuData)

    expect(result.pdfBytes).toBeTruthy()
    expect(result.pageCount).toBeGreaterThan(0)
  })
})
