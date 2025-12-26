import { generateLayoutV2 } from '../layout-engine-v2'
import { loadTemplateV2 } from '../template-loader-v2'
import type { EngineMenuV2, TemplateV2 } from '../engine-types-v2'

// Mock template loader to return a template with CENTER balancing and fillers enabled
jest.mock('../template-loader-v2', () => ({
  loadTemplateV2: jest.fn()
}))

describe('Collision Detection Reproduction', () => {
  const mockMenu: EngineMenuV2 = {
    id: 'menu-collision',
    name: 'Collision Test Menu',
    sections: [
      {
        id: 'sec-1',
        name: 'Appetizers',
        sortOrder: 0,
        items: [
          { id: 'item-1', name: 'Item 1', price: 10, sortOrder: 0, indicators: { dietary: [], allergens: [], spiceLevel: null } },
          { id: 'item-2', name: 'Item 2', price: 10, sortOrder: 1, indicators: { dietary: [], allergens: [], spiceLevel: null } },
          { id: 'item-3', name: 'Item 3', price: 10, sortOrder: 2, indicators: { dietary: [], allergens: [], spiceLevel: null } },
          { id: 'item-4', name: 'Item 4', price: 10, sortOrder: 3, indicators: { dietary: [], allergens: [], spiceLevel: null } },
          { id: 'item-5', name: 'Item 5', price: 10, sortOrder: 4, indicators: { dietary: [], allergens: [], spiceLevel: null } },
        ]
      }
    ],
    metadata: { currency: '£', venueName: 'Test Venue' }
  }

  const mockTemplate: TemplateV2 = {
    id: 'test-template',
    version: '1.0.0',
    name: 'Test Template',
    page: {
      size: 'A4_PORTRAIT',
      margins: { top: 50, right: 50, bottom: 50, left: 50 },
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
        rowHeight: 100,
        gapX: 10,
        gapY: 10,
      },
    },
    tiles: {
      LOGO: { region: 'header', contentBudget: { nameLines: 0, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 50, paddingTop: 5, paddingBottom: 5, totalHeight: 60 } },
      TITLE: { region: 'title', contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 8, totalHeight: 40 } },
      SECTION_HEADER: { region: 'body', colSpan: 4, rowSpan: 1, contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 4, totalHeight: 30 } },
      ITEM_CARD: { region: 'body', rowSpan: 1, colSpan: 1, contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 50, paddingTop: 8, paddingBottom: 8, totalHeight: 100 } },
      ITEM_TEXT_ROW: { region: 'body', rowSpan: 1, colSpan: 1, contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 8, totalHeight: 100 } },
    },
    policies: {
      lastRowBalancing: 'CENTER',
      showLogoOnPages: ['FIRST', 'SINGLE'],
      repeatSectionHeaderOnContinuation: true,
      sectionHeaderKeepWithNextItems: 1,
    },
    filler: {
      enabled: true,
      safeZones: [{ startRow: 0, endRow: 'LAST', startCol: 0, endCol: 3 }],
      tiles: [{ id: 'filler-1', style: 'color' }],
      policy: 'SEQUENTIAL',
    },
    itemIndicators: { mode: 'INLINE', maxCount: 3, style: { badgeSize: 14, iconSet: 'emoji' }, spiceScale: {}, letterFallback: {} },
  };

  (loadTemplateV2 as jest.Mock).mockResolvedValue(mockTemplate)

  it('should not have overlapping items and fillers in the last row', async () => {
    const result = await generateLayoutV2({
      menu: mockMenu,
      templateId: 'test-template'
    })

    const page = result.pages[0]
    const items = page.tiles.filter(t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW')
    const fillers = page.tiles.filter(t => t.type === 'FILLER')

    // Find items in the last row (row index 2 - header is row 0, first 4 items are row 1, 5th item is row 2)
    const lastRowItems = items.filter(t => t.gridRow === 2)
    const lastRowFillers = fillers.filter(t => t.gridRow === 2)

    expect(lastRowItems).toHaveLength(1)
    // With CENTER balancing, the single item in the last row occupies the center position,
    // so fillers should only be placed in the remaining empty positions (columns 0 and 3)
    expect(lastRowFillers).toHaveLength(2)

    const item5 = lastRowItems[0]
    
    // Check for physical overlaps - there should be none
    for (const filler of lastRowFillers) {
      const hasOverlap = 
        item5.x < filler.x + filler.width &&
        item5.x + item5.width > filler.x &&
        item5.y < filler.y + filler.height &&
        item5.y + item5.height > filler.y

      expect(hasOverlap).toBe(false)
    }
  })
})



