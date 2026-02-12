/**
 * Unit tests for Tile Placer utilities
 */

import {
  createSectionHeaderTile,
  createItemTile,
  createLogoTile,
  createTitleTile,
  selectItemVariant,
  placeTile,
  advancePosition,
  advanceToNextRow,
  applyLastRowBalancing,
  generateTileId,
  initPlacementContext,
  type PlacementContext,
} from '../tile-placer'
import { calculateTileHeight, calculateTileWidth } from '../engine-types-v2'
import type {
  EngineMenuV2,
  EngineSectionV2,
  EngineItemV2,
  TemplateV2,
  PageLayoutV2,
  RegionV2,
} from '../engine-types-v2'

// Mock template for testing
const mockTemplate: TemplateV2 = {
  id: 'test-template',
  version: '1.0.0',
  name: 'Test Template',
  page: {
    size: 'A4_PORTRAIT',
    margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 },
  },
  regions: {
    header: { height: 60 },
    title: { height: 40 },
    footer: { height: 30 },
  },
  body: {
    container: {
      type: 'GRID',
      cols: 4,
      rowHeight: 70,
      gapX: 8,
      gapY: 8,
    },
  },
  tiles: {
    LOGO: {
      region: 'header',
      contentBudget: {
        nameLines: 0,
        descLines: 0,
        indicatorAreaHeight: 0,
        imageBoxHeight: 50,
        paddingTop: 5,
        paddingBottom: 5,
        totalHeight: 60,
      },
    },
    TITLE: {
      region: 'title',
      contentBudget: {
        nameLines: 1,
        descLines: 0,
        indicatorAreaHeight: 0,
        imageBoxHeight: 0,
        paddingTop: 8,
        paddingBottom: 8,
        totalHeight: 40,
      },
    },
    SECTION_HEADER: {
      region: 'body',
      colSpan: 4,
      rowSpan: 1,
      contentBudget: {
        nameLines: 1,
        descLines: 0,
        indicatorAreaHeight: 0,
        imageBoxHeight: 0,
        paddingTop: 8,
        paddingBottom: 4,
        totalHeight: 32,
      },
    },
    ITEM_CARD: {
      region: 'body',
      rowSpan: 2,
      contentBudget: {
        nameLines: 2,
        descLines: 2,
        indicatorAreaHeight: 16,
        imageBoxHeight: 70,
        paddingTop: 8,
        paddingBottom: 8,
        totalHeight: 148,
      },
    },
    ITEM_TEXT_ROW: {
      region: 'body',
      rowSpan: 1,
      contentBudget: {
        nameLines: 2,
        descLines: 2,
        indicatorAreaHeight: 16,
        imageBoxHeight: 0,
        paddingTop: 8,
        paddingBottom: 8,
        totalHeight: 70,
      },
    },
  },
  policies: {
    lastRowBalancing: 'CENTER',
    showLogoOnPages: ['FIRST', 'CONTINUATION', 'FINAL', 'SINGLE'],
    repeatSectionHeaderOnContinuation: true,
    sectionHeaderKeepWithNextItems: 1,
  },
  filler: {
    enabled: false,
    safeZones: [],
    tiles: [],
    policy: 'SEQUENTIAL',
  },
  itemIndicators: {
    mode: 'INLINE',
    maxCount: 3,
    style: {
      badgeSize: 14,
      iconSet: 'emoji',
    },
    spiceScale: { 1: '🌶', 2: '🌶🌶', 3: '🌶🌶🌶' },
    letterFallback: { vegetarian: 'V', vegan: 'VG' },
  },
}

const mockSection: EngineSectionV2 = {
  id: 'section-1',
  name: 'Test Section',
  sortOrder: 0,
  items: [],
}

const mockItem: EngineItemV2 = {
  id: 'item-1',
  name: 'Test Item',
  description: 'Test description',
  price: 9.99,
  imageUrl: 'https://example.com/image.jpg',
  sortOrder: 0,
  indicators: {
    dietary: ['vegetarian'],
    spiceLevel: 2,
    allergens: ['nuts'],
  },
}

const mockMenu: EngineMenuV2 = {
  id: 'menu-1',
  name: 'Test Menu',
  sections: [mockSection],
  metadata: {
    currency: '$',
    venueName: 'Test Venue',
    logoUrl: 'https://example.com/logo.jpg',
  },
}

const mockBodyRegion: RegionV2 = {
  id: 'body',
  x: 0,
  y: 100,
  width: 500,
  height: 600,
}

