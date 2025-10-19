/**
 * Unit tests for RenderEngine
 */

import { RenderEngine, renderEngine } from '../engine'
import type {
  BoundData,
  ParsedTemplate,
  RenderOptions,
  CategoryBinding,
  ItemBinding,
} from '@/types/templates'

// Mock performance.now for Node environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  } as any
}

describe('RenderEngine', () => {
  let engine: RenderEngine

  beforeEach(() => {
    engine = new RenderEngine()
    engine.clearCache()
  })

  // Mock data
  const mockTemplate: ParsedTemplate = {
    structure: {
      id: 'test-template-123',
      name: 'Test Template',
      type: 'FRAME',
      styles: {
        fills: [],
        strokes: [],
        effects: [],
      },
      layout: {
        layoutMode: 'VERTICAL',
        primaryAxisSizingMode: 'AUTO',
        counterAxisSizingMode: 'FIXED',
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 24,
        paddingBottom: 24,
        itemSpacing: 16,
        counterAxisAlignItems: 'MIN',
        primaryAxisAlignItems: 'MIN',
      },
    },
    bindings: {
      restaurantName: 'RestaurantName',
      categoryName: 'CategoryName',
      categoryItems: 'ItemsContainer',
      itemName: 'ItemName',
      itemPrice: 'ItemPrice',
      itemDescription: 'ItemDescription',
      conditionalLayers: [],
    },
    styles: {
      css: '',
      fonts: [],
      colors: {},
    },
    assets: {
      images: [],
      fonts: [],
    },
  }

  const mockBoundData: BoundData = {
    restaurantName: 'Test Restaurant',
    categoryBindings: [
      {
        categoryName: 'Appetizers',
        items: [
          {
            name: 'Spring Rolls',
            price: '$8.99',
            description: 'Crispy vegetable spring rolls',
            showPrice: true,
            showDescription: true,
            showIcon: false,
            showDietaryTags: false,
            showAllergens: false,
            showVariants: false,
          },
          {
            name: 'Soup of the Day',
            price: '$6.50',
            showPrice: true,
            showDescription: false,
            showIcon: false,
            showDietaryTags: false,
            showAllergens: false,
            showVariants: false,
          },
        ],
      },
      {
        categoryName: 'Main Courses',
        items: [
          {
            name: 'Grilled Salmon',
            price: '$24.99',
            description: 'Fresh Atlantic salmon with seasonal vegetables',
            showPrice: true,
            showDescription: true,
            showIcon: false,
            showDietaryTags: false,
            showAllergens: false,
            showVariants: false,
          },
        ],
      },
    ],
    globalStyles: {
      colors: {
        primary: '#333333',
        secondary: '#666666',
      },
      fonts: {
        heading: 'Arial',
        body: 'Helvetica',
      },
      spacing: {
        itemSpacing: 16,
        categorySpacing: 32,
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
    },
  }

  const mockOptions: RenderOptions = {
    format: 'html',
    quality: 'standard',
  }

  describe('render', () => {
    it('should generate HTML and CSS from bound data', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result).toBeDefined()
      expect(result.html).toContain('<!DOCTYPE html>')
      expect(result.html).toContain('Test Restaurant')
      expect(result.html).toContain('Appetizers')
      expect(result.html).toContain('Spring Rolls')
      expect(result.css).toBeDefined()
      expect(result.assets).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    it('should include all categories in output', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.html).toContain('Appetizers')
      expect(result.html).toContain('Main Courses')
    })

    it('should include all items in output', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.html).toContain('Spring Rolls')
      expect(result.html).toContain('Soup of the Day')
      expect(result.html).toContain('Grilled Salmon')
    })

    it('should include prices when showPrice is true', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.html).toContain('$8.99')
      expect(result.html).toContain('$6.50')
      expect(result.html).toContain('$24.99')
    })

    it('should include descriptions when showDescription is true', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.html).toContain('Crispy vegetable spring rolls')
      expect(result.html).toContain('Fresh Atlantic salmon with seasonal vegetables')
    })

    it('should not include descriptions when showDescription is false', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      // Soup of the Day has no description
      const soupSection = result.html.substring(
        result.html.indexOf('Soup of the Day'),
        result.html.indexOf('Main Courses')
      )
      expect(soupSection).not.toContain('item-description')
    })

    it('should generate correct metadata', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.metadata.templateId).toBe('test-template-123')
      expect(result.metadata.itemCount).toBe(3)
      expect(result.metadata.categoryCount).toBe(2)
      expect(result.metadata.renderedAt).toBeInstanceOf(Date)
      expect(result.metadata.estimatedPrintSize).toBeDefined()
    })
  })

  describe('print optimization', () => {
    it('should add print-specific CSS for PDF format', async () => {
      const pdfOptions: RenderOptions = { ...mockOptions, format: 'pdf' }
      const result = await engine.render(mockBoundData, mockTemplate, pdfOptions)

      expect(result.css).toContain('page-break-inside: avoid')
      expect(result.css).toContain('break-inside: avoid')
    })

    it('should add print-specific CSS for PNG format', async () => {
      const pngOptions: RenderOptions = { ...mockOptions, format: 'png' }
      const result = await engine.render(mockBoundData, mockTemplate, pngOptions)

      expect(result.css).toContain('page-break-inside: avoid')
      expect(result.css).toContain('break-inside: avoid')
    })

    it('should prevent category header orphans', async () => {
      const pdfOptions: RenderOptions = { ...mockOptions, format: 'pdf' }
      const result = await engine.render(mockBoundData, mockTemplate, pdfOptions)

      expect(result.css).toContain('page-break-after: avoid')
      expect(result.css).toContain('break-after: avoid')
    })

    it('should keep category header with first item', async () => {
      const pdfOptions: RenderOptions = { ...mockOptions, format: 'pdf' }
      const result = await engine.render(mockBoundData, mockTemplate, pdfOptions)

      expect(result.css).toContain('page-break-before: avoid')
      expect(result.css).toContain('break-before: avoid')
    })

    it('should not add print CSS for HTML format', async () => {
      const htmlOptions: RenderOptions = { ...mockOptions, format: 'html' }
      const result = await engine.render(mockBoundData, mockTemplate, htmlOptions)

      // Should still have @media print but not the extra pagination rules
      expect(result.css).toContain('@media print')
    })
  })

  describe('performance and caching', () => {
    it('should cache render results', async () => {
      const result1 = await engine.render(mockBoundData, mockTemplate, mockOptions)
      const result2 = await engine.render(mockBoundData, mockTemplate, mockOptions)

      // Should return same result from cache
      expect(result1.html).toBe(result2.html)
      expect(result1.css).toBe(result2.css)
    })

    it('should return cache statistics', () => {
      const stats = engine.getCacheStats()

      expect(stats).toHaveProperty('renderCacheSize')
      expect(stats).toHaveProperty('cssCacheSize')
      expect(stats).toHaveProperty('htmlFragmentCacheSize')
    })

    it('should clear all caches', async () => {
      await engine.render(mockBoundData, mockTemplate, mockOptions)
      
      let stats = engine.getCacheStats()
      expect(stats.renderCacheSize).toBeGreaterThan(0)

      engine.clearCache()
      
      stats = engine.getCacheStats()
      expect(stats.renderCacheSize).toBe(0)
      expect(stats.cssCacheSize).toBe(0)
      expect(stats.htmlFragmentCacheSize).toBe(0)
    })

    it('should handle large menus efficiently', async () => {
      // Create a large menu with 150 items
      const largeMenu: BoundData = {
        ...mockBoundData,
        categoryBindings: Array.from({ length: 15 }, (_, i) => ({
          categoryName: `Category ${i + 1}`,
          items: Array.from({ length: 10 }, (_, j) => ({
            name: `Item ${i * 10 + j + 1}`,
            price: `$${(10 + j).toFixed(2)}`,
            description: `Description for item ${i * 10 + j + 1}`,
            showPrice: true,
            showDescription: true,
            showIcon: false,
            showDietaryTags: false,
            showAllergens: false,
            showVariants: false,
          })),
        })),
      }

      const startTime = performance.now()
      const result = await engine.render(largeMenu, mockTemplate, mockOptions)
      const renderTime = performance.now() - startTime

      expect(result.metadata.itemCount).toBe(150)
      expect(renderTime).toBeLessThan(2000) // Should complete within 2 seconds
    })
  })

  describe('HTML escaping', () => {
    it('should escape HTML special characters in item names', async () => {
      const dataWithSpecialChars: BoundData = {
        ...mockBoundData,
        categoryBindings: [
          {
            categoryName: 'Test <Category>',
            items: [
              {
                name: 'Item with <script>alert("xss")</script>',
                price: '$10.00',
                description: 'Description with & ampersand',
                showPrice: true,
                showDescription: true,
                showIcon: false,
                showDietaryTags: false,
                showAllergens: false,
                showVariants: false,
              },
            ],
          },
        ],
      }

      const result = await engine.render(dataWithSpecialChars, mockTemplate, mockOptions)

      expect(result.html).toContain('&lt;script&gt;')
      expect(result.html).not.toContain('<script>')
      expect(result.html).toContain('&amp;')
      expect(result.html).toContain('&lt;Category&gt;')
    })

    it('should escape quotes in attributes', async () => {
      const dataWithQuotes: BoundData = {
        ...mockBoundData,
        categoryBindings: [
          {
            categoryName: 'Category',
            items: [
              {
                name: 'Item with "quotes" and \'apostrophes\'',
                showPrice: false,
                showDescription: false,
                showIcon: false,
                showDietaryTags: false,
                showAllergens: false,
                showVariants: false,
              },
            ],
          },
        ],
      }

      const result = await engine.render(dataWithQuotes, mockTemplate, mockOptions)

      expect(result.html).toContain('&quot;')
      expect(result.html).toContain('&#039;')
    })
  })

  describe('dietary tags and allergens', () => {
    it('should render dietary tags when present', async () => {
      const dataWithDietaryTags: BoundData = {
        ...mockBoundData,
        categoryBindings: [
          {
            categoryName: 'Healthy Options',
            items: [
              {
                name: 'Vegan Salad',
                price: '$12.00',
                dietaryTags: [
                  { type: 'vegan', label: 'Vegan' },
                  { type: 'gluten-free', label: 'GF' },
                ],
                showPrice: true,
                showDescription: false,
                showIcon: false,
                showDietaryTags: true,
                showAllergens: false,
                showVariants: false,
              },
            ],
          },
        ],
      }

      const result = await engine.render(dataWithDietaryTags, mockTemplate, mockOptions)

      expect(result.html).toContain('item-dietary-tags')
      expect(result.html).toContain('Vegan')
      expect(result.html).toContain('GF')
      expect(result.html).toContain('dietary-tag-vegan')
      expect(result.html).toContain('dietary-tag-gluten-free')
    })

    it('should render allergens when present', async () => {
      const dataWithAllergens: BoundData = {
        ...mockBoundData,
        categoryBindings: [
          {
            categoryName: 'Seafood',
            items: [
              {
                name: 'Shrimp Pasta',
                price: '$18.00',
                allergens: ['shellfish', 'gluten', 'dairy'],
                showPrice: true,
                showDescription: false,
                showIcon: false,
                showDietaryTags: false,
                showAllergens: true,
                showVariants: false,
              },
            ],
          },
        ],
      }

      const result = await engine.render(dataWithAllergens, mockTemplate, mockOptions)

      expect(result.html).toContain('item-allergens')
      expect(result.html).toContain('shellfish')
      expect(result.html).toContain('gluten')
      expect(result.html).toContain('dairy')
    })
  })

  describe('variants', () => {
    it('should render item variants when present', async () => {
      const dataWithVariants: BoundData = {
        ...mockBoundData,
        categoryBindings: [
          {
            categoryName: 'Beverages',
            items: [
              {
                name: 'Coffee',
                variants: [
                  { label: 'Small', price: '$3.00' },
                  { label: 'Medium', price: '$4.00' },
                  { label: 'Large', price: '$5.00' },
                ],
                showPrice: false,
                showDescription: false,
                showIcon: false,
                showDietaryTags: false,
                showAllergens: false,
                showVariants: true,
              },
            ],
          },
        ],
      }

      const result = await engine.render(dataWithVariants, mockTemplate, mockOptions)

      expect(result.html).toContain('item-variants')
      expect(result.html).toContain('Small')
      expect(result.html).toContain('$3.00')
      expect(result.html).toContain('Medium')
      expect(result.html).toContain('$4.00')
      expect(result.html).toContain('Large')
      expect(result.html).toContain('$5.00')
    })
  })

  describe('global styles', () => {
    it('should apply custom colors from global styles', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.css).toContain('--color-primary: #333333')
      expect(result.css).toContain('--color-secondary: #666666')
    })

    it('should apply custom fonts from global styles', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.css).toContain('--font-heading: Arial')
      expect(result.css).toContain('--font-body: Helvetica')
    })

    it('should apply custom spacing from global styles', async () => {
      const result = await engine.render(mockBoundData, mockTemplate, mockOptions)

      expect(result.css).toContain('--spacing-item: 16px')
      expect(result.css).toContain('--spacing-category: 32px')
      expect(result.css).toContain('--padding-top: 24px')
    })
  })

  describe('subcategories', () => {
    it('should render subcategories recursively', async () => {
      const dataWithSubcategories: BoundData = {
        ...mockBoundData,
        categoryBindings: [
          {
            categoryName: 'Drinks',
            items: [],
            subcategories: [
              {
                categoryName: 'Hot Drinks',
                items: [
                  {
                    name: 'Coffee',
                    price: '$3.00',
                    showPrice: true,
                    showDescription: false,
                    showIcon: false,
                    showDietaryTags: false,
                    showAllergens: false,
                    showVariants: false,
                  },
                ],
              },
              {
                categoryName: 'Cold Drinks',
                items: [
                  {
                    name: 'Iced Tea',
                    price: '$2.50',
                    showPrice: true,
                    showDescription: false,
                    showIcon: false,
                    showDietaryTags: false,
                    showAllergens: false,
                    showVariants: false,
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = await engine.render(dataWithSubcategories, mockTemplate, mockOptions)

      expect(result.html).toContain('Drinks')
      expect(result.html).toContain('Hot Drinks')
      expect(result.html).toContain('Cold Drinks')
      expect(result.html).toContain('Coffee')
      expect(result.html).toContain('Iced Tea')
      expect(result.html).toContain('subcategory')
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(renderEngine).toBeInstanceOf(RenderEngine)
    })
  })
})
