/**
 * Unit Tests for Data Transformation Layer
 * 
 * Tests the transformation of extraction results to layout data and
 * menu characteristics analysis.
 */

import { transformExtractionToLayout, analyzeMenuCharacteristics } from '@/lib/templates/data-transformer'
import type { ExtractionResultV2Type } from '@/lib/extraction/schema-stage2'
import type { LayoutMenuData } from '@/lib/templates/types'

describe('Data Transformation Layer', () => {
  describe('transformExtractionToLayout', () => {
    it('should transform basic extraction result to layout data', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: [
            {
              name: 'Starters',
              items: [
                {
                  name: 'Caesar Salad',
                  price: 12.50,
                  description: 'Fresh romaine lettuce with parmesan',
                  confidence: 0.95
                },
                {
                  name: 'Soup of the Day',
                  price: 8.00,
                  confidence: 0.90
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const result = transformExtractionToLayout(extraction, 'Test Menu')

      expect(result.metadata.title).toBe('Test Menu')
      expect(result.metadata.currency).toBe('USD')
      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].name).toBe('Starters')
      expect(result.sections[0].items).toHaveLength(2)
      expect(result.sections[0].items[0].name).toBe('Caesar Salad')
      expect(result.sections[0].items[0].price).toBe(12.50)
      expect(result.sections[0].items[0].description).toBe('Fresh romaine lettuce with parmesan')
      expect(result.sections[0].items[0].featured).toBe(false)
      expect(result.sections[0].items[0].imageRef).toBeUndefined()
    })

    it('should use default menu title when not provided', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: [
            {
              name: 'Drinks',
              items: [
                { name: 'Water', price: 2.00, confidence: 0.95 }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'EUR',
        uncertainItems: [],
        superfluousText: []
      }

      const result = transformExtractionToLayout(extraction)

      expect(result.metadata.title).toBe('Menu')
    })

    it('should handle items with variants', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: [
            {
              name: 'Beverages',
              items: [
                {
                  name: 'Coffee',
                  confidence: 0.95,
                  variants: [
                    { size: 'Small', price: 3.50, confidence: 0.95 },
                    { size: 'Large', price: 5.00, confidence: 0.95 }
                  ]
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const result = transformExtractionToLayout(extraction)

      expect(result.sections[0].items[0].name).toBe('Coffee')
      expect(result.sections[0].items[0].price).toBe(3.50) // First variant price
    })

    it('should handle set menus', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: [
            {
              name: 'Set Menus',
              items: [
                {
                  name: 'Lunch Special',
                  confidence: 0.95,
                  type: 'set_menu',
                  setMenu: {
                    courses: [
                      {
                        name: 'Starter',
                        options: [
                          { name: 'Soup', priceDelta: 5.00 },
                          { name: 'Salad', priceDelta: 6.00 }
                        ]
                      },
                      {
                        name: 'Main',
                        options: [
                          { name: 'Pasta', priceDelta: 12.00 },
                          { name: 'Steak', priceDelta: 18.00 }
                        ]
                      }
                    ]
                  }
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const result = transformExtractionToLayout(extraction)

      expect(result.sections[0].items[0].name).toBe('Lunch Special')
      expect(result.sections[0].items[0].price).toBe(17.00) // 5.00 + 12.00
    })

    it('should flatten nested subcategories', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: [
            {
              name: 'Main Courses',
              items: [
                { name: 'Steak', price: 25.00, confidence: 0.95 }
              ],
              subcategories: [
                {
                  name: 'Pasta',
                  items: [
                    { name: 'Spaghetti', price: 15.00, confidence: 0.95 }
                  ],
                  confidence: 0.95
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const result = transformExtractionToLayout(extraction)

      expect(result.sections).toHaveLength(2)
      expect(result.sections[0].name).toBe('Main Courses')
      expect(result.sections[1].name).toBe('Pasta')
    })

    it('should skip empty categories', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: [
            {
              name: 'Empty Category',
              items: [],
              confidence: 0.95
            },
            {
              name: 'Valid Category',
              items: [
                { name: 'Item', price: 10.00, confidence: 0.95 }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const result = transformExtractionToLayout(extraction)

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].name).toBe('Valid Category')
    })

    it('should handle items with base price and variants', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: [
            {
              name: 'Pizza',
              items: [
                {
                  name: 'Margherita',
                  price: 12.00, // Base price
                  confidence: 0.95,
                  variants: [
                    { size: 'Small', price: 10.00, confidence: 0.95 },
                    { size: 'Large', price: 15.00, confidence: 0.95 }
                  ]
                }
              ],
              confidence: 0.95
            }
          ]
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      const result = transformExtractionToLayout(extraction)

      // Should use base price when available
      expect(result.sections[0].items[0].price).toBe(12.00)
    })

    it('should throw validation error for invalid data', () => {
      const extraction: ExtractionResultV2Type = {
        menu: {
          categories: []
        },
        currency: 'USD',
        uncertainItems: [],
        superfluousText: []
      }

      expect(() => transformExtractionToLayout(extraction)).toThrow()
    })
  })

  describe('analyzeMenuCharacteristics', () => {
    it('should calculate basic characteristics', () => {
      const layoutData: LayoutMenuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD'
        },
        sections: [
          {
            name: 'Starters',
            items: [
              { name: 'Salad', price: 10.00, featured: false },
              { name: 'Soup', price: 8.00, featured: false }
            ]
          },
          {
            name: 'Mains',
            items: [
              { name: 'Steak', price: 25.00, featured: false },
              { name: 'Fish', price: 22.00, featured: false }
            ]
          }
        ]
      }

      const characteristics = analyzeMenuCharacteristics(layoutData)

      expect(characteristics.sectionCount).toBe(2)
      expect(characteristics.totalItems).toBe(4)
      expect(characteristics.avgItemsPerSection).toBe(2)
      expect(characteristics.imageRatio).toBe(0) // No images
      expect(characteristics.hasDescriptions).toBe(false)
    })

    it('should calculate image ratio correctly', () => {
      const layoutData: LayoutMenuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD'
        },
        sections: [
          {
            name: 'Items',
            items: [
              { name: 'Item 1', price: 10.00, imageRef: 'http://example.com/1.jpg', featured: false },
              { name: 'Item 2', price: 10.00, featured: false },
              { name: 'Item 3', price: 10.00, imageRef: 'http://example.com/3.jpg', featured: false },
              { name: 'Item 4', price: 10.00, featured: false }
            ]
          }
        ]
      }

      const characteristics = analyzeMenuCharacteristics(layoutData)

      expect(characteristics.imageRatio).toBe(50) // 2 out of 4 items
    })

    it('should calculate average name length', () => {
      const layoutData: LayoutMenuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD'
        },
        sections: [
          {
            name: 'Items',
            items: [
              { name: 'AB', price: 10.00, featured: false }, // 2 chars
              { name: 'ABCD', price: 10.00, featured: false }, // 4 chars
              { name: 'ABCDEF', price: 10.00, featured: false } // 6 chars
            ]
          }
        ]
      }

      const characteristics = analyzeMenuCharacteristics(layoutData)

      expect(characteristics.avgNameLength).toBe(4) // (2 + 4 + 6) / 3
    })

    it('should detect descriptions', () => {
      const layoutData: LayoutMenuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD'
        },
        sections: [
          {
            name: 'Items',
            items: [
              { name: 'Item 1', price: 10.00, featured: false },
              { name: 'Item 2', price: 10.00, description: 'A delicious item', featured: false }
            ]
          }
        ]
      }

      const characteristics = analyzeMenuCharacteristics(layoutData)

      expect(characteristics.hasDescriptions).toBe(true)
    })

    it('should handle empty menu gracefully', () => {
      const layoutData: LayoutMenuData = {
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

      const characteristics = analyzeMenuCharacteristics(layoutData)

      expect(characteristics.sectionCount).toBe(1)
      expect(characteristics.totalItems).toBe(0)
      expect(characteristics.avgItemsPerSection).toBe(0)
      expect(characteristics.avgNameLength).toBe(0)
      expect(characteristics.imageRatio).toBe(0)
      expect(characteristics.hasDescriptions).toBe(false)
    })

    it('should handle 100% image ratio', () => {
      const layoutData: LayoutMenuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD'
        },
        sections: [
          {
            name: 'Items',
            items: [
              { name: 'Item 1', price: 10.00, imageRef: 'http://example.com/1.jpg', featured: false },
              { name: 'Item 2', price: 10.00, imageRef: 'http://example.com/2.jpg', featured: false }
            ]
          }
        ]
      }

      const characteristics = analyzeMenuCharacteristics(layoutData)

      expect(characteristics.imageRatio).toBe(100)
    })

    it('should calculate characteristics across multiple sections', () => {
      const layoutData: LayoutMenuData = {
        metadata: {
          title: 'Test Menu',
          currency: 'USD'
        },
        sections: [
          {
            name: 'Section 1',
            items: [
              { name: 'A', price: 10.00, featured: false },
              { name: 'B', price: 10.00, featured: false }
            ]
          },
          {
            name: 'Section 2',
            items: [
              { name: 'C', price: 10.00, imageRef: 'http://example.com/c.jpg', featured: false },
              { name: 'D', price: 10.00, featured: false },
              { name: 'E', price: 10.00, featured: false }
            ]
          },
          {
            name: 'Section 3',
            items: [
              { name: 'F', price: 10.00, featured: false }
            ]
          }
        ]
      }

      const characteristics = analyzeMenuCharacteristics(layoutData)

      expect(characteristics.sectionCount).toBe(3)
      expect(characteristics.totalItems).toBe(6)
      expect(characteristics.avgItemsPerSection).toBe(2) // 6 / 3
      expect(characteristics.imageRatio).toBeCloseTo(16.67, 1) // 1 out of 6
    })
  })
})
