/**
 * Filler Tile Insertion Unit Tests
 * 
 * Tests for the filler tile insertion functionality including:
 * - Only inserting fillers when autoFillerTiles is true
 * - Deterministic color selection
 * - Never overriding existing tiles
 * - Same menu + template produces same fillers
 */

import {
  insertFillerTilesIntoLayout,
  countFillerTilesInLayout,
  validateFillerTilesInLayout
} from '../filler-tiles'
import type {
  LayoutInstance,
  MenuTemplate,
  PageLayout,
  MenuItemTileInstance,
  SpacerTileInstance
} from '../engine-types'

/**
 * Helper function to create a minimal template
 */
function createTestTemplate(options: {
  autoFillerTiles: boolean
  baseCols?: number
  baseRows?: number
}): MenuTemplate {
  return {
    id: 'test-template',
    name: 'Test Template',
    description: 'Test template for filler tiles',
    thumbnailUrl: '/test.jpg',
    aspectRatio: 'A4_PORTRAIT',
    orientation: 'A4_PORTRAIT',
    layout: {
      baseCols: options.baseCols || 3,
      baseRows: options.baseRows || 10,
      tiles: []
    },
    constraints: {
      minSections: 1,
      maxSections: 'unbounded',
      minItems: 1,
      hardMaxItems: 150
    },
    capabilities: {
      supportsImages: true,
      supportsLogoPlaceholder: false,
      supportsColourPalettes: false,
      supportsTextOnlyMode: true,
      supportsResponsiveWeb: true,
      autoFillerTiles: options.autoFillerTiles
    },
    configurationSchema: {},
    version: '1.0.0'
  }
}

/**
 * Helper function to create a test layout with specific tiles
 */
function createTestLayout(tiles: Array<{
  col: number
  row: number
  colSpan?: number
  rowSpan?: number
}>): LayoutInstance {
  const pageTiles: MenuItemTileInstance[] = tiles.map((tile, index) => ({
    id: `item-${index}`,
    type: 'ITEM',
    col: tile.col,
    row: tile.row,
    colSpan: tile.colSpan || 1,
    rowSpan: tile.rowSpan || 1,
    itemId: `item-${index}`,
    name: `Item ${index}`,
    price: 10,
    showImage: true
  }))

  return {
    templateId: 'test-template',
    templateVersion: '1.0.0',
    orientation: 'A4_PORTRAIT',
    pages: [{
      pageIndex: 0,
      tiles: pageTiles
    }]
  }
}

