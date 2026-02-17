/**
 * Unit tests for DECORATIVE_DIVIDER support
 *
 * Tests:
 * - Divider insertion with specific menu fixtures
 * - Divider page overflow behavior
 * - Schema accepts templates with and without divider config
 *
 * _Requirements: 10.2, 10.4, 10.7_
 */

import { TemplateSchemaV2 } from '../template-schema-v2'
import { streamingPaginate } from '../streaming-paginator'
import { loadTemplateV2, clearTemplateCache } from '../template-loader-v2'
import { buildPageSpec } from '../engine-types-v2'
import type { EngineMenuV2, TemplateV2, PageSpecV2, DietaryIndicator } from '../engine-types-v2'

// Import fixture menus
import tinyMenu from '../fixtures/tiny.json'
import mediumMenu from '../fixtures/medium.json'

// =============================================================================
// Fixtures
// =============================================================================

const mockContentBudget = {
  nameLines: 2,
  descLines: 2,
  indicatorAreaHeight: 16,
  imageBoxHeight: 70,
  paddingTop: 8,
  paddingBottom: 8,
  totalHeight: 148,
}

const mockTextRowBudget = {
  ...mockContentBudget,
  imageBoxHeight: 0,
  totalHeight: 70,
}

const dividerBudget = {
  nameLines: 0,
  descLines: 0,
  indicatorAreaHeight: 0,
  imageBoxHeight: 0,
  paddingTop: 4,
  paddingBottom: 4,
  totalHeight: 70,
}

/** Base template data without dividers */
const baseTemplateData = {
  id: 'test-no-dividers',
  version: '1.0.0',
  name: 'Test No Dividers',
  page: { size: 'A4_PORTRAIT', margins: { top: 22, right: 25, bottom: 22, left: 25 } },
  regions: { header: { height: 60 }, title: { height: 32 }, footer: { height: 45 } },
  body: { container: { type: 'GRID', cols: 4, rowHeight: 70, gapX: 8, gapY: 8 } },
  tiles: {
    LOGO: { region: 'header', contentBudget: mockContentBudget },
    TITLE: { region: 'title', contentBudget: mockContentBudget },
    SECTION_HEADER: { region: 'body', colSpan: 4, contentBudget: mockContentBudget },
    ITEM_CARD: { region: 'body', rowSpan: 2, contentBudget: mockContentBudget },
    ITEM_TEXT_ROW: { region: 'body', rowSpan: 1, contentBudget: mockTextRowBudget },
  },
  policies: {
    lastRowBalancing: 'CENTER',
    showLogoOnPages: ['FIRST', 'CONTINUATION', 'FINAL', 'SINGLE'],
    repeatSectionHeaderOnContinuation: true,
    sectionHeaderKeepWithNextItems: 1,
  },
  filler: { enabled: false, safeZones: [], tiles: [], policy: 'SEQUENTIAL' },
  itemIndicators: {
    mode: 'INLINE',
    maxCount: 3,
    style: { badgeSize: 14, iconSet: 'emoji' },
    spiceScale: { 1: '🌶', 2: '🌶🌶', 3: '🌶🌶🌶' },
    letterFallback: { vegetarian: 'V', vegan: 'VG' },
  },
}

/** Template data with dividers enabled */
const dividerTemplateData = {
  ...baseTemplateData,
  id: 'test-with-dividers',
  tiles: {
    ...baseTemplateData.tiles,
    DECORATIVE_DIVIDER: {
      region: 'body',
      colSpan: 4,
      rowSpan: 1,
      contentBudget: dividerBudget,
    },
  },
  dividers: {
    enabled: true,
    style: 'ornament',
    height: 24,
  },
}

/** Template data with dividers disabled */
const dividerDisabledTemplateData = {
  ...dividerTemplateData,
  id: 'test-dividers-disabled',
  dividers: {
    enabled: false,
    style: 'line',
    height: 24,
  },
}

