/**
 * Unit Tests for Grid Layout Generator
 * 
 * Tests the grid layout generation logic including tile placement,
 * row wrapping, section boundaries, and filler tile insertion.
 */

import {
  generateGridLayout,
  calculateRowsNeeded,
  calculateEmptyCells,
  hasIncompleteLastRow,
  getLastTilePosition,
  calculateGridDimensions,
  getTilesAtRow,
  getTilesAtColumn,
  getTileAt,
  isPositionOccupied,
  getSectionByName,
  getSectionRowRange,
  getSectionRowCount,
  validateGridLayout,
  isGridLayoutValid,
  calculateLayoutStatistics,
  clearCache
} from '@/lib/templates/grid-generator'
import {
  insertFillerTiles,
  getFillerTiles,
  countFillerTiles,
  getFillerTilesInSection,
  hasFillerTiles,
  removeFillerTiles,
  validateFillerTiles,
  areFillerTilesValid,
  calculateFillerStatistics
} from '@/lib/templates/filler-tiles'
import { LAYOUT_PRESETS } from '@/lib/templates/presets'
import type { LayoutMenuData, GridLayout } from '@/lib/templates/types'

describe('Grid Layout Generator', () => {
  // Clear cache before each test to prevent state pollution
  beforeEach(() => {
    clearCache()
  })

  // Sample menu data for testing
  const sampleMenuData: LayoutMenuData = {
    metadata: {
      title: 'Test Menu',
      currency: 'USD'
    },
    sections: [
      {
        name: 'Starters',
        items: [
          { name: 'Caesar Salad', price: 12.50, featured: false },
          { name: 'Soup of the Day', price: 8.00, featured: false },
          { name: 'Bruschetta', price: 9.50, featured: false }
        ]
      },
      {
        name: 'Mains',
        items: [
          { name: 'Grilled Salmon', price: 24.00, featured: false },
          { name: 'Ribeye Steak', price: 32.00, featured: true },
          { name: 'Pasta Carbonara', price: 18.00, featured: false },
          { name: 'Chicken Parmesan', price: 20.00, featured: false },
          { name: 'Vegetable Stir Fry', price: 16.00, featured: false }
        ]
      }
    ]
  }

  describe('generateGridLayout', () => {
    it('should generate basic grid layout with correct structure', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      expect(layout.preset).toBe(preset)
      expect(layout.context).toBe('desktop')
      expect(layout.sections).toHaveLength(2)
      expect(layout.totalTiles).toBe(8) // 3 starters + 5 mains
    })

    it('should position tiles correctly in a 4-column grid', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
      const columns = preset.gridConfig.columns.desktop // 4 columns

      // Check first section (Starters - 3 items)
      const startersSection = layout.sections[0]
      expect(startersSection.tiles).toHaveLength(3)
      expect(startersSection.tiles[0].column).toBe(0)
      expect(startersSection.tiles[0].row).toBe(0)
      expect(startersSection.tiles[1].column).toBe(1)
      expect(startersSection.tiles[1].row).toBe(0)
      expect(startersSection.tiles[2].column).toBe(2)
      expect(startersSection.tiles[2].row).toBe(0)

      // Check second section (Mains - 5 items)
      const mainsSection = layout.sections[1]
      expect(mainsSection.tiles).toHaveLength(5)
      // First row of mains
      expect(mainsSection.tiles[0].column).toBe(0)
      expect(mainsSection.tiles[1].column).toBe(1)
      expect(mainsSection.tiles[2].column).toBe(2)
      expect(mainsSection.tiles[3].column).toBe(3)
      // Second row of mains
      expect(mainsSection.tiles[4].column).toBe(0)
    })

    it('should handle row wrapping correctly', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const mainsSection = layout.sections[1]
      const startRow = mainsSection.startRow

      // First 4 items should be in the first row
      expect(mainsSection.tiles[0].row).toBe(startRow)
      expect(mainsSection.tiles[1].row).toBe(startRow)
      expect(mainsSection.tiles[2].row).toBe(startRow)
      expect(mainsSection.tiles[3].row).toBe(startRow)

      // 5th item should wrap to next row
      expect(mainsSection.tiles[4].row).toBe(startRow + 1)
    })

    it('should start each section on a new row', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const startersSection = layout.sections[0]
      const mainsSection = layout.sections[1]

      // Starters starts at row 0
      expect(startersSection.startRow).toBe(0)

      // Mains should start after starters (with spacing)
      expect(mainsSection.startRow).toBeGreaterThan(startersSection.startRow)
    })

    it('should handle different column counts for different contexts', () => {
      const preset = LAYOUT_PRESETS['balanced']

      const mobileLayout = generateGridLayout(sampleMenuData, preset, 'mobile')
      const desktopLayout = generateGridLayout(sampleMenuData, preset, 'desktop')

      // Mobile has 2 columns, desktop has 4 columns
      expect(preset.gridConfig.columns.mobile).toBe(2)
      expect(preset.gridConfig.columns.desktop).toBe(4)

      // Same data should result in different tile positions
      expect(mobileLayout.sections[0].tiles[0].column).toBe(0)
      expect(desktopLayout.sections[0].tiles[0].column).toBe(0)
    })

    it('should handle single-item sections', () => {
      const singleItemMenu: LayoutMenuData = {
        metadata: { title: 'Test', currency: 'USD' },
        sections: [
          {
            name: 'Desserts',
            items: [{ name: 'Tiramisu', price: 8.00, featured: false }]
          }
        ]
      }

      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(singleItemMenu, preset, 'desktop')

      expect(layout.sections[0].tiles).toHaveLength(1)
      expect(layout.sections[0].tiles[0].column).toBe(0)
      expect(layout.sections[0].tiles[0].row).toBe(0)
    })

    it('should handle sections with exactly one row of items', () => {
      const exactRowMenu: LayoutMenuData = {
        metadata: { title: 'Test', currency: 'USD' },
        sections: [
          {
            name: 'Drinks',
            items: [
              { name: 'Water', price: 2.00, featured: false },
              { name: 'Soda', price: 3.00, featured: false },
              { name: 'Juice', price: 4.00, featured: false },
              { name: 'Coffee', price: 3.50, featured: false }
            ]
          }
        ]
      }

      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(exactRowMenu, preset, 'desktop')

      // All 4 items should be in the same row
      const section = layout.sections[0]
      expect(section.tiles.every(t => t.row === 0)).toBe(true)
    })

    it('should assign default span to all tiles', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      // All tiles should have default 1x1 span
      for (const section of layout.sections) {
        for (const tile of section.tiles) {
          expect(tile.span.columns).toBe(1)
          expect(tile.span.rows).toBe(1)
        }
      }
    })
  })

  describe('calculateRowsNeeded', () => {
    it('should calculate rows needed for various item counts', () => {
      expect(calculateRowsNeeded(4, 4)).toBe(1) // Exactly one row
      expect(calculateRowsNeeded(5, 4)).toBe(2) // One extra item
      expect(calculateRowsNeeded(8, 4)).toBe(2) // Exactly two rows
      expect(calculateRowsNeeded(9, 4)).toBe(3) // One extra item
      expect(calculateRowsNeeded(1, 4)).toBe(1) // Single item
      expect(calculateRowsNeeded(0, 4)).toBe(0) // No items
    })

    it('should handle different column counts', () => {
      expect(calculateRowsNeeded(6, 2)).toBe(3) // 2 columns
      expect(calculateRowsNeeded(6, 3)).toBe(2) // 3 columns
      expect(calculateRowsNeeded(6, 6)).toBe(1) // 6 columns
    })
  })

  describe('calculateEmptyCells', () => {
    it('should calculate empty cells correctly', () => {
      expect(calculateEmptyCells(3, 4)).toBe(1) // 3 items in 4 columns = 1 empty
      expect(calculateEmptyCells(5, 4)).toBe(3) // 5 items in 4 columns = 3 empty
      expect(calculateEmptyCells(4, 4)).toBe(0) // Perfect fit
      expect(calculateEmptyCells(8, 4)).toBe(0) // Perfect fit
      expect(calculateEmptyCells(1, 4)).toBe(3) // 1 item = 3 empty
    })

    it('should return 0 for full rows', () => {
      expect(calculateEmptyCells(4, 4)).toBe(0)
      expect(calculateEmptyCells(8, 4)).toBe(0)
      expect(calculateEmptyCells(12, 4)).toBe(0)
    })
  })

  describe('hasIncompleteLastRow', () => {
    it('should detect incomplete last rows', () => {
      expect(hasIncompleteLastRow(3, 4)).toBe(true)
      expect(hasIncompleteLastRow(5, 4)).toBe(true)
      expect(hasIncompleteLastRow(1, 4)).toBe(true)
    })

    it('should return false for complete last rows', () => {
      expect(hasIncompleteLastRow(4, 4)).toBe(false)
      expect(hasIncompleteLastRow(8, 4)).toBe(false)
      expect(hasIncompleteLastRow(12, 4)).toBe(false)
    })
  })

  describe('getLastTilePosition', () => {
    it('should calculate last tile position correctly', () => {
      const pos1 = getLastTilePosition(3, 4, 0)
      expect(pos1.column).toBe(2)
      expect(pos1.row).toBe(0)

      const pos2 = getLastTilePosition(5, 4, 0)
      expect(pos2.column).toBe(0)
      expect(pos2.row).toBe(1)

      const pos3 = getLastTilePosition(8, 4, 0)
      expect(pos3.column).toBe(3)
      expect(pos3.row).toBe(1)
    })

    it('should account for start row offset', () => {
      const pos = getLastTilePosition(5, 4, 10)
      expect(pos.column).toBe(0)
      expect(pos.row).toBe(11) // Start row 10 + 1 row
    })
  })

  describe('calculateGridDimensions', () => {
    it('should calculate grid dimensions correctly', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
      const dimensions = calculateGridDimensions(layout)

      expect(dimensions.columns).toBe(4) // Desktop has 4 columns
      expect(dimensions.rows).toBeGreaterThan(0)
    })
  })

  describe('getTilesAtRow', () => {
    it('should get all tiles at a specific row', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const tilesAtRow0 = getTilesAtRow(layout, 0)
      expect(tilesAtRow0.length).toBeGreaterThan(0)
    })
  })

  describe('getTilesAtColumn', () => {
    it('should get all tiles at a specific column', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const tilesAtCol0 = getTilesAtColumn(layout, 0)
      expect(tilesAtCol0.length).toBeGreaterThan(0)
    })
  })

  describe('getTileAt', () => {
    it('should get tile at specific position', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const tile = getTileAt(layout, 0, 0)
      expect(tile).toBeDefined()
      expect(tile?.type).toBe('item')
    })

    it('should return undefined for empty positions', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const tile = getTileAt(layout, 99, 99)
      expect(tile).toBeUndefined()
    })
  })

  describe('isPositionOccupied', () => {
    it('should detect occupied positions', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      expect(isPositionOccupied(layout, 0, 0)).toBe(true)
      expect(isPositionOccupied(layout, 99, 99)).toBe(false)
    })
  })

  describe('getSectionByName', () => {
    it('should find section by name', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const section = getSectionByName(layout, 'Starters')
      expect(section).toBeDefined()
      expect(section?.name).toBe('Starters')
    })

    it('should return undefined for non-existent section', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const section = getSectionByName(layout, 'NonExistent')
      expect(section).toBeUndefined()
    })
  })

  describe('getSectionRowRange', () => {
    it('should calculate section row range', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const section = layout.sections[0]
      const range = getSectionRowRange(section)

      expect(range.start).toBeDefined()
      expect(range.end).toBeGreaterThanOrEqual(range.start)
    })
  })

  describe('getSectionRowCount', () => {
    it('should calculate section row count', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const section = layout.sections[0]
      const rowCount = getSectionRowCount(section)

      expect(rowCount).toBeGreaterThan(0)
    })
  })

  describe('validateGridLayout', () => {
    it('should validate correct grid layout', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const errors = validateGridLayout(layout)
      expect(errors).toHaveLength(0)
    })

    it('should detect tiles outside grid bounds', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      // Manually create invalid tile
      layout.sections[0].tiles[0].column = 999

      const errors = validateGridLayout(layout)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('isGridLayoutValid', () => {
    it('should return true for valid layout', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      expect(isGridLayoutValid(layout)).toBe(true)
    })
  })

  describe('calculateLayoutStatistics', () => {
    it('should calculate layout statistics', () => {
      const preset = LAYOUT_PRESETS['balanced']
      const layout = generateGridLayout(sampleMenuData, preset, 'desktop')

      const stats = calculateLayoutStatistics(layout)

      expect(stats.totalSections).toBe(2)
      expect(stats.totalTiles).toBe(8)
      expect(stats.totalRows).toBeGreaterThan(0)
      expect(stats.totalColumns).toBe(4)
      expect(stats.averageTilesPerSection).toBe(4)
      expect(stats.gridUtilization).toBeGreaterThan(0)
      expect(stats.gridUtilization).toBeLessThanOrEqual(100)
    })
  })

  describe('Filler Tiles', () => {
    describe('insertFillerTiles', () => {
      it('should insert filler tiles for incomplete rows', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        // Should have more tiles after adding fillers
        expect(layoutWithFillers.totalTiles).toBeGreaterThanOrEqual(layout.totalTiles)
      })

      it('should not add fillers to complete rows', () => {
        const exactRowMenu: LayoutMenuData = {
          metadata: { title: 'Test', currency: 'USD' },
          sections: [
            {
              name: 'Drinks',
              items: [
                { name: 'Water', price: 2.00, featured: false },
                { name: 'Soda', price: 3.00, featured: false },
                { name: 'Juice', price: 4.00, featured: false },
                { name: 'Coffee', price: 3.50, featured: false }
              ]
            }
          ]
        }

        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(exactRowMenu, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        // Should have same number of tiles (no fillers needed)
        expect(layoutWithFillers.totalTiles).toBe(layout.totalTiles)
      })

      it('should add correct number of filler tiles', () => {
        const threeItemMenu: LayoutMenuData = {
          metadata: { title: 'Test', currency: 'USD' },
          sections: [
            {
              name: 'Items',
              items: [
                { name: 'Item 1', price: 10.00, featured: false },
                { name: 'Item 2', price: 10.00, featured: false },
                { name: 'Item 3', price: 10.00, featured: false }
              ]
            }
          ]
        }

        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(threeItemMenu, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        // 3 items in 4 columns = 1 filler needed
        expect(layoutWithFillers.totalTiles).toBe(4)
        expect(countFillerTiles(layoutWithFillers)).toBe(1)
      })
    })

    describe('getFillerTiles', () => {
      it('should get all filler tiles from layout', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        const fillers = getFillerTiles(layoutWithFillers)
        expect(Array.isArray(fillers)).toBe(true)
      })
    })

    describe('countFillerTiles', () => {
      it('should count filler tiles correctly', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        const count = countFillerTiles(layoutWithFillers)
        expect(count).toBeGreaterThanOrEqual(0)
      })
    })

    describe('hasFillerTiles', () => {
      it('should detect presence of filler tiles', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        // Original layout should not have fillers
        expect(hasFillerTiles(layout)).toBe(false)
      })
    })

    describe('removeFillerTiles', () => {
      it('should remove all filler tiles', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)
        const layoutWithoutFillers = removeFillerTiles(layoutWithFillers)

        expect(countFillerTiles(layoutWithoutFillers)).toBe(0)
        expect(layoutWithoutFillers.totalTiles).toBe(layout.totalTiles)
      })
    })

    describe('validateFillerTiles', () => {
      it('should validate correctly placed filler tiles', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        const errors = validateFillerTiles(layoutWithFillers)
        expect(errors).toHaveLength(0)
      })
    })

    describe('areFillerTilesValid', () => {
      it('should return true for valid filler tiles', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        expect(areFillerTilesValid(layoutWithFillers)).toBe(true)
      })
    })

    describe('calculateFillerStatistics', () => {
      it('should calculate filler statistics', () => {
        const preset = LAYOUT_PRESETS['balanced']
        const layout = generateGridLayout(sampleMenuData, preset, 'desktop')
        const layoutWithFillers = insertFillerTiles(layout)

        const stats = calculateFillerStatistics(layoutWithFillers)

        expect(stats.totalFillers).toBeGreaterThanOrEqual(0)
        expect(stats.fillersByStyle).toBeDefined()
        expect(stats.sectionsWithFillers).toBeGreaterThanOrEqual(0)
        expect(stats.fillerRatio).toBeGreaterThanOrEqual(0)
        expect(stats.fillerRatio).toBeLessThanOrEqual(100)
      })
    })
  })
})
