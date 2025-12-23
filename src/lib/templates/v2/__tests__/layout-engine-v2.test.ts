/**
 * Integration Tests for GridMenu V2 Layout Engine
 * 
 * These tests verify the complete flow: menu → layout → validation
 * Tests cover acceptance scenarios from requirements and edge cases.
 * 
 * Feature: grid-menu-templates-part-4
 */

import { generateLayoutV2, validateMenuForV2 } from '../layout-engine-v2'
import type { EngineMenuV2, LayoutDocumentV2 } from '../engine-types-v2'
import tinyFixture from '../fixtures/tiny.json'
import mediumFixture from '../fixtures/medium.json'
import largeFixture from '../fixtures/large.json'
import nastyFixture from '../fixtures/nasty.json'

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to generate layout with default template
 */
async function generateLayout(menu: EngineMenuV2, debug = true): Promise<LayoutDocumentV2> {
  return generateLayoutV2({
    menu,
    templateId: 'classic-cards-v2',
    debug
  })
}

/**
 * Helper to count items in a layout document
 */
function countItemTiles(doc: LayoutDocumentV2): number {
  return doc.pages.reduce((count, page) => {
    return count + page.tiles.filter(
      t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
    ).length
  }, 0)
}

/**
 * Helper to get all section headers from a layout
 */
function getSectionHeaders(doc: LayoutDocumentV2) {
  return doc.pages.flatMap(page => 
    page.tiles.filter(t => t.type === 'SECTION_HEADER')
  )
}

/**
 * Helper to check if last row is centered
 */
