/**
 * Unit tests for FEATURE_CARD support
 *
 * Tests:
 * - Schema accepts templates with and without FEATURE_CARD
 * - FEATURE_CARD tile placement with specific menu fixtures
 *
 * _Requirements: 9.2, 9.6, 9.7, 9.8_
 */

import { TemplateSchemaV2 } from '../template-schema-v2'
import { createItemTile } from '../tile-placer'
import { blendHexTowards, getFeaturedStarBadgeMetrics, getPopularBadgeMetrics } from '../renderer-v2'
import type { EngineItemV2, TemplateV2, TileVariantDefV2 } from '../engine-types-v2'

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

const mockFeatureBudget = {
  nameLines: 2,
  descLines: 3,
  indicatorAreaHeight: 20,
  imageBoxHeight: 100,
  paddingTop: 10,
  paddingBottom: 10,
  totalHeight: 226,
}

/** Minimal valid template YAML object (without FEATURE_CARD) */
const baseTemplateData = {
  id: 'test-no-feature',
  version: '1.0.0',
  name: 'Test No Feature',
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

/** Template data with FEATURE_CARD */
const featureTemplateData = {
  ...baseTemplateData,
  id: 'test-with-feature',
  tiles: {
    ...baseTemplateData.tiles,
    FEATURE_CARD: {
      region: 'body',
      colSpan: 2,
      rowSpan: 3,
      contentBudget: mockFeatureBudget,
    },
  },
}

/** TemplateV2 object without FEATURE_CARD */
const baseTemplate: TemplateV2 = {
  ...baseTemplateData,
  tiles: {
    LOGO: { region: 'header', contentBudget: mockContentBudget },
    TITLE: { region: 'title', contentBudget: mockContentBudget },
    SECTION_HEADER: { region: 'body', colSpan: 4, contentBudget: mockContentBudget },
    ITEM_CARD: { region: 'body', rowSpan: 2, contentBudget: mockContentBudget },
    ITEM_TEXT_ROW: { region: 'body', rowSpan: 1, contentBudget: mockTextRowBudget },
  },
} as TemplateV2

/** TemplateV2 object with FEATURE_CARD */
const featureTemplate: TemplateV2 = {
  ...baseTemplateData,
  id: 'test-with-feature',
  tiles: {
    ...baseTemplate.tiles,
    FEATURE_CARD: { region: 'body', colSpan: 2, rowSpan: 3, contentBudget: mockFeatureBudget },
  },
} as TemplateV2

const mockItem: EngineItemV2 = {
  id: 'item-1',
  name: 'Signature Steak',
  description: 'Dry-aged ribeye with truffle butter',
  price: 42.99,
  imageUrl: 'https://example.com/steak.jpg',
  sortOrder: 0,
  indicators: { dietary: [], spiceLevel: 1, allergens: [] },
}

const featuredItem: EngineItemV2 = {
  ...mockItem,
  id: 'featured-1',
  name: 'Chef Special',
  isFeatured: true,
}

// =============================================================================
// Schema Tests
// =============================================================================

describe('FEATURE_CARD schema validation', () => {
  it('should accept template without FEATURE_CARD', () => {
    const result = TemplateSchemaV2.safeParse(baseTemplateData)
    expect(result.success).toBe(true)
  })

  it('should accept template with FEATURE_CARD', () => {
    const result = TemplateSchemaV2.safeParse(featureTemplateData)
    expect(result.success).toBe(true)
  })

  it('should reject FEATURE_CARD with invalid region', () => {
    const invalid = {
      ...featureTemplateData,
      tiles: {
        ...featureTemplateData.tiles,
        FEATURE_CARD: {
          ...featureTemplateData.tiles.FEATURE_CARD,
          region: 'invalid-region',
        },
      },
    }
    const result = TemplateSchemaV2.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('should reject FEATURE_CARD with missing contentBudget', () => {
    const invalid = {
      ...featureTemplateData,
      tiles: {
        ...featureTemplateData.tiles,
        FEATURE_CARD: { region: 'body', colSpan: 2, rowSpan: 3 },
      },
    }
    const result = TemplateSchemaV2.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// Tile Placement Tests
// =============================================================================

describe('Featured item tile placement', () => {
  it('should use ITEM_CARD for featured item even when template defines FEATURE_CARD', () => {
    const tile = createItemTile(featuredItem, 'section-1', featureTemplate, '$')

    expect(tile.type).toBe('ITEM_CARD')
    expect(tile.colSpan).toBe(1)
    expect(tile.rowSpan).toBe(2)
    expect(tile.regionId).toBe('body')
    expect(tile.content.type).toBe('ITEM_CARD')
    expect((tile.content as any).itemId).toBe('featured-1')
    expect((tile.content as any).name).toBe('Chef Special')
    expect((tile.content as any).isFeatured).toBe(true)
  })

  it('should use ITEM_CARD for featured item when template lacks FEATURE_CARD', () => {
    const tile = createItemTile(featuredItem, 'section-1', baseTemplate, '$')

    expect(tile.type).toBe('ITEM_CARD')
    expect(tile.content.type).toBe('ITEM_CARD')
    expect((tile.content as any).isFeatured).toBe(true)
  })

  it('should create standard ITEM_CARD for non-featured item even with feature template', () => {
    const tile = createItemTile(mockItem, 'section-1', featureTemplate, '$')

    expect(tile.type).toBe('ITEM_CARD')
    expect(tile.content.type).toBe('ITEM_CARD')
  })

  it('should use ITEM_TEXT_ROW for featured item in textOnly mode', () => {
    const tile = createItemTile(featuredItem, 'section-1', featureTemplate, '$', { textOnly: true })

    expect(tile.type).toBe('ITEM_TEXT_ROW')
    expect(tile.content.type).toBe('ITEM_TEXT_ROW')
    expect((tile.content as any).isFeatured).toBe(true)
  })

  it('should set showImage true for featured ITEM_CARD tiles', () => {
    const tile = createItemTile(featuredItem, 'section-1', featureTemplate, '$')

    expect(tile.type).toBe('ITEM_CARD')
    expect((tile.content as any).showImage).toBe(true)
  })

  it('should compute same footprint height for featured as regular ITEM_CARD', () => {
    const featuredTile = createItemTile(featuredItem, 'section-1', featureTemplate, '$')
    const regularTile = createItemTile(mockItem, 'section-1', featureTemplate, '$')

    expect(featuredTile.height).toBe(regularTile.height)
    expect(featuredTile.height).toBe(148)
  })

  it('should handle featured item without image', () => {
    const noImageFeatured = { ...featuredItem, imageUrl: undefined }
    const tile = createItemTile(noImageFeatured, 'section-1', featureTemplate, '$')

    expect(tile.type).toBe('ITEM_CARD')
    expect((tile.content as any).imageUrl).toBeUndefined()
    expect((tile.content as any).showImage).toBe(true)
  })

  it('should handle item with isFeatured undefined as non-featured', () => {
    const undefinedFeatured = { ...mockItem, isFeatured: undefined }
    const tile = createItemTile(undefinedFeatured, 'section-1', featureTemplate, '$')

    expect(tile.type).toBe('ITEM_CARD')
  })
})

describe('blendHexTowards', () => {
  it('interpolates toward the target colour', () => {
    expect(blendHexTowards('#ffffff', '#000000', 0)).toBe('#ffffff')
    expect(blendHexTowards('#ffffff', '#000000', 1)).toBe('#000000')
    const mid = blendHexTowards('#ffffff', '#000000', 0.5)
    expect(mid).toBe('#808080')
  })
})

describe('getPopularBadgeMetrics', () => {
  it('scales up for wider item tiles', () => {
    const narrow = getPopularBadgeMetrics(90)
    const wide = getPopularBadgeMetrics(200)
    expect(wide.badgeW).toBeGreaterThan(narrow.badgeW)
    expect(wide.badgeH).toBeGreaterThan(narrow.badgeH)
    expect(wide.fontSize).toBeGreaterThanOrEqual(narrow.fontSize)
    expect(wide.overlap).toBeGreaterThanOrEqual(narrow.overlap)
    expect(wide.boxShadow.length).toBeGreaterThan(10)
  })

  it('positions overlap so the sticker extends past the tile top-right', () => {
    const m = getPopularBadgeMetrics(120)
    const tileW = 130
    const x = tileW - m.badgeW + m.overlap
    expect(x + m.badgeW).toBeGreaterThan(tileW)
    expect(m.overlap).toBeGreaterThan(0)
  })
})

describe('getFeaturedStarBadgeMetrics', () => {
  it('stays smaller than Popular badge for typical tile widths', () => {
    const tileW = 120
    const star = getFeaturedStarBadgeMetrics(tileW)
    const pop = getPopularBadgeMetrics(tileW)
    expect(star.size).toBeLessThan(pop.badgeW)
    expect(star.borderRadius).toBe(star.size / 2)
  })
})