describe('Filler Tile Insertion', () => {
  describe('insertFillerTilesIntoLayout', () => {
    it('should only insert fillers when autoFillerTiles is true', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 },
        { col: 1, row: 0 }
        // col 2, row 0 is empty
      ])
      
      const templateWithoutFillers = createTestTemplate({ autoFillerTiles: false })
      const resultWithout = insertFillerTilesIntoLayout(layout, templateWithoutFillers)
      
      expect(countFillerTilesInLayout(resultWithout)).toBe(0)
      expect(resultWithout.pages[0].tiles.length).toBe(2) // Only original tiles
      
      const templateWithFillers = createTestTemplate({ autoFillerTiles: true })
      const resultWith = insertFillerTilesIntoLayout(layout, templateWithFillers)
      
      expect(countFillerTilesInLayout(resultWith)).toBeGreaterThan(0)
      expect(resultWith.pages[0].tiles.length).toBeGreaterThan(2) // Original + fillers
    })

    it('should insert fillers in empty cells', () => {
      // Create a 3x3 grid with items in first row only
      const layout = createTestLayout([
        { col: 0, row: 0 },
        { col: 1, row: 0 }
        // col 2, row 0 is empty
        // All of rows 1 and 2 are empty
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 3
      })
      
      const result = insertFillerTilesIntoLayout(layout, template)
      
      // Should have 2 original items + 7 fillers (1 in row 0, 3 in row 1, 3 in row 2)
      expect(result.pages[0].tiles.length).toBe(9)
      expect(countFillerTilesInLayout(result)).toBe(7)
      
      // Check that fillers are SPACER type
      const spacers = result.pages[0].tiles.filter(t => t.type === 'SPACER')
      expect(spacers.length).toBe(7)
    })

    it('should use deterministic color selection', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 }
        // Rest of grid is empty
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 2
      })
      
      // Generate layout twice
      const result1 = insertFillerTilesIntoLayout(layout, template)
      const result2 = insertFillerTilesIntoLayout(layout, template)
      
      // Extract spacer tiles
      const spacers1 = result1.pages[0].tiles.filter(t => t.type === 'SPACER') as SpacerTileInstance[]
      const spacers2 = result2.pages[0].tiles.filter(t => t.type === 'SPACER') as SpacerTileInstance[]
      
      // Should have same number of spacers
      expect(spacers1.length).toBe(spacers2.length)
      
      // Colors should be identical for same positions
      for (let i = 0; i < spacers1.length; i++) {
        expect(spacers1[i].backgroundColor).toBe(spacers2[i].backgroundColor)
        expect(spacers1[i].col).toBe(spacers2[i].col)
        expect(spacers1[i].row).toBe(spacers2[i].row)
      }
    })

    it('should never override existing tiles', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 0, row: 1 },
        { col: 1, row: 1 }
        // col 2, row 1 is empty
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 2
      })
      
      const result = insertFillerTilesIntoLayout(layout, template)
      
      // Validate that no fillers overlap with content
      const errors = validateFillerTilesInLayout(result)
      expect(errors).toEqual([])
      
      // Check that all original tiles are still present
      const itemTiles = result.pages[0].tiles.filter(t => t.type === 'ITEM')
      expect(itemTiles.length).toBe(5)
      
      // Check that only 1 filler was added (at col 2, row 1)
      const spacers = result.pages[0].tiles.filter(t => t.type === 'SPACER')
      expect(spacers.length).toBe(1)
      expect(spacers[0].col).toBe(2)
      expect(spacers[0].row).toBe(1)
    })

    it('should produce same fillers for same menu and template', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 },
        { col: 1, row: 0 }
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 3
      })
      
      // Generate layout multiple times
      const result1 = insertFillerTilesIntoLayout(layout, template)
      const result2 = insertFillerTilesIntoLayout(layout, template)
      const result3 = insertFillerTilesIntoLayout(layout, template)
      
      // Extract spacer tiles
      const spacers1 = result1.pages[0].tiles.filter(t => t.type === 'SPACER')
      const spacers2 = result2.pages[0].tiles.filter(t => t.type === 'SPACER')
      const spacers3 = result3.pages[0].tiles.filter(t => t.type === 'SPACER')
      
      // All should be identical
      expect(spacers1).toEqual(spacers2)
      expect(spacers2).toEqual(spacers3)
    })

    it('should handle tiles with colSpan and rowSpan', () => {
      const layout = createTestLayout([
        { col: 0, row: 0, colSpan: 2, rowSpan: 1 }, // Takes up cols 0-1
        // col 2, row 0 is empty
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 2
      })
      
      const result = insertFillerTilesIntoLayout(layout, template)
      
      // Should fill col 2 row 0, and all of row 1
      const spacers = result.pages[0].tiles.filter(t => t.type === 'SPACER')
      expect(spacers.length).toBe(4) // 1 in row 0, 3 in row 1
      
      // Validate no overlaps
      const errors = validateFillerTilesInLayout(result)
      expect(errors).toEqual([])
    })

    it('should handle multiple pages', () => {
      const layout: LayoutInstance = {
        templateId: 'test-template',
        templateVersion: '1.0.0',
        orientation: 'A4_PORTRAIT',
        pages: [
          {
            pageIndex: 0,
            tiles: [
              {
                id: 'item-0',
                type: 'ITEM',
                col: 0,
                row: 0,
                colSpan: 1,
                rowSpan: 1,
                itemId: 'item-0',
                name: 'Item 0',
                price: 10,
                showImage: true
              }
            ]
          },
          {
            pageIndex: 1,
            tiles: [
              {
                id: 'item-1',
                type: 'ITEM',
                col: 0,
                row: 0,
                colSpan: 1,
                rowSpan: 1,
                itemId: 'item-1',
                name: 'Item 1',
                price: 10,
                showImage: true
              }
            ]
          }
        ]
      }
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 2,
        baseRows: 2
      })
      
      const result = insertFillerTilesIntoLayout(layout, template)
      
      // Both pages should have fillers
      expect(result.pages.length).toBe(2)
      
      const page0Spacers = result.pages[0].tiles.filter(t => t.type === 'SPACER')
      const page1Spacers = result.pages[1].tiles.filter(t => t.type === 'SPACER')
      
      expect(page0Spacers.length).toBeGreaterThan(0)
      expect(page1Spacers.length).toBeGreaterThan(0)
    })

    it('should not insert fillers when grid is completely full', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 0, row: 1 },
        { col: 1, row: 1 },
        { col: 2, row: 1 }
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 2
      })
      
      const result = insertFillerTilesIntoLayout(layout, template)
      
      // No fillers should be added
      expect(countFillerTilesInLayout(result)).toBe(0)
      expect(result.pages[0].tiles.length).toBe(6) // Only original tiles
    })
  })

  describe('countFillerTilesInLayout', () => {
    it('should count spacer tiles correctly', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 }
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 2
      })
      
      const result = insertFillerTilesIntoLayout(layout, template)
      const count = countFillerTilesInLayout(result)
      
      // Should have 5 fillers (6 total cells - 1 item)
      expect(count).toBe(5)
    })

    it('should return 0 when no fillers present', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 }
      ])
      
      expect(countFillerTilesInLayout(layout)).toBe(0)
    })
  })

  describe('validateFillerTilesInLayout', () => {
    it('should return no errors for valid layout', () => {
      const layout = createTestLayout([
        { col: 0, row: 0 }
      ])
      
      const template = createTestTemplate({ 
        autoFillerTiles: true,
        baseCols: 3,
        baseRows: 2
      })
      
      const result = insertFillerTilesIntoLayout(layout, template)
      const errors = validateFillerTilesInLayout(result)
      
      expect(errors).toEqual([])
    })

    it('should detect overlapping tiles', () => {
      // Manually create an invalid layout with overlapping tiles
      const invalidLayout: LayoutInstance = {
        templateId: 'test-template',
        templateVersion: '1.0.0',
        orientation: 'A4_PORTRAIT',
        pages: [{
          pageIndex: 0,
          tiles: [
            {
              id: 'item-0',
              type: 'ITEM',
              col: 0,
              row: 0,
              colSpan: 1,
              rowSpan: 1,
              itemId: 'item-0',
              name: 'Item 0',
              price: 10,
              showImage: true
            },
            {
              id: 'spacer-0-0',
              type: 'SPACER',
              col: 0,
              row: 0,
              colSpan: 1,
              rowSpan: 1,
              backgroundColor: '#F3F4F6'
            }
          ]
        }]
      }
      
      const errors = validateFillerTilesInLayout(invalidLayout)
      
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('overlaps')
    })
  })
})
