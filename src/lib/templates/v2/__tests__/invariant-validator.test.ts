/**
 * Tests for V2 Layout Engine Invariant Validator
 */

import { validateInvariants, tilesOverlap, checkLayerOverlapAllowed } from '../invariant-validator'
import type { LayoutDocumentV2, TemplateV2, PageLayoutV2, TileInstanceV2 } from '../engine-types-v2'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockPageSpec = {
  id: 'A4_PORTRAIT',
  width: 595.28,
  height: 841.89,
  margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 }
}

const mockTemplate: TemplateV2 = {
  id: 'test-template',
  version: '1.0.0',
  name: 'Test Template',
  page: {
    size: 'A4_PORTRAIT',
    margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 }
  },
  regions: {
    header: { height: 60 },
    title: { height: 40 },
    footer: { height: 30 }
  },
  body: {
    container: {
      type: 'GRID',
      cols: 4,
      rowHeight: 70,
      gapX: 8,
      gapY: 8
    }
  },
  tiles: {} as any,
  policies: {} as any,
  filler: {} as any,
  itemIndicators: {} as any
}

const mockRegions = [
  { id: 'header' as const, x: 0, y: 0, width: 510, height: 60 },
  { id: 'title' as const, x: 0, y: 60, width: 510, height: 40 },
  { id: 'body' as const, x: 0, y: 100, width: 510, height: 600 },
  { id: 'footer' as const, x: 0, y: 700, width: 510, height: 30 }
]

function createMockTile(overrides: Partial<TileInstanceV2>): TileInstanceV2 {
  return {
    id: 'test-tile',
    type: 'ITEM_CARD',
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
    content: {
      type: 'ITEM_CARD',
      itemId: 'item-1',
      sectionId: 'section-1',
      name: 'Test Item',
      price: 10.99,
      showImage: false,
      indicators: { dietary: [], allergens: [], spiceLevel: null }
    },
    ...overrides
  }
}

function createMockPage(tiles: TileInstanceV2[]): PageLayoutV2 {
  return {
    pageIndex: 0,
    pageType: 'SINGLE',
    regions: mockRegions,
    tiles
  }
}

function createMockDocument(pages: PageLayoutV2[]): LayoutDocumentV2 {
  return {
    templateId: 'test-template',
    templateVersion: '1.0.0',
    pageSpec: mockPageSpec,
    pages
  }
}

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('tilesOverlap', () => {
  it('should detect overlapping tiles', () => {
    const tileA = createMockTile({ x: 0, y: 0, width: 100, height: 70 })
    const tileB = createMockTile({ x: 50, y: 35, width: 100, height: 70 })
    
    expect(tilesOverlap(tileA, tileB)).toBe(true)
  })

  it('should detect non-overlapping tiles (side by side)', () => {
    const tileA = createMockTile({ x: 0, y: 0, width: 100, height: 70 })
    const tileB = createMockTile({ x: 100, y: 0, width: 100, height: 70 })
    
    expect(tilesOverlap(tileA, tileB)).toBe(false)
  })

  it('should detect non-overlapping tiles (stacked)', () => {
    const tileA = createMockTile({ x: 0, y: 0, width: 100, height: 70 })
    const tileB = createMockTile({ x: 0, y: 70, width: 100, height: 70 })
    
    expect(tilesOverlap(tileA, tileB)).toBe(false)
  })

  it('should handle edge-touching tiles as non-overlapping', () => {
    const tileA = createMockTile({ x: 0, y: 0, width: 100, height: 70 })
    const tileB = createMockTile({ x: 100, y: 0, width: 100, height: 70 })
    
    expect(tilesOverlap(tileA, tileB)).toBe(false)
  })
})

describe('checkLayerOverlapAllowed', () => {
  it('should allow overlap when first tile is background', () => {
    const tileA = createMockTile({ layer: 'background' })
    const tileB = createMockTile({ layer: 'content' })
    
    expect(checkLayerOverlapAllowed(tileA, tileB)).toBe(true)
  })

  it('should allow overlap when second tile is background', () => {
    const tileA = createMockTile({ layer: 'content' })
    const tileB = createMockTile({ layer: 'background' })
    
    expect(checkLayerOverlapAllowed(tileA, tileB)).toBe(true)
  })

  it('should not allow overlap when both tiles are content', () => {
    const tileA = createMockTile({ layer: 'content' })
    const tileB = createMockTile({ layer: 'content' })
    
    expect(checkLayerOverlapAllowed(tileA, tileB)).toBe(false)
  })

  it('should allow overlap when both tiles are background', () => {
    const tileA = createMockTile({ layer: 'background' })
    const tileB = createMockTile({ layer: 'background' })
    
    expect(checkLayerOverlapAllowed(tileA, tileB)).toBe(true)
  })
})

// =============================================================================
// Invariant Validation Tests
// =============================================================================

