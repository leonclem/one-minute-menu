/**
 * Compatibility Checker Tests
 * 
 * Tests for template-menu compatibility checking
 */

import { describe, it, expect } from '@jest/globals'
import { checkCompatibility, calculateTemplateCapacity } from '../compatibility-checker'
import type { EngineMenu } from '../menu-transformer'
import type { MenuTemplate } from '../engine-types'
import { TEMPLATE_ENGINE_CONFIG } from '../engine-config'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test menu with specified sections and items
 */
function createTestMenu(options: {
  sections: number
  itemsPerSection: number
  imageRatio?: number // 0-100, percentage of items with images
}): EngineMenu {
  const { sections, itemsPerSection, imageRatio = 0 } = options
  const totalItems = sections * itemsPerSection
  const itemsWithImages = Math.floor((totalItems * imageRatio) / 100)
  
  let imageCounter = 0
  
  return {
    id: 'test-menu',
    name: 'Test Menu',
    sections: Array.from({ length: sections }, (_, sectionIdx) => ({
      id: `section-${sectionIdx}`,
      name: `Section ${sectionIdx + 1}`,
      sortOrder: sectionIdx,
      items: Array.from({ length: itemsPerSection }, (_, itemIdx) => {
        const hasImage = imageCounter < itemsWithImages
        imageCounter++
        
        return {
          id: `item-${sectionIdx}-${itemIdx}`,
          name: `Item ${itemIdx + 1}`,
          description: 'Test description',
          price: 10.99,
          imageUrl: hasImage ? 'https://example.com/image.jpg' : undefined,
          sortOrder: itemIdx
        }
      })
    })),
    metadata: {
      currency: '$',
      venueName: 'Test Restaurant'
    }
  }
}

/**
 * Create a minimal test template
 */