/** Multi-section menu for divider tests */
const multiSectionMenu: EngineMenuV2 = {
  id: 'divider-test-menu',
  name: 'Divider Test Menu',
  sections: [
    {
      id: 'sec-1',
      name: 'Starters',
      sortOrder: 0,
      items: [
        { id: 'item-1-1', name: 'Soup', price: 5.99, sortOrder: 0, indicators: { dietary: [], allergens: [], spiceLevel: null } },
        { id: 'item-1-2', name: 'Salad', price: 6.99, sortOrder: 1, indicators: { dietary: [], allergens: [], spiceLevel: null } },
      ],
    },
    {
      id: 'sec-2',
      name: 'Mains',
      sortOrder: 1,
      items: [
        { id: 'item-2-1', name: 'Steak', price: 24.99, sortOrder: 0, indicators: { dietary: [], allergens: [], spiceLevel: null } },
        { id: 'item-2-2', name: 'Fish', price: 18.99, sortOrder: 1, indicators: { dietary: [], allergens: [], spiceLevel: null } },
      ],
    },
    {
      id: 'sec-3',
      name: 'Desserts',
      sortOrder: 2,
      items: [
        { id: 'item-3-1', name: 'Cake', price: 8.99, sortOrder: 0, indicators: { dietary: [], allergens: [], spiceLevel: null } },
      ],
    },
  ],
  metadata: { currency: '$', venueName: 'Test Venue' },
}

/** Single-section menu (no dividers expected) */
const singleSectionMenu: EngineMenuV2 = {
  id: 'single-section-menu',
  name: 'Single Section Menu',
  sections: [
    {
      id: 'sec-1',
      name: 'All Items',
      sortOrder: 0,
      items: [
        { id: 'item-1', name: 'Item A', price: 10, sortOrder: 0, indicators: { dietary: [], allergens: [], spiceLevel: null } },
        { id: 'item-2', name: 'Item B', price: 12, sortOrder: 1, indicators: { dietary: [], allergens: [], spiceLevel: null } },
      ],
    },
  ],
  metadata: { currency: '$', venueName: 'Test Venue' },
}


// =============================================================================
// Schema Tests
// =============================================================================

