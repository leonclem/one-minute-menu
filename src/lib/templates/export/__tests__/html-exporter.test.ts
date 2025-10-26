/**
 * HTML Exporter Tests
 * 
 * Tests for HTML export functionality including:
 * - Basic HTML generation
 * - Document structure validation
 * - Inline styles inclusion
 * - Responsive meta tags
 * - Fragment export
 * - Error handling
 */

import {
  exportToHTML,
  exportToHTMLFragment,
  exportToHTMLWithWrapper,
  validateHTMLExportOptions,
  createHTMLBlob,
  createHTMLDataURL,
  type HTMLExportOptions
} from '../html-exporter'
import type { LayoutMenuData, LayoutPreset, OutputContext } from '../../types'
import { LAYOUT_PRESETS } from '../../presets'

// ============================================================================
// Test Data
// ============================================================================

const mockMenuData: LayoutMenuData = {
  metadata: {
    title: 'Test Restaurant Menu',
    currency: 'USD'
  },
  sections: [
    {
      name: 'Appetizers',
      items: [
        {
          name: 'Caesar Salad',
          price: 12.99,
          description: 'Fresh romaine lettuce with parmesan',
          imageRef: 'https://example.com/salad.jpg',
          featured: false
        },
        {
          name: 'Garlic Bread',
          price: 6.99,
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
          description: 'Atlantic salmon with seasonal vegetables',
          imageRef: 'https://example.com/salmon.jpg',
          featured: true
        }
      ]
    }
  ]
}

const mockPreset: LayoutPreset = LAYOUT_PRESETS['balanced']
const mockContext: OutputContext = 'desktop'

// ============================================================================
// Basic HTML Generation Tests
// ============================================================================

describe('exportToHTML', () => {
  it('should generate valid HTML with default options', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toBeTruthy()
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('<html lang="en">')
    expect(result.html).toContain('</html>')
    expect(result.size).toBeGreaterThan(0)
    expect(result.timestamp).toBeInstanceOf(Date)
  })

  it('should include menu title in HTML', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('Test Restaurant Menu')
  })

  it('should include all sections', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('Appetizers')
    expect(result.html).toContain('Main Courses')
  })

  it('should include all menu items', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('Caesar Salad')
    expect(result.html).toContain('Garlic Bread')
    expect(result.html).toContain('Grilled Salmon')
  })

  it('should include prices', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('12.99')
    expect(result.html).toContain('6.99')
    expect(result.html).toContain('24.99')
  })

  it('should include descriptions when present', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('Fresh romaine lettuce with parmesan')
    expect(result.html).toContain('Atlantic salmon with seasonal vegetables')
  })
})

// ============================================================================
// Document Structure Tests
// ============================================================================

describe('HTML Document Structure', () => {
  it('should include DOCTYPE when includeDoctype is true', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeDoctype: true
    })

    expect(result.html).toMatch(/^<!DOCTYPE html>/)
  })

  it('should exclude DOCTYPE when includeDoctype is false', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeDoctype: false
    })

    expect(result.html).not.toContain('<!DOCTYPE html>')
    expect(result.html).not.toContain('<html')
    expect(result.html).not.toContain('</html>')
  })

  it('should include meta tags when includeMetaTags is true', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeMetaTags: true
    })

    expect(result.html).toContain('<meta charset="UTF-8">')
    expect(result.html).toContain('<meta name="viewport"')
    expect(result.html).toContain('<title>')
  })

  it('should exclude meta tags when includeMetaTags is false', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeMetaTags: false
    })

    expect(result.html).not.toContain('<meta charset')
    expect(result.html).not.toContain('<meta name="viewport"')
  })

  it('should use custom page title when provided', () => {
    const customTitle = 'My Custom Menu Title'
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      pageTitle: customTitle
    })

    expect(result.html).toContain(`<title>${customTitle}</title>`)
  })
})

// ============================================================================
// Inline Styles Tests
// ============================================================================

describe('Inline Styles', () => {
  it('should include inline styles when includeStyles is true', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeStyles: true
    })

    expect(result.html).toContain('<style>')
    expect(result.html).toContain('</style>')
  })

  it('should exclude inline styles when includeStyles is false', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeStyles: false
    })

    expect(result.html).not.toContain('<style>')
  })

  it('should include base CSS reset styles', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeStyles: true
    })

    expect(result.html).toContain('box-sizing: border-box')
    expect(result.html).toContain('font-family:')
  })

  it('should include Tailwind utility classes', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeStyles: true
    })

    expect(result.html).toContain('.grid')
    expect(result.html).toContain('.flex')
    expect(result.html).toContain('.text-')
  })

  it('should include custom CSS when provided', () => {
    const customCSS = '.custom-class { color: red; }'
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      customCSS
    })

    expect(result.html).toContain(customCSS)
  })

  it('should include print styles', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      includeStyles: true
    })

    expect(result.html).toContain('@media print')
    expect(result.html).toContain('page-break-inside: avoid')
  })
})

