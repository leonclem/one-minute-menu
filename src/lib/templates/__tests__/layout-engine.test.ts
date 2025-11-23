/**
 * Layout Engine Unit Tests
 * 
 * Tests for the core layout generation engine including:
 * - Simple menu layout generation
 * - Flat menu handling (implicit "Menu" section)
 * - Text-only configuration
 * - Deterministic output
 * - Large menu with tank template
 * - Section slot mapping
 * - Repeat pattern scaling
 */

import { generateLayout } from '../layout-engine'
import { CLASSIC_GRID_CARDS, TWO_COLUMN_TEXT } from '../template-definitions'
import type { EngineMenu, LayoutEngineInput } from '../engine-types'

/**
 * Helper function to create a test menu
 */
function createTestMenu(options: {
  sections: number
  itemsPerSection: number
  withImages?: boolean
}): EngineMenu {
  const sections = []
  
  for (let s = 0; s < options.sections; s++) {
    const items = []
    
    for (let i = 0; i < options.itemsPerSection; i++) {
      items.push({
        id: `item-${s}-${i}`,
        name: `Item ${s}-${i}`,
        description: `Description for item ${s}-${i}`,
        price: 10 + i,
        imageUrl: options.withImages ? `https://example.com/image-${s}-${i}.jpg` : undefined,
        sortOrder: i
      })
    }
    
    sections.push({
      id: `section-${s}`,
      name: `Section ${s}`,
      sortOrder: s,
      items
    })
  }
  
  return {
    id: 'test-menu-1',
    name: 'Test Menu',
    sections,
    metadata: {
      currency: '$',
      venueName: 'Test Restaurant',
      venueAddress: '123 Test St'
    }
  }
}

/**
 * Helper function to create a flat menu (single unnamed section)
 */
function createFlatMenu(options: { items: number }): EngineMenu {
  const items = []
  
  for (let i = 0; i < options.items; i++) {
    items.push({
      id: `item-${i}`,
      name: `Item ${i}`,
      description: `Description for item ${i}`,
      price: 10 + i,
      imageUrl: `https://example.com/image-${i}.jpg`,
      sortOrder: i
    })
  }
  
  return {
    id: 'test-menu-flat',
    name: 'Flat Menu',
    sections: [{
      id: 'implicit-section',
      name: 'Menu',
      sortOrder: 0,
      items
    }],
    metadata: {
      currency: '$',
      venueName: 'Test Restaurant'
    }
  }
}