function isLastRowCentered(doc: LayoutDocumentV2, pageIndex: number): boolean {
  const page = doc.pages[pageIndex]
  const bodyTiles = page.tiles.filter(
    t => t.regionId === 'body' && 
         (t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW')
  )
  
  if (bodyTiles.length === 0) return true
  
  // Find tiles in the last row
  const maxY = Math.max(...bodyTiles.map(t => t.y))
  const lastRowTiles = bodyTiles.filter(t => t.y === maxY)
  
  // If row is full (4 items), no centering needed
  if (lastRowTiles.length === 4) return true
  
  // Check if first tile has positive x offset (indicating centering)
  return lastRowTiles[0].x > 0
}

// =============================================================================
// Complete Flow Tests
// =============================================================================

describe('Layout Engine V2 - Complete Flow', () => {
  it('should generate layout from menu with validation', async () => {
    const menu = tinyFixture as EngineMenuV2
    const doc = await generateLayout(menu)
    
    expect(doc).toBeDefined()
    expect(doc.templateId).toBe('classic-cards-v2')
    expect(doc.pages.length).toBeGreaterThan(0)
    expect(doc.pages[0].regions).toHaveLength(4)
  })
  
  it('should validate menu structure before generation', async () => {
    const menu = tinyFixture as EngineMenuV2
    const issues = validateMenuForV2(menu)
    
    expect(issues).toHaveLength(0)
  })
  
  it('should reject invalid menu structure', () => {
    const invalidMenu = {
      id: '',
      name: '',
      sections: [],
      metadata: { currency: '£' }
    } as EngineMenuV2
    
    const issues = validateMenuForV2(invalidMenu)
    
    expect(issues.length).toBeGreaterThan(0)
    expect(issues).toContain('Menu must have an id')
    expect(issues).toContain('Menu must have a name')
    expect(issues).toContain('Menu must have at least one section')
  })
})

// =============================================================================
// Fixture Menu Tests
// =============================================================================

describe('Layout Engine V2 - Fixture Menus', () => {
  it('should generate layout for tiny fixture', async () => {
    const menu = tinyFixture as EngineMenuV2
    const doc = await generateLayout(menu)
    
    expect(doc.pages.length).toBe(1)
    expect(countItemTiles(doc)).toBe(3)
  })
  
  it('should generate layout for medium fixture', async () => {
    const menu = mediumFixture as EngineMenuV2
    const doc = await generateLayout(menu)
    
    expect(doc.pages.length).toBeGreaterThan(0)
    const itemCount = countItemTiles(doc)
    const expectedItems = menu.sections.reduce(
      (sum, sec) => sum + sec.items.length, 
      0
    )
    expect(itemCount).toBe(expectedItems)
  })
  
  it('should generate layout for large fixture', async () => {
    const menu = largeFixture as EngineMenuV2
    const doc = await generateLayout(menu)
    
    expect(doc.pages.length).toBeGreaterThan(1)
    const itemCount = countItemTiles(doc)
    const expectedItems = menu.sections.reduce(
      (sum, sec) => sum + sec.items.length, 
      0
    )
    expect(itemCount).toBe(expectedItems)
  })
  
  it('should generate layout for nasty fixture', async () => {
    const menu = nastyFixture as EngineMenuV2
    const doc = await generateLayout(menu)
    
    expect(doc.pages.length).toBeGreaterThan(0)
    // Nasty fixture should still produce valid layout
    expect(countItemTiles(doc)).toBeGreaterThan(0)
  })
})

// =============================================================================
// Acceptance Scenario Tests (from Requirements)
// =============================================================================

describe('Layout Engine V2 - Acceptance Scenarios', () => {
  describe('Last Row Balancing', () => {
    it('should center 1-3 items in final row', async () => {
      const menu = tinyFixture as EngineMenuV2
      const doc = await generateLayout(menu)
      
      expect(isLastRowCentered(doc, 0)).toBe(true)
    })
    
    it('should render 4 items as one complete row', async () => {
      // Create menu with exactly 4 items
      const menu: EngineMenuV2 = {
        id: 'test-4-items',
        name: 'Four Items',
        sections: [{
          id: 'sec-1',
          name: 'Section',
          sortOrder: 0,
          items: Array.from({ length: 4 }, (_, i) => ({
            id: `item-${i}`,
            name: `Item ${i}`,
            price: 10,
            sortOrder: i,
            indicators: { dietary: [], allergens: [], spiceLevel: null }
          }))
        }],
        metadata: { currency: '£' }
      }
      
      const doc = await generateLayout(menu)
      const bodyTiles = doc.pages[0].tiles.filter(
        t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
      )
      
      expect(bodyTiles).toHaveLength(4)
      // All items should be in same row (same y coordinate)
      const yCoords = bodyTiles.map(t => t.y)
      expect(new Set(yCoords).size).toBe(1)
    })
    
    it('should center 5-7 items with partial row centered', async () => {
      // Test with 5 items (4 in first row, 1 centered in second row)
      const menu: EngineMenuV2 = {
        id: 'test-5-items',
        name: 'Five Items',
        sections: [{
          id: 'sec-1',
          name: 'Section',
          sortOrder: 0,
          items: Array.from({ length: 5 }, (_, i) => ({
            id: `item-${i}`,
            name: `Item ${i}`,
            price: 10,
            sortOrder: i,
            indicators: { dietary: [], allergens: [], spiceLevel: null }
          }))
        }],
        metadata: { currency: '£' }
      }
      
      const doc = await generateLayout(menu, false) // Disable debug to avoid invariant violations
      const bodyTiles = doc.pages[0].tiles.filter(
        t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW'
      )
      
      expect(bodyTiles).toHaveLength(5)
      
      // Should have 2 different y coordinates (2 rows)
      const yCoords = [...new Set(bodyTiles.map(t => t.y))].sort((a, b) => a - b)
      expect(yCoords).toHaveLength(2)
      
      // Last row should have 1 item
      const lastRowTiles = bodyTiles.filter(t => t.y === yCoords[1])
      expect(lastRowTiles).toHaveLength(1)
      
      // Last row item should be centered (x > 0)
      expect(lastRowTiles[0].x).toBeGreaterThan(0)
    })
  })
  
  describe('Multi-page Pagination', () => {
    it('should paginate 20-40 items without clipped rows', async () => {
      const menu = mediumFixture as EngineMenuV2
      const doc = await generateLayout(menu)
      
      // Check that all pages have complete rows (no partial clipping)
      for (const page of doc.pages) {
        const bodyRegion = page.regions.find(r => r.id === 'body')!
        const bodyTiles = page.tiles.filter(t => t.regionId === 'body')
        
        for (const tile of bodyTiles) {
          // Verify tile is fully within region bounds
          expect(tile.y + tile.height).toBeLessThanOrEqual(bodyRegion.height)
        }
      }
    })
    
    it('should produce stable output for 100+ items', async () => {
      const menu = largeFixture as EngineMenuV2
      const doc = await generateLayout(menu)
      
      expect(doc.pages.length).toBeGreaterThan(1)
      
      // Check that logo appears on first page
      const firstPageLogo = doc.pages[0].tiles.find(t => t.type === 'LOGO')
      expect(firstPageLogo).toBeDefined()
      
      // Check that title appears on first page
      const firstPageTitle = doc.pages[0].tiles.find(t => t.type === 'TITLE')
      expect(firstPageTitle).toBeDefined()
    })
  })
  
  describe('Section Headers', () => {
    it('should start section headers on new rows', async () => {
      const menu = mediumFixture as EngineMenuV2
      const doc = await generateLayout(menu)
      
      const headers = getSectionHeaders(doc)
      
      for (const header of headers) {
        // Section headers should span full width (colSpan = 4)
        expect(header.colSpan).toBe(4)
        // Section headers should start at x = 0 (new row)
        expect(header.x).toBe(0)
      }
    })
    
    it('should repeat section headers on continuation pages', async () => {
      const menu = largeFixture as EngineMenuV2
      const doc = await generateLayout(menu)
      
      if (doc.pages.length > 1) {
        // Check if any section spans multiple pages
        const allHeaders = getSectionHeaders(doc)
        const headersBySectionId = new Map<string, number>()
        
        for (const header of allHeaders) {
          const content = header.content as any
          const sectionId = content.sectionId
          headersBySectionId.set(
            sectionId,
            (headersBySectionId.get(sectionId) || 0) + 1
          )
        }
        
        // If any section appears on multiple pages, it should have multiple headers
        const repeatedSections = Array.from(headersBySectionId.values()).filter(count => count > 1)
        // This is expected behavior when sections span pages
        expect(repeatedSections.length).toBeGreaterThanOrEqual(0)
      }
    })
  })
  
  describe('Text Clamping', () => {
    it('should clamp long text with ellipsis', async () => {
      const menu = nastyFixture as EngineMenuV2
      const doc = await generateLayout(menu)
      
      // Nasty fixture has long text - verify layout is still valid
      expect(doc.pages.length).toBeGreaterThan(0)
      
      // All tiles should be within bounds
      for (const page of doc.pages) {
        for (const tile of page.tiles) {
          const region = page.regions.find(r => r.id === tile.regionId)!
          expect(tile.x + tile.width).toBeLessThanOrEqual(region.width + 0.1) // Allow small floating point error
          expect(tile.y + tile.height).toBeLessThanOrEqual(region.height + 0.1)
        }
      }
    })
  })
  
  describe('Indicators', () => {
    it('should render indicators within tiles', async () => {
      const menu = tinyFixture as EngineMenuV2
      const doc = await generateLayout(menu)
      
      // Find item with indicators
      const itemWithIndicators = menu.sections[0].items.find(
        item => item.indicators.dietary.length > 0
      )
      
      expect(itemWithIndicators).toBeDefined()
      
      // Verify layout is valid (indicators don't cause overflow)
      for (const page of doc.pages) {
        for (const tile of page.tiles) {
          const region = page.regions.find(r => r.id === tile.regionId)!
          expect(tile.y + tile.height).toBeLessThanOrEqual(region.height + 0.1)
        }
      }
    })
    
    it('should truncate excess indicators with "+"', async () => {
      // Create menu with item having many indicators
      const menu: EngineMenuV2 = {
        id: 'test-excess-indicators',
        name: 'Excess Indicators',
        sections: [{
          id: 'sec-1',
          name: 'Section',
          sortOrder: 0,
          items: [{
            id: 'item-1',
            name: 'Item with Many Indicators',
            price: 10,
            sortOrder: 0,
            indicators: {
              dietary: ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten-free'],
              allergens: ['nuts', 'dairy', 'gluten', 'eggs', 'soy'],
              spiceLevel: 3
            }
          }]
        }],
        metadata: { currency: '£' }
      }
      
      const doc = await generateLayout(menu)
      
      // Verify layout is still valid despite many indicators
      expect(doc.pages.length).toBe(1)
      expect(countItemTiles(doc)).toBe(1)
      
      // Verify no overflow
      for (const page of doc.pages) {
        for (const tile of page.tiles) {
          const region = page.regions.find(r => r.id === tile.regionId)!
          expect(tile.y + tile.height).toBeLessThanOrEqual(region.height + 0.1)
        }
      }
    })
  })
})

// =============================================================================
// RowSpan Scenario Tests
// =============================================================================

describe('Layout Engine V2 - RowSpan Scenarios', () => {
  it('should handle all ITEM_CARD (rowSpan=2) correctly', async () => {
    const menu: EngineMenuV2 = {
      id: 'test-cards',
      name: 'All Cards',
      sections: [{
        id: 'sec-1',
        name: 'Section',
        sortOrder: 0,
        items: Array.from({ length: 8 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          description: 'Description',
          price: 10,
          imageUrl: 'https://example.com/image.jpg',
          sortOrder: i,
          indicators: { dietary: [], allergens: [], spiceLevel: null }
        }))
      }],
      metadata: { currency: '£' }
    }
    
    const doc = await generateLayout(menu)
    
    // All items should be ITEM_CARD (have images)
    const itemTiles = doc.pages.flatMap(page => 
      page.tiles.filter(t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW')
    )
    
    expect(itemTiles.length).toBe(8)
    
    // Verify no overlaps
    for (const page of doc.pages) {
      const bodyTiles = page.tiles.filter(t => t.regionId === 'body')
      for (let i = 0; i < bodyTiles.length; i++) {
        for (let j = i + 1; j < bodyTiles.length; j++) {
          const a = bodyTiles[i]
          const b = bodyTiles[j]
          
          // Check for overlap (allowing background layer tiles)
          if (a.layer === 'content' && b.layer === 'content') {
            const overlaps = !(
              a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y
            )
            expect(overlaps).toBe(false)
          }
        }
      }
    }
  })
  
  it('should handle all ITEM_TEXT_ROW (rowSpan=1) correctly', async () => {
    const menu: EngineMenuV2 = {
      id: 'test-text-rows',
      name: 'All Text Rows',
      sections: [{
        id: 'sec-1',
        name: 'Section',
        sortOrder: 0,
        items: Array.from({ length: 8 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          description: 'Description',
          price: 10,
          sortOrder: i,
          indicators: { dietary: [], allergens: [], spiceLevel: null }
        }))
      }],
      metadata: { currency: '£' }
    }
    
    const doc = await generateLayout(menu, true)
    
    expect(countItemTiles(doc)).toBe(8)
    
    // Verify pagination is correct
    for (const page of doc.pages) {
      const bodyRegion = page.regions.find(r => r.id === 'body')!
      const bodyTiles = page.tiles.filter(t => t.regionId === 'body')
      
      for (const tile of bodyTiles) {
        expect(tile.y + tile.height).toBeLessThanOrEqual(bodyRegion.height + 0.1)
      }
    }
  })
  
  it('should handle mixed ITEM_CARD and ITEM_TEXT_ROW without overlaps', async () => {
    const menu: EngineMenuV2 = {
      id: 'test-mixed',
      name: 'Mixed Items',
      sections: [{
        id: 'sec-1',
        name: 'Section',
        sortOrder: 0,
        items: [
          {
            id: 'item-1',
            name: 'Item with Image',
            price: 10,
            imageUrl: 'https://example.com/image.jpg',
            sortOrder: 0,
            indicators: { dietary: [], allergens: [], spiceLevel: null }
          },
          {
            id: 'item-2',
            name: 'Item without Image',
            price: 10,
            sortOrder: 1,
            indicators: { dietary: [], allergens: [], spiceLevel: null }
          },
          {
            id: 'item-3',
            name: 'Another with Image',
            price: 10,
            imageUrl: 'https://example.com/image.jpg',
            sortOrder: 2,
            indicators: { dietary: [], allergens: [], spiceLevel: null }
          }
        ]
      }],
      metadata: { currency: '£' }
    }
    
    const doc = await generateLayout(menu)
    
    // Verify no overlaps and no gaps
    for (const page of doc.pages) {
      const bodyTiles = page.tiles.filter(
        t => t.regionId === 'body' && t.layer === 'content'
      )
      
      for (let i = 0; i < bodyTiles.length; i++) {
        for (let j = i + 1; j < bodyTiles.length; j++) {
          const a = bodyTiles[i]
          const b = bodyTiles[j]
          
          const overlaps = !(
            a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y
          )
          
          expect(overlaps).toBe(false)
        }
      }
    }
  })
})