// ============================================================================
// Theme Colors Tests
// ============================================================================

describe('Theme Colors', () => {
  it('should apply custom theme colors', () => {
    const themeColors = {
      primary: '#ff0000',
      secondary: '#00ff00',
      accent: '#0000ff',
      background: '#ffffff',
      text: '#000000'
    }

    const result = exportToHTML(mockMenuData, mockPreset, mockContext, {
      themeColors
    })

    expect(result.html).toContain(themeColors.background)
    expect(result.html).toContain(themeColors.text)
  })

  it('should use default colors when theme colors not provided', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('#ffffff')
    expect(result.html).toContain('#111827')
  })
})

// ============================================================================
// Output Context Tests
// ============================================================================

describe('Output Context', () => {
  it('should generate HTML for mobile context', () => {
    const result = exportToHTML(mockMenuData, mockPreset, 'mobile')

    expect(result.html).toBeTruthy()
    expect(result.html).toContain('viewport')
  })

  it('should generate HTML for tablet context', () => {
    const result = exportToHTML(mockMenuData, mockPreset, 'tablet')

    expect(result.html).toBeTruthy()
  })

  it('should generate HTML for desktop context', () => {
    const result = exportToHTML(mockMenuData, mockPreset, 'desktop')

    expect(result.html).toBeTruthy()
  })

  it('should generate HTML for print context', () => {
    const result = exportToHTML(mockMenuData, mockPreset, 'print')

    expect(result.html).toBeTruthy()
  })
})

// ============================================================================
// Text-Only Layout Tests
// ============================================================================

describe('Text-Only Layout', () => {
  it('should use TextOnlyLayout for text-only preset', () => {
    const textOnlyPreset = LAYOUT_PRESETS['text-only']
    const result = exportToHTML(mockMenuData, textOnlyPreset, mockContext)

    expect(result.html).toBeTruthy()
    expect(result.html).toContain('Test Restaurant Menu')
  })
})

// ============================================================================
// Fragment Export Tests
// ============================================================================

describe('exportToHTMLFragment', () => {
  it('should export HTML without document wrapper', () => {
    const fragment = exportToHTMLFragment(mockMenuData, mockPreset, mockContext)

    expect(fragment).toBeTruthy()
    expect(fragment).not.toContain('<!DOCTYPE html>')
    expect(fragment).not.toContain('<html')
    expect(fragment).not.toContain('<head>')
    expect(fragment).not.toContain('</html>')
  })

  it('should include menu content in fragment', () => {
    const fragment = exportToHTMLFragment(mockMenuData, mockPreset, mockContext)

    expect(fragment).toContain('Test Restaurant Menu')
    expect(fragment).toContain('Caesar Salad')
  })

  it('should apply theme colors to fragment', () => {
    const themeColors = {
      text: '#ff0000'
    }

    const fragment = exportToHTMLFragment(
      mockMenuData,
      mockPreset,
      mockContext,
      themeColors
    )

    expect(fragment).toBeTruthy()
  })
})

// ============================================================================
// Wrapper Export Tests
// ============================================================================

describe('exportToHTMLWithWrapper', () => {
  it('should wrap fragment in custom element', () => {
    const html = exportToHTMLWithWrapper(
      mockMenuData,
      mockPreset,
      mockContext,
      'section',
      'menu-container'
    )

    expect(html).toContain('<section class="menu-container">')
    expect(html).toContain('</section>')
  })

  it('should use default div wrapper', () => {
    const html = exportToHTMLWithWrapper(
      mockMenuData,
      mockPreset,
      mockContext
    )

    expect(html).toContain('<div class="">')
    expect(html).toContain('</div>')
  })
})

// ============================================================================
// Validation Tests
// ============================================================================