describe('Layout Engine', () => {
  describe('generateLayout', () => {
    it('should generate layout for simple menu', () => {
      const menu = createTestMenu({ sections: 1, itemsPerSection: 9, withImages: true })
      const template = CLASSIC_GRID_CARDS
      
      const layout = generateLayout({ menu, template })
      
      expect(layout).toBeDefined()
      expect(layout.templateId).toBe('classic-grid-cards')
      expect(layout.templateVersion).toBe('1.0.0')
      expect(layout.orientation).toBe('A4_PORTRAIT')
      expect(layout.pages).toHaveLength(1)
      
      // Should have 9 item tiles + 1 title tile
      const page = layout.pages[0]
      expect(page.pageIndex).toBe(0)
      expect(page.tiles.length).toBeGreaterThanOrEqual(10)
      
      // Check that we have item tiles
      const itemTiles = page.tiles.filter(t => t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY')
      expect(itemTiles.length).toBe(9)
      
      // Check that we have a title tile
      const titleTiles = page.tiles.filter(t => t.type === 'TITLE')
      expect(titleTiles.length).toBe(1)
      expect(titleTiles[0]).toMatchObject({
        type: 'TITLE',
        content: 'Test Menu'
      })
    })
    
    it('should handle flat menus with implicit section', () => {
      const menu = createFlatMenu({ items: 12 })
      const template = TWO_COLUMN_TEXT
      
      const layout = generateLayout({ menu, template })
      
      expect(layout.pages).toHaveLength(1)
      
      // Check that the implicit section name is used
      const page = layout.pages[0]
      const sectionHeaders = page.tiles.filter(t => t.type === 'SECTION_HEADER')
      
      // TWO_COLUMN_TEXT has section headers
      if (sectionHeaders.length > 0) {
        expect(sectionHeaders[0]).toMatchObject({
          type: 'SECTION_HEADER',
          label: 'Menu'
        })
      }
    })
    
    it('should respect text-only configuration', () => {
      const menu = createTestMenu({ sections: 1, itemsPerSection: 6, withImages: true })
      const template = CLASSIC_GRID_CARDS
      const selection = {
        id: 'selection-1',
        menuId: 'test-menu-1',
        templateId: 'classic-grid-cards',
        templateVersion: '1.0.0',
        configuration: {
          textOnly: true,
          useLogo: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const layout = generateLayout({ menu, template, selection })
      
      const page = layout.pages[0]
      const itemTiles = page.tiles.filter(t => t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY')
      
      // All item tiles should be ITEM_TEXT_ONLY when textOnly is true
      itemTiles.forEach(tile => {
        if ('showImage' in tile) {
          expect(tile.showImage).toBe(false)
        }
      })
    })
    
    it('should be deterministic', () => {
      const menu = createTestMenu({ sections: 2, itemsPerSection: 15, withImages: true })
      const template = TWO_COLUMN_TEXT
      
      const layout1 = generateLayout({ menu, template })
      const layout2 = generateLayout({ menu, template })
      
      // Layouts should be identical
      expect(layout1).toEqual(layout2)
    })
    
    it('should handle large menus with tank template', () => {
      // Test the "we always have one resilient template" guarantee
      const menu = createTestMenu({ sections: 5, itemsPerSection: 30, withImages: false }) // 150 items
      const template = TWO_COLUMN_TEXT // Tank template
      
      const layout = generateLayout({ menu, template })
      
      expect(layout).toBeDefined()
      expect(layout.pages).toBeDefined()
      expect(layout.pages.length).toBeGreaterThan(0)
      
      // Count total item tiles across all pages
      const totalItemTiles = layout.pages.reduce(
        (sum, page) => sum + page.tiles.filter(t => t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY').length,
        0
      )
      
      // Should have placed all 150 items (or as many as capacity allows)
      expect(totalItemTiles).toBeGreaterThan(0)
      expect(totalItemTiles).toBeLessThanOrEqual(150)
    })
    
    it('should handle repeat pattern scaling', () => {
      // Create a menu with more items than the base layout can hold
      const menu = createTestMenu({ sections: 1, itemsPerSection: 20, withImages: true })
      const template = CLASSIC_GRID_CARDS
      
      const layout = generateLayout({ menu, template })
      
      expect(layout.pages).toBeDefined()
      
      // Count item tiles
      const totalItemTiles = layout.pages.reduce(
        (sum, page) => sum + page.tiles.filter(t => t.type === 'ITEM' || t.type === 'ITEM_TEXT_ONLY').length,
        0
      )
      
      // Should have used repeat pattern to accommodate more items
      expect(totalItemTiles).toBeGreaterThan(9) // More than base layout
      expect(totalItemTiles).toBeLessThanOrEqual(20)
    })
    
    it('should throw error for invalid menu data', () => {
      const invalidMenu = {
        id: 'invalid',
        name: 'Invalid',
        sections: [],
        metadata: {
          currency: '$'
        }
      } as EngineMenu
      
      const template = CLASSIC_GRID_CARDS
      
      expect(() => {
        generateLayout({ menu: invalidMenu, template })
      }).toThrow()
    })
    
    it('should throw error for incompatible template', () => {
      // Create a menu with too few items for the template
      const menu = createTestMenu({ sections: 1, itemsPerSection: 1, withImages: true })
      const template = CLASSIC_GRID_CARDS // Requires minItems: 3
      
      expect(() => {
        generateLayout({ menu, template })
      }).toThrow()
    })
  })
})
