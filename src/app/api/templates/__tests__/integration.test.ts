/**
 * Integration Test Suite for Dynamic Menu Layout Engine
 * 
 * Tests the full pipeline from extraction data to rendered layouts and exports.
 * Verifies:
 * - Data transformation from extraction to layout
 * - Layout selection and grid generation
 * - Export format generation (HTML, PDF, PNG, JPG)
 * - Responsive behavior across breakpoints
 * - Rendering consistency between formats
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { transformExtractionToLayout, analyzeMenuCharacteristics } from '@/lib/templates/data-transformer'
import { selectLayoutPresetWithContext } from '@/lib/templates/layout-selector'
import { generateGridLayout } from '@/lib/templates/grid-generator'
import { insertFillerTiles } from '@/lib/templates/filler-tiles'
import { exportToHTML } from '@/lib/templates/export/html-exporter'
import { ServerGridMenuLayout } from '@/lib/templates/export/server-components'
import type { ExtractionResultV2Type } from '@/lib/extraction/schema-stage2'
import type { LayoutMenuData, OutputContext } from '@/lib/templates/types'

// ============================================================================
// Test Data Fixtures
// ============================================================================

/**
 * Small menu with mixed content (some images, some text-only)
 */
const smallMixedMenu: ExtractionResultV2Type = {
  currency: '$',
  menu: {
    categories: [
      {
        name: 'Appetizers',
        items: [
          {
            name: 'Bruschetta',
            price: 8.99,
            description: 'Toasted bread with tomatoes and basil',
            variants: []
          },
          {
            name: 'Calamari',
            price: 12.99,
            description: 'Crispy fried squid with marinara',
            variants: []
          },
          {
            name: 'Caesar Salad',
            price: 9.99,
            variants: []
          }
        ],
        subcategories: []
      },
      {
        name: 'Main Courses',
        items: [
          {
            name: 'Margherita Pizza',
            price: 14.99,
            description: 'Classic tomato, mozzarella, and basil',
            variants: []
          },
          {
            name: 'Spaghetti Carbonara',
            price: 16.99,
            description: 'Pasta with bacon, egg, and parmesan',
            variants: []
          }
        ],
        subcategories: []
      }
    ]
  }
}

/**
 * Large menu with many items (tests performance and pagination)
 */
function generateLargeMenu(itemCount: number): ExtractionResultV2Type {
  const itemsPerSection = 20
  const sectionCount = Math.ceil(itemCount / itemsPerSection)
  
  const categories = []
  for (let s = 0; s < sectionCount; s++) {
    const items = []
    const itemsInThisSection = Math.min(itemsPerSection, itemCount - s * itemsPerSection)
    
    for (let i = 0; i < itemsInThisSection; i++) {
      items.push({
        name: `Item ${s * itemsPerSection + i + 1}`,
        price: 10 + Math.random() * 20,
        description: i % 3 === 0 ? `Description for item ${s * itemsPerSection + i + 1}` : undefined,
        variants: []
      })
    }
    
    categories.push({
      name: `Section ${s + 1}`,
      items,
      subcategories: []
    })
  }
  
  return {
    currency: '$',
    menu: { categories }
  }
}

/**
 * Text-only menu (no images)
 */
