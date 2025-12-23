/**
 * Tests for Filler Manager V2
 */

import {
  insertFillers,
  buildOccupancyGrid,
  findEmptyCellsInSafeZones,
  resolveSafeZoneIndex,
  selectFillers,
  hashString,
} from '../filler-manager-v2'
import type {
  PageLayoutV2,
  TemplateV2,
  TileInstanceV2,
  SafeZoneV2,
  FillerTileDefV2,
} from '../engine-types-v2'

describe('Filler Manager V2', () => {
  // Mock template with filler configuration
  const mockTemplate: Partial<TemplateV2> = {
    id: 'test-template',
    body: {
      container: {
        type: 'GRID',
        cols: 4,
        rowHeight: 70,
        gapX: 8,
        gapY: 8,
      },
    },
    filler: {
      enabled: true,
      safeZones: [
        {
          startRow: 'LAST',
          endRow: 'LAST',
          startCol: 0,
          endCol: 3,
        },
      ],
      tiles: [
        {
          id: 'filler-1',
          style: 'icon',
          content: 'utensils',
        },
        {
          id: 'filler-2',
          style: 'icon',
          content: 'coffee',
        },
      ],
      policy: 'SEQUENTIAL',
    },
  } as TemplateV2

  // Mock page with body region
  const mockPage: PageLayoutV2 = {
    pageIndex: 0,
    pageType: 'SINGLE',
    regions: [
      {
        id: 'body',
        x: 0,
        y: 100,
        width: 400,
        height: 500,
      },
    ],
    tiles: [],
  }

  describe('hashString', () => {
    it('produces consistent hash for same input', () => {
      const hash1 = hashString('test-string')
      const hash2 = hashString('test-string')
      expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different inputs', () => {
      const hash1 = hashString('test-1')
      const hash2 = hashString('test-2')
      expect(hash1).not.toBe(hash2)
    })

    it('produces positive integers', () => {
      const hash = hashString('test')
      expect(hash).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(hash)).toBe(true)
    })
  })

  describe('resolveSafeZoneIndex', () => {
    it('resolves LAST to maxRows - 1', () => {
      expect(resolveSafeZoneIndex('LAST', 10)).toBe(9)
      expect(resolveSafeZoneIndex('LAST', 1)).toBe(0)
    })

    it('clamps numeric values to valid range', () => {
      expect(resolveSafeZoneIndex(5, 10)).toBe(5)
      expect(resolveSafeZoneIndex(-1, 10)).toBe(0)
      expect(resolveSafeZoneIndex(15, 10)).toBe(9)
    })
  })

  describe('buildOccupancyGrid', () => {
    it('creates empty grid when no tiles', () => {
      const grid = buildOccupancyGrid(mockPage, mockTemplate, 4, 6)
      expect(grid).toHaveLength(6)
      expect(grid[0]).toHaveLength(4)
      expect(grid.every(row => row.every(cell => !cell))).toBe(true)
    })

    it('marks occupied cells for single-cell tiles', () => {
      const pageWithTile: PageLayoutV2 = {
        ...mockPage,
        tiles: [
          {
            id: 'test-tile',
            type: 'ITEM_TEXT_ROW',
            regionId: 'body',
            x: 0,
            y: 0,
            width: 100,
            height: 70,
            colSpan: 1,
            rowSpan: 1,
            gridRow: 0,
            gridCol: 0,
            layer: 'content',
            content: {} as any,
          },
        ],
      }

      const grid = buildOccupancyGrid(pageWithTile, mockTemplate, 4, 6)
      expect(grid[0][0]).toBe(true)
      expect(grid[0][1]).toBe(false)
      expect(grid[1][0]).toBe(false)
    })

    it('marks occupied cells for multi-cell tiles', () => {
      const pageWithTile: PageLayoutV2 = {
        ...mockPage,
        tiles: [
          {
            id: 'test-tile',
            type: 'ITEM_CARD',
            regionId: 'body',
            x: 100,
            y: 70,
            width: 200,
            height: 140,
            colSpan: 2,
            rowSpan: 2,
            gridRow: 1,
            gridCol: 1,
            layer: 'content',
            content: {} as any,
          },
        ],
      }

      const grid = buildOccupancyGrid(pageWithTile, mockTemplate, 4, 6)
      
      // Check 2x2 area is marked occupied
      expect(grid[1][1]).toBe(true)
      expect(grid[1][2]).toBe(true)
      expect(grid[2][1]).toBe(true)
      expect(grid[2][2]).toBe(true)
      
      // Check surrounding cells are empty
      expect(grid[0][1]).toBe(false)
      expect(grid[1][0]).toBe(false)
      expect(grid[1][3]).toBe(false)
      expect(grid[3][1]).toBe(false)
    })
  })

  describe('findEmptyCellsInSafeZones', () => {
    it('finds empty cells in safe zone', () => {
      const occupancy = [
        [false, false, false, false],
        [false, false, false, false],
        [true, false, false, true],
      ]

      const safeZones: SafeZoneV2[] = [
        {
          startRow: 2,
          endRow: 2,
          startCol: 0,
          endCol: 3,
        },
      ]

      const emptyCells = findEmptyCellsInSafeZones(occupancy, safeZones, 4, 3)
      expect(emptyCells).toHaveLength(2)
      expect(emptyCells).toContainEqual({ row: 2, col: 1 })
      expect(emptyCells).toContainEqual({ row: 2, col: 2 })
    })

    it('handles LAST row correctly', () => {
      const occupancy = [
        [false, false, false, false],
        [false, false, false, false],
        [true, false, false, true],
      ]

      const safeZones: SafeZoneV2[] = [
        {
          startRow: 'LAST',
          endRow: 'LAST',
          startCol: 1,
          endCol: 2,
        },
      ]

      const emptyCells = findEmptyCellsInSafeZones(occupancy, safeZones, 4, 3)
      expect(emptyCells).toHaveLength(2)
      expect(emptyCells).toContainEqual({ row: 2, col: 1 })
      expect(emptyCells).toContainEqual({ row: 2, col: 2 })
    })
  })

  describe('selectFillers', () => {
    const cells = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]

    const fillers: FillerTileDefV2[] = [
      { id: 'filler-1', style: 'icon', content: 'utensils' },
      { id: 'filler-2', style: 'icon', content: 'coffee' },
    ]

    it('selects fillers sequentially', () => {
      const selected = selectFillers(cells, fillers, 'SEQUENTIAL', 123)
      expect(selected).toHaveLength(3)
      expect(selected[0].filler.id).toBe('filler-1')
      expect(selected[1].filler.id).toBe('filler-2')
      expect(selected[2].filler.id).toBe('filler-1') // wraps around
    })

    it('selects fillers randomly with seed', () => {
      const selected1 = selectFillers(cells, fillers, 'RANDOM_SEEDED', 123)
      const selected2 = selectFillers(cells, fillers, 'RANDOM_SEEDED', 123)
      
      // Same seed should produce same results
      expect(selected1.map(s => s.filler.id)).toEqual(selected2.map(s => s.filler.id))
    })

    it('returns empty array when no cells or fillers', () => {
      expect(selectFillers([], fillers, 'SEQUENTIAL', 123)).toEqual([])
      expect(selectFillers(cells, [], 'SEQUENTIAL', 123)).toEqual([])
    })
  })

  describe('insertFillers', () => {
    it('returns empty array when fillers disabled', () => {
      const templateWithoutFillers = {
        ...mockTemplate,
        filler: { ...mockTemplate.filler!, enabled: false },
      }

      const fillers = insertFillers(mockPage, templateWithoutFillers, 'menu-1', 0)
      expect(fillers).toEqual([])
    })

    it('creates filler tiles in empty safe zone cells', () => {
      // Create a page with some occupied cells
      const pageWithTiles: PageLayoutV2 = {
        ...mockPage,
        tiles: [
          {
            id: 'item-1',
            type: 'ITEM_TEXT_ROW',
            regionId: 'body',
            x: 0,
            y: 0,
            width: 100,
            height: 70,
            colSpan: 1,
            rowSpan: 1,
            gridRow: 0,
            gridCol: 0,
            layer: 'content',
            content: {} as any,
          },
        ],
      }

      const fillers = insertFillers(pageWithTiles, mockTemplate, 'menu-1', 0)
      
      // Should create fillers for empty cells in safe zones
      expect(fillers.length).toBeGreaterThan(0)
      
      // All fillers should be 1x1 (MVP constraint)
      fillers.forEach(filler => {
        expect(filler.colSpan).toBe(1)
        expect(filler.rowSpan).toBe(1)
        expect(filler.layer).toBe('background')
        expect(filler.type).toBe('FILLER')
        expect(filler.regionId).toBe('body')
      })
    })

    it('produces deterministic results for same inputs', () => {
      const fillers1 = insertFillers(mockPage, mockTemplate, 'menu-1', 0)
      const fillers2 = insertFillers(mockPage, mockTemplate, 'menu-1', 0)
      
      expect(fillers1.length).toBe(fillers2.length)
      expect(fillers1.map(f => f.id)).toEqual(fillers2.map(f => f.id))
    })
  })
})