describe('DECORATIVE_DIVIDER schema validation', () => {
  it('should accept template without dividers config', () => {
    const result = TemplateSchemaV2.safeParse(baseTemplateData)
    expect(result.success).toBe(true)
  })

  it('should accept template with dividers enabled', () => {
    const result = TemplateSchemaV2.safeParse(dividerTemplateData)
    expect(result.success).toBe(true)
  })

  it('should accept template with dividers disabled', () => {
    const result = TemplateSchemaV2.safeParse(dividerDisabledTemplateData)
    expect(result.success).toBe(true)
  })

  it('should accept all valid divider styles', () => {
    for (const style of ['line', 'pattern', 'icon', 'ornament']) {
      const data = {
        ...dividerTemplateData,
        dividers: { enabled: true, style, height: 24 },
      }
      const result = TemplateSchemaV2.safeParse(data)
      expect(result.success).toBe(true)
    }
  })

  it('should reject invalid divider style', () => {
    const data = {
      ...dividerTemplateData,
      dividers: { enabled: true, style: 'sparkle', height: 24 },
    }
    const result = TemplateSchemaV2.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject dividers with negative height', () => {
    const data = {
      ...dividerTemplateData,
      dividers: { enabled: true, style: 'line', height: -5 },
    }
    const result = TemplateSchemaV2.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('should reject DECORATIVE_DIVIDER tile with invalid region', () => {
    const data = {
      ...dividerTemplateData,
      tiles: {
        ...dividerTemplateData.tiles,
        DECORATIVE_DIVIDER: {
          ...dividerTemplateData.tiles.DECORATIVE_DIVIDER,
          region: 'invalid',
        },
      },
    }
    const result = TemplateSchemaV2.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// Divider Insertion Tests
// =============================================================================

describe('Divider insertion with menu fixtures', () => {
  let dividerTemplate: TemplateV2
  let pageSpec: PageSpecV2

  beforeAll(async () => {
    clearTemplateCache()
    // Use valentines-v2 which has dividers enabled (classic-cards-v2 now has dividers disabled)
    dividerTemplate = await loadTemplateV2('valentines-v2')
    pageSpec = buildPageSpec('A4_PORTRAIT', { top: 22, right: 25, bottom: 22, left: 25 })
  })

  it('should insert dividers between sections for multi-section menu', () => {
    const result = streamingPaginate(multiSectionMenu, dividerTemplate, pageSpec)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    // 3 sections → 2 dividers
    expect(dividers).toHaveLength(2)
  })

  it('should not insert dividers for single-section menu', () => {
    const result = streamingPaginate(singleSectionMenu, dividerTemplate, pageSpec)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    expect(dividers).toHaveLength(0)
  })

  it('should not insert divider before the first section', () => {
    const result = streamingPaginate(multiSectionMenu, dividerTemplate, pageSpec)

    // On the first page, the first body tile after static tiles should be a SECTION_HEADER, not a divider
    const firstPage = result.pages[0]
    const bodyTiles = firstPage.tiles.filter(t =>
      t.regionId === 'body'
    ).sort((a, b) => a.y - b.y || a.x - b.x)

    expect(bodyTiles.length).toBeGreaterThan(0)
    expect(bodyTiles[0].type).toBe('SECTION_HEADER')
  })

  it('should place divider tiles in body region', () => {
    const result = streamingPaginate(multiSectionMenu, dividerTemplate, pageSpec)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    dividers.forEach(d => {
      expect(d.regionId).toBe('body')
    })
  })

  it('should set correct divider content with style and sectionId', () => {
    const result = streamingPaginate(multiSectionMenu, dividerTemplate, pageSpec)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    // First divider should reference sec-2 (section after the divider)
    expect((dividers[0].content as any).type).toBe('DECORATIVE_DIVIDER')
    expect((dividers[0].content as any).sectionId).toBe('sec-2')
    expect((dividers[0].content as any).style).toBe('ornament')

    // Second divider should reference sec-3
    expect((dividers[1].content as any).sectionId).toBe('sec-3')
  })

  it('should use full-width colSpan for dividers', () => {
    const result = streamingPaginate(multiSectionMenu, dividerTemplate, pageSpec)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    dividers.forEach(d => {
      expect(d.colSpan).toBe(dividerTemplate.body.container.cols)
    })
  })

  it('should not insert dividers when template has no dividers config', async () => {
    clearTemplateCache()
    // Use a template without dividers (e.g., two-column-classic-v2)
    const noDividerTemplate = await loadTemplateV2('two-column-classic-v2')

    const result = streamingPaginate(multiSectionMenu, noDividerTemplate, pageSpec)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    expect(dividers).toHaveLength(0)
  })

  it('should insert correct divider count for medium fixture menu', () => {
    const result = streamingPaginate(mediumMenu as EngineMenuV2, dividerTemplate, pageSpec)

    const nonEmptySections = (mediumMenu as EngineMenuV2).sections.filter(
      s => s.items && s.items.length > 0
    )
    const expectedDividers = nonEmptySections.length - 1

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    expect(dividers).toHaveLength(expectedDividers)
  })

  it('should skip empty sections when counting dividers', () => {
    const menuWithEmpty: EngineMenuV2 = {
      ...multiSectionMenu,
      sections: [
        multiSectionMenu.sections[0],
        { id: 'sec-empty', name: 'Empty', sortOrder: 1, items: [] },
        { ...multiSectionMenu.sections[1], sortOrder: 2 },
        { ...multiSectionMenu.sections[2], sortOrder: 3 },
      ],
    }

    const result = streamingPaginate(menuWithEmpty, dividerTemplate, pageSpec)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    // 3 non-empty sections → 2 dividers (empty section skipped)
    expect(dividers).toHaveLength(2)
  })
})

// =============================================================================
// Divider Page Overflow Tests
// =============================================================================

describe('Divider page overflow behavior', () => {
  let dividerTemplate: TemplateV2
  let pageSpec: PageSpecV2

  beforeAll(async () => {
    clearTemplateCache()
    // Use valentines-v2 which has dividers enabled (classic-cards-v2 now has dividers disabled)
    dividerTemplate = await loadTemplateV2('valentines-v2')
    pageSpec = buildPageSpec('A4_PORTRAIT', { top: 22, right: 25, bottom: 22, left: 25 })
  })

  it('should handle dividers across multiple pages without losing any', () => {
    // Create a large menu that will span multiple pages
    const largeSectionMenu: EngineMenuV2 = {
      id: 'large-divider-test',
      name: 'Large Divider Test',
      sections: Array.from({ length: 5 }, (_, si) => ({
        id: `sec-${si}`,
        name: `Section ${si}`,
        sortOrder: si,
        items: Array.from({ length: 8 }, (_, ii) => ({
          id: `item-${si}-${ii}`,
          name: `Item ${si}-${ii}`,
          description: 'A delicious dish',
          price: 10 + ii,
          imageUrl: 'https://placehold.co/400x300',
          sortOrder: ii,
          indicators: { dietary: [] as DietaryIndicator[], allergens: [] as string[], spiceLevel: null },
        })),
      })),
      metadata: { currency: '$', venueName: 'Test Venue' },
    }

    const result = streamingPaginate(largeSectionMenu, dividerTemplate, pageSpec)

    // Should span multiple pages
    expect(result.pages.length).toBeGreaterThan(1)

    const dividers = result.pages.flatMap(p =>
      p.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
    )

    // 5 sections → 4 dividers, regardless of page breaks
    expect(dividers).toHaveLength(4)
  })

  it('should preserve all items when dividers cause page overflow', () => {
    const menu: EngineMenuV2 = {
      id: 'overflow-test',
      name: 'Overflow Test',
      sections: Array.from({ length: 4 }, (_, si) => ({
        id: `sec-${si}`,
        name: `Section ${si}`,
        sortOrder: si,
        items: Array.from({ length: 6 }, (_, ii) => ({
          id: `item-${si}-${ii}`,
          name: `Item ${si}-${ii}`,
          price: 10,
          imageUrl: 'https://placehold.co/400x300',
          sortOrder: ii,
          indicators: { dietary: [] as DietaryIndicator[], allergens: [] as string[], spiceLevel: null },
        })),
      })),
      metadata: { currency: '$', venueName: 'Test Venue' },
    }

    const result = streamingPaginate(menu, dividerTemplate, pageSpec)

    const totalItems = result.pages.reduce(
      (sum, page) =>
        sum + page.tiles.filter(t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW').length,
      0
    )

    const expectedItems = menu.sections.reduce((sum, s) => sum + s.items.length, 0)
    expect(totalItems).toBe(expectedItems)
  })

  it('should place dividers on correct rows (not overlapping items)', () => {
    const result = streamingPaginate(multiSectionMenu, dividerTemplate, pageSpec)

    result.pages.forEach(page => {
      const dividers = page.tiles.filter(t => t.type === 'DECORATIVE_DIVIDER')
      const contentTiles = page.tiles.filter(t =>
        t.type !== 'DECORATIVE_DIVIDER' && t.type !== 'LOGO' && t.type !== 'TITLE' && t.type !== 'FOOTER_INFO'
      )

      dividers.forEach(divider => {
        contentTiles.forEach(tile => {
          // No content tile should overlap with a divider vertically in the same region
          if (tile.regionId === divider.regionId) {
            const dividerTop = divider.y
            const dividerBottom = divider.y + divider.height
            const tileTop = tile.y
            const tileBottom = tile.y + tile.height

            const overlaps = dividerTop < tileBottom && dividerBottom > tileTop
            if (overlaps) {
              // If they overlap vertically, they shouldn't overlap horizontally
              const dividerLeft = divider.x
              const dividerRight = divider.x + divider.width
              const tileLeft = tile.x
              const tileRight = tile.x + tile.width

              const hOverlaps = dividerLeft < tileRight && dividerRight > tileLeft
              expect(hOverlaps).toBe(false)
            }
          }
        })
      })
    })
  })
})