function createTestTemplate(overrides?: Partial<MenuTemplate>): MenuTemplate {
  return {
    id: 'test-template',
    name: 'Test Template',
    description: 'A test template',
    thumbnailUrl: '/test.jpg',
    aspectRatio: 'A4_PORTRAIT',
    orientation: 'A4_PORTRAIT',
    layout: {
      baseCols: 3,
      baseRows: 10,
      tiles: [
        {
          id: 'title-1',
          type: 'TITLE',
          col: 0,
          row: 0,
          colSpan: 3,
          rowSpan: 1
        },
        {
          id: 'item-1',
          type: 'ITEM',
          col: 0,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        },
        {
          id: 'item-2',
          type: 'ITEM',
          col: 1,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        },
        {
          id: 'item-3',
          type: 'ITEM',
          col: 2,
          row: 1,
          colSpan: 1,
          rowSpan: 1
        }
      ],
      repeatPattern: {
        fromRow: 2,
        rowsPerRepeat: 1,
        repeatItemTileIds: ['item-1', 'item-2', 'item-3'],
        maxRepeats: 10
      }
    },
    constraints: {
      minSections: 1,
      maxSections: 5,
      minItems: 3,
      hardMaxItems: 50
    },
    capabilities: {
      supportsImages: true,
      supportsLogoPlaceholder: true,
      supportsColourPalettes: false,
      supportsTextOnlyMode: true,
      supportsResponsiveWeb: true,
      autoFillerTiles: false
    },
    configurationSchema: {
      allowImageToggle: true
    },
    version: '1.0.0',
    ...overrides
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Compatibility Checker', () => {
  describe('checkCompatibility', () => {
    describe('Section constraints', () => {
      it('should return INCOMPATIBLE when menu has too few sections', () => {
        const menu = createTestMenu({ sections: 1, itemsPerSection: 10 })
        const template = createTestTemplate({
          constraints: {
            minSections: 2,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 100
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('INCOMPATIBLE')
        expect(result.message).toContain('requires at least 2 sections')
        expect(result.message).toContain('your menu has 1')
      })

      it('should return INCOMPATIBLE when menu has too many sections', () => {
        const menu = createTestMenu({ sections: 6, itemsPerSection: 5 })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 100
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('INCOMPATIBLE')
        expect(result.message).toContain('supports up to 5 sections')
        expect(result.message).toContain('your menu has 6')
      })

      it('should return OK when section count is within bounds', () => {
        const menu = createTestMenu({ sections: 3, itemsPerSection: 5 }) // 15 items, within comfortable capacity
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 100
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('OK')
      })

      it('should handle unbounded maxSections', () => {
        const menu = createTestMenu({ sections: 10, itemsPerSection: 1 }) // 10 items, within comfortable capacity
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 'unbounded',
            minItems: 1,
            hardMaxItems: 150
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('OK')
      })
    })

    describe('Item constraints', () => {
      it('should return INCOMPATIBLE when menu has too few items', () => {
        const menu = createTestMenu({ sections: 1, itemsPerSection: 2 })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 5,
            hardMaxItems: 100
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('INCOMPATIBLE')
        expect(result.message).toContain('requires at least 5 items')
        expect(result.message).toContain('your menu has 2')
      })

      it('should return INCOMPATIBLE when menu exceeds hardMaxItems', () => {
        const menu = createTestMenu({ sections: 2, itemsPerSection: 30 }) // 60 items
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 50
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('INCOMPATIBLE')
        expect(result.message).toContain('supports up to 50 items')
        expect(result.message).toContain('your menu has 60')
      })

      it('should use global default when hardMaxItems not specified', () => {
        const menu = createTestMenu({ sections: 1, itemsPerSection: 160 })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1
            // hardMaxItems not specified, should use default of 150
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('INCOMPATIBLE')
        expect(result.message).toContain(`supports up to ${TEMPLATE_ENGINE_CONFIG.hardMaxItemsDefault} items`)
      })

      it('should return OK when item count is within bounds', () => {
        const menu = createTestMenu({ sections: 2, itemsPerSection: 10 }) // 20 items
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 5,
            hardMaxItems: 50
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('OK')
      })
    })

    describe('Image requirements', () => {
      it('should return WARNING when template requires images but menu has few', () => {
        const menu = createTestMenu({ 
          sections: 1, 
          itemsPerSection: 10,
          imageRatio: 30 // Only 30% have images
        })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 100,
            requiresImages: true
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('WARNING')
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]).toContain('works best with images')
        expect(result.warnings[0]).toContain('30%')
      })

      it('should return OK when template requires images and menu has enough', () => {
        const menu = createTestMenu({ 
          sections: 1, 
          itemsPerSection: 10,
          imageRatio: 80 // 80% have images
        })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 100,
            requiresImages: true
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('OK')
        expect(result.warnings).toHaveLength(0)
      })

      it('should not warn about images when template does not require them', () => {
        const menu = createTestMenu({ 
          sections: 1, 
          itemsPerSection: 10,
          imageRatio: 0 // No images
        })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 100,
            requiresImages: false
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('OK')
        expect(result.warnings).toHaveLength(0)
      })
    })

    describe('Capacity warnings', () => {
      it('should return WARNING when menu exceeds comfortable capacity', () => {
        // Template has 3 base items + (3 * 10 repeats) = 33 max capacity
        // Comfortable is 3 + floor(30 * 0.6) = 21
        const menu = createTestMenu({ sections: 1, itemsPerSection: 25 })
        const template = createTestTemplate() // Uses default with 33 max capacity
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('WARNING')
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings.some(w => w.includes('designed for'))).toBe(true)
      })

      it('should return OK when menu is within comfortable capacity', () => {
        const menu = createTestMenu({ sections: 1, itemsPerSection: 10 })
        const template = createTestTemplate()
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('OK')
        expect(result.warnings).toHaveLength(0)
      })
    })

    describe('Combined scenarios', () => {
      it('should return OK for perfectly compatible menu', () => {
        const menu = createTestMenu({ 
          sections: 2, 
          itemsPerSection: 10,
          imageRatio: 100
        })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 5,
            hardMaxItems: 50
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('OK')
        expect(result.warnings).toHaveLength(0)
        expect(result.message).toBeUndefined()
      })

      it('should prioritize INCOMPATIBLE over WARNING', () => {
        const menu = createTestMenu({ 
          sections: 1, 
          itemsPerSection: 60, // Exceeds hardMaxItems
          imageRatio: 10 // Would trigger image warning
        })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 50,
            requiresImages: true
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        // Should be INCOMPATIBLE due to item count, not WARNING for images
        expect(result.status).toBe('INCOMPATIBLE')
        expect(result.message).toContain('supports up to 50 items')
      })

      it('should accumulate multiple warnings', () => {
        const menu = createTestMenu({ 
          sections: 1, 
          itemsPerSection: 25, // Exceeds comfortable capacity
          imageRatio: 20 // Low image ratio
        })
        const template = createTestTemplate({
          constraints: {
            minSections: 1,
            maxSections: 5,
            minItems: 1,
            hardMaxItems: 50,
            requiresImages: true
          }
        })
        
        const result = checkCompatibility(menu, template)
        
        expect(result.status).toBe('WARNING')
        expect(result.warnings.length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  describe('calculateTemplateCapacity', () => {
    it('should calculate capacity for template with no repeat pattern', () => {
      const template = createTestTemplate({
        layout: {
          baseCols: 3,
          baseRows: 5,
          tiles: [
            { id: 'item-1', type: 'ITEM', col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'item-2', type: 'ITEM', col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'item-3', type: 'ITEM_TEXT_ONLY', col: 2, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'title-1', type: 'TITLE', col: 0, row: 1, colSpan: 3, rowSpan: 1 }
          ]
          // No repeat pattern
        }
      })
      
      const capacity = calculateTemplateCapacity(template)
      
      expect(capacity.comfortable).toBe(3) // 3 item tiles
      expect(capacity.maximum).toBe(3)
    })

    it('should calculate capacity for template with repeat pattern', () => {
      const template = createTestTemplate({
        layout: {
          baseCols: 3,
          baseRows: 10,
          tiles: [
            { id: 'item-1', type: 'ITEM', col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'item-2', type: 'ITEM', col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'item-3', type: 'ITEM', col: 2, row: 0, colSpan: 1, rowSpan: 1 }
          ],
          repeatPattern: {
            fromRow: 1,
            rowsPerRepeat: 1,
            repeatItemTileIds: ['item-1', 'item-2', 'item-3'],
            maxRepeats: 10
          }
        }
      })
      
      const capacity = calculateTemplateCapacity(template)
      
      // Base: 3 items
      // Repeat: 3 items * 10 repeats = 30 items
      // Comfortable: 3 + floor(30 * 0.6) = 3 + 18 = 21
      // Maximum: 3 + 30 = 33
      expect(capacity.comfortable).toBe(21)
      expect(capacity.maximum).toBe(33)
    })

    it('should only count ITEM and ITEM_TEXT_ONLY tiles', () => {
      const template = createTestTemplate({
        layout: {
          baseCols: 3,
          baseRows: 5,
          tiles: [
            { id: 'item-1', type: 'ITEM', col: 0, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'item-2', type: 'ITEM_TEXT_ONLY', col: 1, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'title-1', type: 'TITLE', col: 2, row: 0, colSpan: 1, rowSpan: 1 },
            { id: 'logo-1', type: 'LOGO', col: 0, row: 1, colSpan: 1, rowSpan: 1 },
            { id: 'spacer-1', type: 'SPACER', col: 1, row: 1, colSpan: 1, rowSpan: 1 }
          ]
        }
      })
      
      const capacity = calculateTemplateCapacity(template)
      
      expect(capacity.comfortable).toBe(2) // Only ITEM and ITEM_TEXT_ONLY
      expect(capacity.maximum).toBe(2)
    })
  })
})