describe('validateInvariants', () => {
  it('should return no violations for valid layout', () => {
    const tile = createMockTile({
      x: 10,
      y: 10,
      width: 100,
      height: 70,
      regionId: 'body'
    })
    
    const page = createMockPage([tile])
    const document = createMockDocument([page])
    
    const violations = validateInvariants(document, mockTemplate)
    expect(violations).toHaveLength(0)
  })

  describe('INV-1: Tiles within region bounds', () => {
    it('should detect tile extending beyond region width', () => {
      const tile = createMockTile({
        x: 450,
        y: 10,
        width: 100, // extends beyond region width of 510
        height: 70,
        regionId: 'body'
      })
      
      const page = createMockPage([tile])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(1)
      expect(violations[0].code).toBe('TILE_OUTSIDE_REGION')
      expect(violations[0].message).toContain('extends outside body region bounds')
    })

    it('should detect tile extending beyond region height', () => {
      const tile = createMockTile({
        x: 10,
        y: 550,
        width: 100,
        height: 70, // extends beyond region height of 600
        regionId: 'body'
      })
      
      const page = createMockPage([tile])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(1)
      expect(violations[0].code).toBe('TILE_OUTSIDE_REGION')
    })

    it('should detect tile with negative coordinates', () => {
      const tile = createMockTile({
        x: -10,
        y: 10,
        width: 100,
        height: 70,
        regionId: 'body'
      })
      
      const page = createMockPage([tile])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(1)
      expect(violations[0].code).toBe('TILE_OUTSIDE_REGION')
    })
  })

  describe('INV-2: No overlapping content tiles', () => {
    it('should detect overlapping content tiles', () => {
      const tileA = createMockTile({
        id: 'tile-a',
        x: 0,
        y: 0,
        width: 100,
        height: 70,
        layer: 'content'
      })
      
      const tileB = createMockTile({
        id: 'tile-b',
        x: 50,
        y: 35,
        width: 100,
        height: 70,
        layer: 'content'
      })
      
      const page = createMockPage([tileA, tileB])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(1)
      expect(violations[0].code).toBe('TILES_OVERLAP')
      expect(violations[0].message).toContain('tile-a and tile-b overlap')
    })

    it('should allow overlapping tiles when one is background', () => {
      const tileA = createMockTile({
        id: 'tile-a',
        x: 0,
        y: 0,
        width: 100,
        height: 70,
        layer: 'background'
      })
      
      const tileB = createMockTile({
        id: 'tile-b',
        x: 50,
        y: 35,
        width: 100,
        height: 70,
        layer: 'content'
      })
      
      const page = createMockPage([tileA, tileB])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(0)
    })
  })

  describe('INV-3: No widowed section headers', () => {
    it('should detect widowed section header', () => {
      const header = createMockTile({
        id: 'header-1',
        type: 'SECTION_HEADER',
        x: 0,
        y: 0,
        width: 510,
        height: 32,
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'section-1',
          label: 'Appetizers',
          isContinuation: false
        }
      })
      
      // No items from section-1 on this page
      const page = createMockPage([header])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(1)
      expect(violations[0].code).toBe('WIDOWED_SECTION_HEADER')
      expect(violations[0].message).toContain('Appetizers')
    })

    it('should allow section header with items below', () => {
      const header = createMockTile({
        id: 'header-1',
        type: 'SECTION_HEADER',
        x: 0,
        y: 0,
        width: 510,
        height: 32,
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'section-1',
          label: 'Appetizers',
          isContinuation: false
        }
      })
      
      const item = createMockTile({
        id: 'item-1',
        type: 'ITEM_CARD',
        x: 0,
        y: 40, // below header
        width: 100,
        height: 70,
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-1',
          sectionId: 'section-1', // same section
          name: 'Test Item',
          price: 10.99,
          showImage: false,
          indicators: { dietary: [], allergens: [], spiceLevel: null }
        }
      })
      
      const page = createMockPage([header, item])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(0)
    })
  })

  describe('INV-4: Item tiles in body region', () => {
    it('should detect item tile in wrong region', () => {
      const item = createMockTile({
        id: 'item-1',
        type: 'ITEM_CARD',
        regionId: 'header', // wrong region
        x: 0,
        y: 0,
        width: 100,
        height: 50 // fits within header height of 60
      })
      
      const page = createMockPage([item])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(1)
      expect(violations[0].code).toBe('ITEM_NOT_IN_BODY')
      expect(violations[0].message).toContain('is in header region, expected body')
    })

    it('should allow item tiles in body region', () => {
      const item = createMockTile({
        id: 'item-1',
        type: 'ITEM_CARD',
        regionId: 'body', // correct region
        x: 0,
        y: 0,
        width: 100,
        height: 70
      })
      
      const page = createMockPage([item])
      const document = createMockDocument([page])
      
      const violations = validateInvariants(document, mockTemplate)
      expect(violations).toHaveLength(0)
    })
  })
})