describe('validateHTMLExportOptions', () => {
  it('should validate valid options', () => {
    const options: HTMLExportOptions = {
      includeDoctype: true,
      includeMetaTags: true,
      includeStyles: true,
      customCSS: '.test { color: red; }',
      pageTitle: 'Valid Title'
    }

    const validation = validateHTMLExportOptions(options)

    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })

  it('should reject custom CSS with script tags', () => {
    const options: HTMLExportOptions = {
      customCSS: '<script>alert("xss")</script>'
    }

    const validation = validateHTMLExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Custom CSS cannot contain script tags')
  })

  it('should reject excessively long custom CSS', () => {
    const options: HTMLExportOptions = {
      customCSS: 'a'.repeat(100001)
    }

    const validation = validateHTMLExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Custom CSS exceeds maximum size (100KB)')
  })

  it('should reject excessively long page title', () => {
    const options: HTMLExportOptions = {
      pageTitle: 'a'.repeat(201)
    }

    const validation = validateHTMLExportOptions(options)

    expect(validation.valid).toBe(false)
    expect(validation.errors).toContain('Page title exceeds maximum length (200 characters)')
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('createHTMLBlob', () => {
    it('should create blob with correct type', () => {
      const html = '<div>Test</div>'
      const blob = createHTMLBlob(html)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('text/html;charset=utf-8')
    })

    it('should create blob with correct size', () => {
      const html = '<div>Test</div>'
      const blob = createHTMLBlob(html)

      expect(blob.size).toBe(html.length)
    })
  })

  describe('createHTMLDataURL', () => {
    it('should create valid data URL', () => {
      const html = '<div>Test</div>'
      const dataURL = createHTMLDataURL(html)

      expect(dataURL).toMatch(/^data:text\/html;charset=utf-8,/)
      expect(dataURL).toContain(encodeURIComponent(html))
    })

    it('should encode special characters', () => {
      const html = '<div>Test & "quotes"</div>'
      const dataURL = createHTMLDataURL(html)

      expect(dataURL).toContain('%26') // &
      expect(dataURL).toContain('%22') // "
    })
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should generate HTML within reasonable time', () => {
    const startTime = Date.now()
    exportToHTML(mockMenuData, mockPreset, mockContext)
    const endTime = Date.now()

    const duration = endTime - startTime
    expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
  })

  it('should handle large menus efficiently', () => {
    // Create a large menu with 100 items
    const largeMenu: LayoutMenuData = {
      metadata: {
        title: 'Large Menu',
        currency: 'USD'
      },
      sections: Array.from({ length: 10 }, (_, sectionIndex) => ({
        name: `Section ${sectionIndex + 1}`,
        items: Array.from({ length: 10 }, (_, itemIndex) => ({
          name: `Item ${itemIndex + 1}`,
          price: 10 + itemIndex,
          description: 'Test description',
          featured: false
        }))
      }))
    }

    const startTime = Date.now()
    const result = exportToHTML(largeMenu, mockPreset, mockContext)
    const endTime = Date.now()

    const duration = endTime - startTime
    expect(duration).toBeLessThan(2000) // Should complete in less than 2 seconds
    expect(result.html).toBeTruthy()
  })
})

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty sections', () => {
    const emptyMenu: LayoutMenuData = {
      metadata: {
        title: 'Empty Menu',
        currency: 'USD'
      },
      sections: [
        {
          name: 'Empty Section',
          items: []
        }
      ]
    }

    const result = exportToHTML(emptyMenu, mockPreset, mockContext)

    expect(result.html).toBeTruthy()
    expect(result.html).toContain('Empty Section')
  })

  it('should handle special characters in menu data', () => {
    const specialCharsMenu: LayoutMenuData = {
      metadata: {
        title: 'Menu & "Special" <Characters>',
        currency: 'USD'
      },
      sections: [
        {
          name: 'Section & "Test"',
          items: [
            {
              name: 'Item <with> "quotes" & ampersand',
              price: 10,
              description: "Description with 'quotes' and <tags>",
              featured: false
            }
          ]
        }
      ]
    }

    const result = exportToHTML(specialCharsMenu, mockPreset, mockContext)

    expect(result.html).toBeTruthy()
    // HTML should be escaped in title tag
    expect(result.html).toContain('&amp;')
    expect(result.html).toContain('&quot;')
    expect(result.html).toContain('&lt;')
    expect(result.html).toContain('&gt;')
  })

  it('should handle items without descriptions', () => {
    const noDescMenu: LayoutMenuData = {
      metadata: {
        title: 'No Description Menu',
        currency: 'USD'
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

    const result = exportToHTML(noDescMenu, mockPreset, mockContext)

    expect(result.html).toBeTruthy()
    expect(result.html).toContain('Item without description')
  })

  it('should handle items without images', () => {
    const noImageMenu: LayoutMenuData = {
      metadata: {
        title: 'No Image Menu',
        currency: 'USD'
      },
      sections: [
        {
          name: 'Section',
          items: [
            {
              name: 'Item without image',
              price: 10,
              featured: false
            }
          ]
        }
      ]
    }

    const result = exportToHTML(noImageMenu, mockPreset, mockContext)

    expect(result.html).toBeTruthy()
    expect(result.html).toContain('Item without image')
  })
})

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('Accessibility', () => {
  it('should include semantic HTML elements', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('<header')
    expect(result.html).toContain('<section')
    expect(result.html).toContain('<h1')
    expect(result.html).toContain('<h2')
  })

  it('should include ARIA labels', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('aria-label')
    expect(result.html).toContain('role=')
  })

  it('should include lang attribute', () => {
    const result = exportToHTML(mockMenuData, mockPreset, mockContext)

    expect(result.html).toContain('lang="en"')
  })
})