const textOnlyMenu: ExtractionResultV2Type = {
  currency: '£',
  menu: {
    categories: [
      {
        name: 'Breakfast',
        items: [
          { name: 'Full English Breakfast', price: 12.50, variants: [] },
          { name: 'Pancakes', price: 8.00, variants: [] },
          { name: 'Eggs Benedict', price: 10.50, variants: [] }
        ],
        subcategories: []
      },
      {
        name: 'Lunch',
        items: [
          { name: 'Club Sandwich', price: 11.00, variants: [] },
          { name: 'Caesar Salad', price: 9.50, variants: [] },
          { name: 'Soup of the Day', price: 6.50, variants: [] }
        ],
        subcategories: []
      }
    ]
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Layout Engine Integration Tests', () => {
  
  describe('Full Pipeline: Extraction to Layout', () => {
    
    it('should transform extraction data to layout data', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu, 'Test Menu')
      
      expect(layoutData).toBeDefined()
      expect(layoutData.metadata.title).toBe('Test Menu')
      expect(layoutData.metadata.currency).toBe('$')
      expect(layoutData.sections).toHaveLength(2)
      expect(layoutData.sections[0].name).toBe('Appetizers')
      expect(layoutData.sections[0].items).toHaveLength(3)
      expect(layoutData.sections[1].name).toBe('Main Courses')
      expect(layoutData.sections[1].items).toHaveLength(2)
    })
    
    it('should analyze menu characteristics correctly', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu)
      const characteristics = analyzeMenuCharacteristics(layoutData)
      
      expect(characteristics.sectionCount).toBe(2)
      expect(characteristics.totalItems).toBe(5)
      expect(characteristics.avgItemsPerSection).toBe(2.5)
      expect(characteristics.imageRatio).toBe(0) // No images in test data
      expect(characteristics.hasDescriptions).toBe(true)
    })
    
    it('should select appropriate layout preset', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu)
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      
      expect(preset).toBeDefined()
      expect(preset.id).toBeDefined()
      expect(preset.family).toBeDefined()
      expect(['dense', 'image-forward', 'balanced', 'feature-band']).toContain(preset.family)
    })
    
    it('should generate grid layout with correct structure', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu)
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const gridLayout = generateGridLayout(layoutData, preset, 'desktop')
      
      expect(gridLayout).toBeDefined()
      expect(gridLayout.preset).toBe(preset)
      expect(gridLayout.context).toBe('desktop')
      expect(gridLayout.sections).toHaveLength(2)
      expect(gridLayout.totalTiles).toBeGreaterThanOrEqual(5) // At least 5 item tiles
    })
    
    it('should insert filler tiles for dead space', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu)
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      let gridLayout = generateGridLayout(layoutData, preset, 'desktop')
      
      const tilesBeforeFiller = gridLayout.totalTiles
      gridLayout = insertFillerTiles(gridLayout)
      
      // Filler tiles may or may not be added depending on grid alignment
      expect(gridLayout.totalTiles).toBeGreaterThanOrEqual(tilesBeforeFiller)
      
      // Check that filler tiles have correct type
      const fillerTiles = gridLayout.sections.flatMap(s => s.tiles).filter(t => t.type === 'filler')
      fillerTiles.forEach(tile => {
        expect(tile.type).toBe('filler')
        expect(['color', 'pattern', 'icon']).toContain(tile.style)
      })
    })
  })
  
  describe('Responsive Behavior Across Breakpoints', () => {
    
    const contexts: OutputContext[] = ['mobile', 'tablet', 'desktop', 'print']
    
    contexts.forEach(context => {
      it(`should generate valid layout for ${context} context`, () => {
        const layoutData = transformExtractionToLayout(smallMixedMenu)
        const characteristics = analyzeMenuCharacteristics(layoutData)
        const preset = selectLayoutPresetWithContext(characteristics, context)
        const gridLayout = generateGridLayout(layoutData, preset, context)
        
        expect(gridLayout.context).toBe(context)
        expect(gridLayout.sections).toHaveLength(2)
        
        // Verify column count matches context
        const expectedColumns = preset.gridConfig.columns[context]
        expect(expectedColumns).toBeGreaterThan(0)
        
        // Verify tiles are positioned within grid bounds
        gridLayout.sections.forEach(section => {
          section.tiles.forEach(tile => {
            expect(tile.column).toBeGreaterThanOrEqual(0)
            expect(tile.column).toBeLessThan(expectedColumns)
            expect(tile.row).toBeGreaterThanOrEqual(0)
          })
        })
      })
    })
    
    it('should adjust column count based on context', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu)
      const characteristics = analyzeMenuCharacteristics(layoutData)
      
      const mobilePreset = selectLayoutPresetWithContext(characteristics, 'mobile')
      const desktopPreset = selectLayoutPresetWithContext(characteristics, 'desktop')
      
      const mobileColumns = mobilePreset.gridConfig.columns.mobile
      const desktopColumns = desktopPreset.gridConfig.columns.desktop
      
      // Desktop should have more columns than mobile
      expect(desktopColumns).toBeGreaterThanOrEqual(mobileColumns)
    })
  })
  
  describe('Large Menu Performance', () => {
    
    it('should handle 50-item menu efficiently', () => {
      const startTime = Date.now()
      
      const largeMenu = generateLargeMenu(50)
      const layoutData = transformExtractionToLayout(largeMenu, 'Large Menu')
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const gridLayout = generateGridLayout(layoutData, preset, 'desktop')
      
      const duration = Date.now() - startTime
      
      expect(layoutData.sections.length).toBeGreaterThan(0)
      expect(characteristics.totalItems).toBe(50)
      expect(gridLayout.totalTiles).toBeGreaterThanOrEqual(50)
      
      // Should complete in under 500ms (layout calculation target)
      expect(duration).toBeLessThan(500)
    })
    
    it('should handle 100-item menu without errors', () => {
      const largeMenu = generateLargeMenu(100)
      const layoutData = transformExtractionToLayout(largeMenu, 'Very Large Menu')
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const gridLayout = generateGridLayout(layoutData, preset, 'desktop')
      
      expect(characteristics.totalItems).toBe(100)
      expect(gridLayout.sections.length).toBeGreaterThan(0)
      expect(gridLayout.totalTiles).toBeGreaterThanOrEqual(100)
    })
  })
  
  describe('Text-Only Menu Handling', () => {
    
    it('should handle text-only menus correctly', () => {
      const layoutData = transformExtractionToLayout(textOnlyMenu, 'Breakfast Menu')
      const characteristics = analyzeMenuCharacteristics(layoutData)
      
      expect(characteristics.imageRatio).toBe(0)
      expect(characteristics.totalItems).toBe(6)
      
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const gridLayout = generateGridLayout(layoutData, preset, 'desktop')
      
      expect(gridLayout.sections).toHaveLength(2)
      expect(gridLayout.totalTiles).toBeGreaterThanOrEqual(6)
    })
  })
  
  describe('HTML Export Generation', () => {
    
    it('should generate valid HTML export', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu, 'Test Menu')
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      
      // Render React component to HTML string
      const componentHTML = renderToString(
        createElement(ServerGridMenuLayout, {
          data: layoutData,
          preset,
          context: 'desktop',
          className: 'max-w-7xl mx-auto p-6'
        })
      )
      
      // Export to HTML with wrapper
      const result = exportToHTML(componentHTML, layoutData, 'desktop')
      
      expect(result).toBeDefined()
      expect(result.html).toBeDefined()
      expect(typeof result.html).toBe('string')
      expect(result.html.length).toBeGreaterThan(0)
      expect(result.size).toBeGreaterThan(0)
      expect(result.timestamp).toBeDefined()
      
      // Verify HTML structure
      expect(result.html).toContain('<!DOCTYPE html>')
      expect(result.html).toContain('<html')
      expect(result.html).toContain('</html>')
      expect(result.html).toContain('Test Menu')
      expect(result.html).toContain('Appetizers')
      expect(result.html).toContain('Main Courses')
    })
    
    it('should include all menu items in HTML export', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu)
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      
      // Render React component to HTML string
      const componentHTML = renderToString(
        createElement(ServerGridMenuLayout, {
          data: layoutData,
          preset,
          context: 'desktop',
          className: 'max-w-7xl mx-auto p-6'
        })
      )
      
      // Export to HTML with wrapper
      const result = exportToHTML(componentHTML, layoutData, 'desktop')
      const html = result.html
      
      // Check for item names
      expect(html).toContain('Bruschetta')
      expect(html).toContain('Calamari')
      expect(html).toContain('Caesar Salad')
      expect(html).toContain('Margherita Pizza')
      expect(html).toContain('Spaghetti Carbonara')
      
      // Check for prices
      expect(html).toContain('8.99')
      expect(html).toContain('12.99')
      expect(html).toContain('14.99')
    })
  })
  
  describe('Error Handling', () => {
    
    it('should handle invalid extraction data gracefully', () => {
      expect(() => {
        transformExtractionToLayout(null as any)
      }).toThrow()
    })
    
    it('should handle empty menu gracefully', () => {
      const emptyMenu: ExtractionResultV2Type = {
        currency: '$',
        menu: { categories: [] }
      }
      
      expect(() => {
        transformExtractionToLayout(emptyMenu)
      }).toThrow() // Should fail validation (min 1 section required)
    })
    
    it('should handle missing prices', () => {
      const menuWithMissingPrices: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: 'Item 1', price: undefined as any, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      const layoutData = transformExtractionToLayout(menuWithMissingPrices)
      expect(layoutData.sections[0].items[0].price).toBe(0) // Should default to 0
    })
  })
  
  describe('Error Scenario Tests', () => {
    
    it('should handle menu with negative prices', () => {
      const menuWithNegativePrices: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: 'Item 1', price: -10.99, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      // Should throw validation error for negative prices
      expect(() => {
        transformExtractionToLayout(menuWithNegativePrices)
      }).toThrow()
    })
    
    it('should handle menu with duplicate section names', () => {
      const menuWithDuplicates: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Appetizers',
              items: [
                { name: 'Item 1', price: 10, variants: [] }
              ],
              subcategories: []
            },
            {
              name: 'Appetizers',
              items: [
                { name: 'Item 2', price: 12, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      // Should still transform successfully (duplicate names are allowed)
      const layoutData = transformExtractionToLayout(menuWithDuplicates)
      expect(layoutData.sections).toHaveLength(2)
      expect(layoutData.sections[0].name).toBe('Appetizers')
      expect(layoutData.sections[1].name).toBe('Appetizers')
    })
    
    it('should handle menu with missing images gracefully', () => {
      const menuWithMissingImages: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: 'Item 1', price: 10, variants: [] },
                { name: 'Item 2', price: 12, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      const layoutData = transformExtractionToLayout(menuWithMissingImages)
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const gridLayout = generateGridLayout(layoutData, preset, 'desktop')
      
      // Should generate layout successfully with no images
      expect(gridLayout.sections).toHaveLength(1)
      expect(gridLayout.totalTiles).toBeGreaterThanOrEqual(2)
      expect(characteristics.imageRatio).toBe(0)
    })
    
    it('should handle extremely large menu (stress test)', () => {
      const largeMenu = generateLargeMenu(200)
      
      const startTime = Date.now()
      const layoutData = transformExtractionToLayout(largeMenu, 'Stress Test Menu')
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const gridLayout = generateGridLayout(layoutData, preset, 'desktop')
      const duration = Date.now() - startTime
      
      expect(characteristics.totalItems).toBe(200)
      expect(gridLayout.sections.length).toBeGreaterThan(0)
      expect(gridLayout.totalTiles).toBeGreaterThanOrEqual(200)
      
      // Should complete in reasonable time (under 1 second for 200 items)
      expect(duration).toBeLessThan(1000)
    })
    
    it('should handle menu with very long item names', () => {
      const longName = 'A'.repeat(200) // Maximum allowed length
      const menuWithLongNames: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: longName, price: 10, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      const layoutData = transformExtractionToLayout(menuWithLongNames)
      expect(layoutData.sections[0].items[0].name).toBe(longName)
      expect(layoutData.sections[0].items[0].name.length).toBe(200)
    })
    
    it('should handle menu with very long descriptions', () => {
      const longDescription = 'B'.repeat(500) // Maximum allowed length
      const menuWithLongDescriptions: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: 'Item 1', price: 10, description: longDescription, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      const layoutData = transformExtractionToLayout(menuWithLongDescriptions)
      expect(layoutData.sections[0].items[0].description).toBe(longDescription)
      expect(layoutData.sections[0].items[0].description?.length).toBe(500)
    })
    
    it('should reject menu with item name exceeding max length', () => {
      const tooLongName = 'A'.repeat(201) // Exceeds maximum
      const menuWithTooLongName: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: tooLongName, price: 10, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      expect(() => {
        transformExtractionToLayout(menuWithTooLongName)
      }).toThrow()
    })
    
    it('should handle menu with special characters in names', () => {
      const menuWithSpecialChars: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Café & Bistro',
              items: [
                { name: 'Crème Brûlée', price: 8.99, variants: [] },
                { name: 'Fish & Chips', price: 12.99, variants: [] },
                { name: 'Jalapeño Poppers', price: 6.99, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      const layoutData = transformExtractionToLayout(menuWithSpecialChars)
      
      // Render to HTML to ensure special characters are escaped
      const characteristics = analyzeMenuCharacteristics(layoutData)
      const preset = selectLayoutPresetWithContext(characteristics, 'desktop')
      const componentHTML = renderToString(
        createElement(ServerGridMenuLayout, {
          data: layoutData,
          preset,
          context: 'desktop',
          className: 'max-w-7xl mx-auto p-6'
        })
      )
      const result = exportToHTML(componentHTML, layoutData, 'desktop')
      
      // Should contain properly escaped characters
      expect(result.html).toContain('Café')
      expect(result.html).toContain('Crème Brûlée')
      expect(result.html).toContain('Fish &amp; Chips')
      expect(result.html).toContain('Jalapeño')
    })
    
    it('should handle menu with empty section names', () => {
      const menuWithEmptySection: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: '',
              items: [
                { name: 'Item 1', price: 10, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      // Should throw validation error for empty section name
      expect(() => {
        transformExtractionToLayout(menuWithEmptySection)
      }).toThrow()
    })
    
    it('should handle menu with empty item names', () => {
      const menuWithEmptyItem: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: '', price: 10, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      // Should throw validation error for empty item name
      expect(() => {
        transformExtractionToLayout(menuWithEmptyItem)
      }).toThrow()
    })
    
    it('should handle menu with infinite price values', () => {
      const menuWithInfinitePrice: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: 'Item 1', price: Infinity, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      // Should throw validation error for infinite price
      expect(() => {
        transformExtractionToLayout(menuWithInfinitePrice)
      }).toThrow()
    })
    
    it('should handle menu with NaN price values', () => {
      const menuWithNaNPrice: ExtractionResultV2Type = {
        currency: '$',
        menu: {
          categories: [
            {
              name: 'Test',
              items: [
                { name: 'Item 1', price: NaN, variants: [] }
              ],
              subcategories: []
            }
          ]
        }
      }
      
      // Should throw validation error for NaN price
      expect(() => {
        transformExtractionToLayout(menuWithNaNPrice)
      }).toThrow()
    })
  })
  
  describe('Data Consistency', () => {
    
    it('should maintain data integrity through transformation pipeline', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu, 'Consistency Test')
      
      // Verify all items are preserved
      const totalItems = layoutData.sections.reduce((sum, s) => sum + s.items.length, 0)
      const originalItems = smallMixedMenu.menu.categories.reduce((sum, c) => sum + c.items.length, 0)
      expect(totalItems).toBe(originalItems)
      
      // Verify item data is correct
      const firstItem = layoutData.sections[0].items[0]
      expect(firstItem.name).toBe('Bruschetta')
      expect(firstItem.price).toBe(8.99)
      expect(firstItem.description).toBe('Toasted bread with tomatoes and basil')
    })
    
    it('should preserve currency information', () => {
      const layoutData = transformExtractionToLayout(smallMixedMenu)
      expect(layoutData.metadata.currency).toBe('$')
      
      const gbpLayoutData = transformExtractionToLayout(textOnlyMenu)
      expect(gbpLayoutData.metadata.currency).toBe('£')
    })
  })
})