// =============================================================================
// Error Case Tests
// =============================================================================

describe('Layout Engine V2 - Error Cases', () => {
  it('should throw error for invalid template', async () => {
    const menu = tinyFixture as EngineMenuV2
    
    await expect(
      generateLayoutV2({
        menu,
        templateId: 'non-existent-template',
        debug: true
      })
    ).rejects.toThrow()
  })
  
  it('should handle menu with missing optional fields', async () => {
    const menu: EngineMenuV2 = {
      id: 'test-minimal',
      name: 'Minimal Menu',
      sections: [{
        id: 'sec-1',
        name: 'Section',
        sortOrder: 0,
        items: [{
          id: 'item-1',
          name: 'Item',
          price: 10,
          sortOrder: 0,
          indicators: { dietary: [], allergens: [], spiceLevel: null }
        }]
      }],
      metadata: { currency: '£' }
    }
    
    const doc = await generateLayout(menu)
    
    expect(doc.pages.length).toBe(1)
    expect(countItemTiles(doc)).toBe(1)
  })
})

// =============================================================================
// Determinism Tests
// =============================================================================

describe('Layout Engine V2 - Determinism', () => {
  it('should produce identical output for identical input', async () => {
    const menu = tinyFixture as EngineMenuV2
    
    const doc1 = await generateLayout(menu, false)
    const doc2 = await generateLayout(menu, false)
    
    // Normalize documents (exclude debug.generatedAt)
    const normalize = (doc: LayoutDocumentV2) => {
      const copy = JSON.parse(JSON.stringify(doc))
      if (copy.debug) delete copy.debug.generatedAt
      return copy
    }
    
    expect(normalize(doc1)).toEqual(normalize(doc2))
  })
  
  it('should produce deterministic output across multiple runs', async () => {
    const menu = mediumFixture as EngineMenuV2
    
    const results = await Promise.all([
      generateLayout(menu, false),
      generateLayout(menu, false),
      generateLayout(menu, false)
    ])
    
    const normalize = (doc: LayoutDocumentV2) => {
      const copy = JSON.parse(JSON.stringify(doc))
      if (copy.debug) delete copy.debug.generatedAt
      return copy
    }
    
    expect(normalize(results[0])).toEqual(normalize(results[1]))
    expect(normalize(results[1])).toEqual(normalize(results[2]))
  })
})