describe('Tile Placer', () => {
  describe('calculateTileHeight', () => {
    it('calculates correct footprint height for single row', () => {
      const height = calculateTileHeight(1, 70, 8)
      expect(height).toBe(70) // 1 * 70 + 0 * 8
    })

    it('calculates correct footprint height for multi-row', () => {
      const height = calculateTileHeight(2, 70, 8)
      expect(height).toBe(148) // 2 * 70 + 1 * 8
    })
  })

  describe('calculateTileWidth', () => {
    it('calculates correct footprint width for single column', () => {
      const width = calculateTileWidth(1, 100, 8)
      expect(width).toBe(100) // 1 * 100 + 0 * 8
    })

    it('calculates correct footprint width for multi-column', () => {
      const width = calculateTileWidth(2, 100, 8)
      expect(width).toBe(208) // 2 * 100 + 1 * 8
    })
  })

  describe('createSectionHeaderTile', () => {
    it('creates section header with correct properties', () => {
      const tile = createSectionHeaderTile(mockSection, mockTemplate)
      
      expect(tile.type).toBe('SECTION_HEADER')
      expect(tile.regionId).toBe('body')
      expect(tile.colSpan).toBe(4)
      expect(tile.rowSpan).toBe(1)
      expect(tile.height).toBe(70) // FOOTPRINT: 1 * 70 + 0 * 8
      expect(tile.content.type).toBe('SECTION_HEADER')
      expect(tile.content.sectionId).toBe('section-1')
      expect(tile.content.label).toBe('Test Section')
      expect(tile.content.isContinuation).toBe(false)
    })

    it('creates continuation header when specified', () => {
      const tile = createSectionHeaderTile(mockSection, mockTemplate, true)
      expect(tile.content.isContinuation).toBe(true)
      expect(tile.id).toContain('-cont')
    })
  })

  describe('createItemTile', () => {
    it('creates item card for item with image', () => {
      const tile = createItemTile(mockItem, 'section-1', mockTemplate, '$')
      
      expect(tile.type).toBe('ITEM_CARD')
      expect(tile.regionId).toBe('body')
      expect(tile.rowSpan).toBe(2)
      expect(tile.height).toBe(148) // FOOTPRINT: 2 * 70 + 1 * 8
      expect(tile.content.type).toBe('ITEM_CARD')
      expect(tile.content.showImage).toBe(true)
    })

    it('creates item card for item without image (with placeholder)', () => {
      const itemWithoutImage = { ...mockItem, imageUrl: undefined }
      const tile = createItemTile(itemWithoutImage, 'section-1', mockTemplate, '$')
      
      expect(tile.type).toBe('ITEM_CARD')
      expect(tile.rowSpan).toBe(2)
      expect(tile.height).toBe(148) // FOOTPRINT: 2 * 70 + 1 * 8
      expect(tile.content.showImage).toBe(true) // Always true for ITEM_CARD to ensure space allocation
      expect(tile.content.imageUrl).toBeUndefined() // No actual image URL
    })

    it('creates text row when textOnly mode is enabled', () => {
      const tile = createItemTile(mockItem, 'section-1', mockTemplate, '$', { textOnly: true })
      
      expect(tile.type).toBe('ITEM_TEXT_ROW')
      expect(tile.rowSpan).toBe(1)
      expect(tile.height).toBe(70)
    })
  })

  describe('selectItemVariant', () => {
    it('selects ITEM_CARD for item with image', () => {
      const result = selectItemVariant(mockItem, mockTemplate)
      expect(result.variant).toBe(mockTemplate.tiles.ITEM_CARD)
      expect(result.tileType).toBe('ITEM_CARD')
    })

    it('selects ITEM_CARD for item without image (for visual parity)', () => {
      const itemWithoutImage = { ...mockItem, imageUrl: undefined }
      const result = selectItemVariant(itemWithoutImage, mockTemplate)
      expect(result.variant).toBe(mockTemplate.tiles.ITEM_CARD)
      expect(result.tileType).toBe('ITEM_CARD')
    })

    it('selects ITEM_TEXT_ROW when textOnly is enabled', () => {
      const result = selectItemVariant(mockItem, mockTemplate, { textOnly: true })
      expect(result.variant).toBe(mockTemplate.tiles.ITEM_TEXT_ROW)
      expect(result.tileType).toBe('ITEM_TEXT_ROW')
    })
  })

  describe('placement context', () => {
    it('initializes context correctly', () => {
      const ctx = initPlacementContext()
      expect(ctx.currentRow).toBe(0)
      expect(ctx.currentCol).toBe(0)
      expect(ctx.currentRowMaxSpan).toBe(1)
      expect(ctx.currentRowTiles).toEqual([])
    })

    it('advances position correctly for single-column tile', () => {
      const ctx = initPlacementContext()
      const mockTile = { colSpan: 1, rowSpan: 1 } as any
      
      advancePosition(ctx, mockTile, mockTemplate)
      
      expect(ctx.currentCol).toBe(1)
      expect(ctx.currentRow).toBe(0)
    })

    it('advances to next row when column limit reached', () => {
      const ctx = initPlacementContext()
      ctx.currentCol = 3 // Almost at limit (cols = 4)
      const mockTile = { colSpan: 1, rowSpan: 1 } as any
      
      advancePosition(ctx, mockTile, mockTemplate)
      
      expect(ctx.currentCol).toBe(0)
      expect(ctx.currentRow).toBe(1)
    })

    it('advances row by correct rowSpan', () => {
      const ctx = initPlacementContext()
      
      advanceToNextRow(ctx, 2)
      
      expect(ctx.currentRow).toBe(2)
      expect(ctx.currentCol).toBe(0)
      expect(ctx.currentRowMaxSpan).toBe(1)
    })
  })

  describe('generateTileId', () => {
    it('generates simple ID', () => {
      const id = generateTileId('ITEM', 'item-1')
      expect(id).toBe('item-item-1')
    })

    it('generates ID with suffix', () => {
      const id = generateTileId('SECTION_HEADER', 'section-1', 'cont')
      expect(id).toBe('section_header-section-1-cont')
    })
  })
})