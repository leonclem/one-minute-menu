/**
 * Property-Based Tests for Featured Item Variant Selection
 * Feature: gridmenu-v2-layout-enhancements, Property 5: Featured Item Variant Selection
 *
 * For any EngineItemV2 and TemplateV2, selectItemVariant returns:
 *   - FEATURE_CARD when isFeatured === true AND template has FEATURE_CARD AND not textOnly
 *   - ITEM_TEXT_ROW when textOnly === true (regardless of isFeatured)
 *   - Standard variant (ITEM_CARD or ITEM_TEXT_ROW) when isFeatured is false/undefined
 *
 * **Validates: Requirements 8.2, 8.3, 9.4**
 */

import fc from 'fast-check'
import { selectItemVariant } from '../tile-placer'
import type {
  EngineItemV2,
  TemplateV2,
  SelectionConfigV2,
  TileVariantDefV2,
  ItemIndicatorsV2,
} from '../engine-types-v2'

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

const baseTileVariant: TileVariantDefV2 = {
  region: 'body',
  contentBudget: mockContentBudget,
}

const textRowVariant: TileVariantDefV2 = {
  region: 'body',
  contentBudget: mockTextRowBudget,
}

const featureCardVariant: TileVariantDefV2 = {
  region: 'body',
  colSpan: 2,
  rowSpan: 3,
  contentBudget: mockFeatureBudget,
}

/** Base template without FEATURE_CARD */
const baseTemplate: TemplateV2 = {
  id: 'test-template',
  version: '1.0.0',
  name: 'Test Template',
  page: { size: 'A4_PORTRAIT', margins: { top: 22, right: 25, bottom: 22, left: 25 } },
  regions: { header: { height: 60 }, title: { height: 32 }, footer: { height: 45 } },
  body: { container: { type: 'GRID', cols: 4, rowHeight: 70, gapX: 8, gapY: 8 } },
  tiles: {
    LOGO: { region: 'header', contentBudget: mockContentBudget },
    TITLE: { region: 'title', contentBudget: mockContentBudget },
    SECTION_HEADER: { region: 'body', contentBudget: mockContentBudget },
    ITEM_CARD: baseTileVariant,
    ITEM_TEXT_ROW: textRowVariant,
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

/** Template with FEATURE_CARD */
const featureTemplate: TemplateV2 = {
  ...baseTemplate,
  id: 'test-feature-template',
  tiles: {
    ...baseTemplate.tiles,
    FEATURE_CARD: featureCardVariant,
  },
}

// =============================================================================
// Generators
// =============================================================================

const arbIndicators: fc.Arbitrary<ItemIndicatorsV2> = fc.record({
  dietary: fc.constant([]) as fc.Arbitrary<ItemIndicatorsV2['dietary']>,
  spiceLevel: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 3 })),
  allergens: fc.constant([] as string[]),
})

/** Generate a random EngineItemV2 with configurable isFeatured */
function arbItem(isFeatured?: boolean | undefined): fc.Arbitrary<EngineItemV2> {
  const featuredArb =
    isFeatured !== undefined
      ? fc.constant(isFeatured)
      : fc.oneof(fc.constant(true), fc.constant(false), fc.constant(undefined as boolean | undefined))

  return fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    name: fc.string({ minLength: 1, maxLength: 40 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 80 }), { nil: undefined }),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(999.99), noNaN: true }),
    imageUrl: fc.option(fc.constant('https://placehold.co/400x300'), { nil: undefined }),
    sortOrder: fc.integer({ min: 0, max: 100 }),
    indicators: arbIndicators,
    isFeatured: featuredArb,
  })
}

/** Generate a random SelectionConfigV2 */
function arbSelection(textOnly?: boolean): fc.Arbitrary<SelectionConfigV2> {
  const textOnlyArb = textOnly !== undefined ? fc.constant(textOnly) : fc.boolean()
  return fc.record({
    textOnly: textOnlyArb,
  })
}

// =============================================================================
// Property Tests
// =============================================================================

describe('Feature: gridmenu-v2-layout-enhancements, Property 5: Featured Item Variant Selection', () => {
  // Property 5a: textOnly always returns ITEM_TEXT_ROW regardless of isFeatured
  it('should always return ITEM_TEXT_ROW when textOnly is true', () => {
    fc.assert(
      fc.property(arbItem(), (item) => {
        const selection: SelectionConfigV2 = { textOnly: true }

        // Test with template that has FEATURE_CARD
        const result1 = selectItemVariant(item, featureTemplate, selection)
        expect(result1.tileType).toBe('ITEM_TEXT_ROW')
        expect(result1.variant).toBe(featureTemplate.tiles.ITEM_TEXT_ROW)

        // Test with template without FEATURE_CARD
        const result2 = selectItemVariant(item, baseTemplate, selection)
        expect(result2.tileType).toBe('ITEM_TEXT_ROW')
        expect(result2.variant).toBe(baseTemplate.tiles.ITEM_TEXT_ROW)
      }),
      { numRuns: 100 }
    )
  })

  // Property 5b: Featured items get FEATURE_CARD when template supports it and not textOnly
  it('should return FEATURE_CARD for featured items when template supports it', () => {
    fc.assert(
      fc.property(arbItem(true), (item) => {
        const result = selectItemVariant(item, featureTemplate)
        expect(result.tileType).toBe('FEATURE_CARD')
        expect(result.variant).toBe(featureTemplate.tiles.FEATURE_CARD)
      }),
      { numRuns: 100 }
    )
  })

  // Property 5c: Featured items fall back to standard variant when template lacks FEATURE_CARD
  it('should return standard variant for featured items when template lacks FEATURE_CARD', () => {
    fc.assert(
      fc.property(arbItem(true), (item) => {
        const result = selectItemVariant(item, baseTemplate)
        expect(result.tileType).toBe('ITEM_CARD')
        expect(result.variant).toBe(baseTemplate.tiles.ITEM_CARD)
      }),
      { numRuns: 100 }
    )
  })

  // Property 5d: Non-featured items always get standard variant
  it('should return standard variant for non-featured items', () => {
    fc.assert(
      fc.property(arbItem(false), (item) => {
        // With feature template
        const result1 = selectItemVariant(item, featureTemplate)
        expect(result1.tileType).toBe('ITEM_CARD')
        expect(result1.variant).toBe(featureTemplate.tiles.ITEM_CARD)

        // Without feature template
        const result2 = selectItemVariant(item, baseTemplate)
        expect(result2.tileType).toBe('ITEM_CARD')
        expect(result2.variant).toBe(baseTemplate.tiles.ITEM_CARD)
      }),
      { numRuns: 100 }
    )
  })

  // Property 5e: Items with undefined isFeatured behave like non-featured
  it('should treat undefined isFeatured as non-featured', () => {
    fc.assert(
      fc.property(
        arbItem().map(item => ({ ...item, isFeatured: undefined })),
        (item) => {
          const result = selectItemVariant(item, featureTemplate)
          expect(result.tileType).toBe('ITEM_CARD')
          expect(result.variant).toBe(featureTemplate.tiles.ITEM_CARD)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 5f: textOnly takes precedence over isFeatured for any selection config
  it('should prioritize textOnly over isFeatured for any random selection', () => {
    fc.assert(
      fc.property(arbItem(), arbSelection(), (item, selection) => {
        const result = selectItemVariant(item, featureTemplate, selection)

        if (selection.textOnly) {
          // textOnly always wins
          expect(result.tileType).toBe('ITEM_TEXT_ROW')
        } else if (item.isFeatured && featureTemplate.tiles.FEATURE_CARD) {
          // Featured + template support → FEATURE_CARD
          expect(result.tileType).toBe('FEATURE_CARD')
        } else {
          // Standard item
          expect(result.tileType).toBe('ITEM_CARD')
        }
      }),
      { numRuns: 100 }
    )
  })
})
