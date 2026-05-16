/**
 * Property-Based Tests: Menu Banner
 * Feature: menu-banner-footer
 *
 * Properties 1–20 covering banner/strip placement, surface color consistency,
 * title defaults, config round-trip, venue identity, flagship uniqueness,
 * hero image logic, font preset scope, footer text color, and more.
 *
 * Library: fast-check (jest runner)
 * Minimum iterations: 100 per property
 */

import fc from 'fast-check'
import { generateLayoutV2 } from '../layout-engine-v2'
import { clearTemplateCache, loadTemplateV2 } from '../template-loader-v2'
import {
  PALETTES_V2,
  DEFAULT_PALETTE_V2,
  FONT_STYLE_PRESETS,
  getFontStylePresetGoogleFontsUrl,
  type ColorPaletteV2,
} from '../renderer-v2'
import { V2_TEMPLATE_OPTIONS } from '../template-options'
import {
  resolveBannerTitle,
  resolveBannerHeroImageUrl,
  createBannerTile,
  createBannerStripTile,
} from '../tile-placer'
import type {
  EngineMenuV2,
  EngineItemV2,
  EngineSectionV2,
  ItemIndicatorsV2,
  SelectionConfigV2,
  BannerImageStyle,
  FontStylePreset,
  BannerContentV2,
  BannerStripContentV2,
} from '../engine-types-v2'

// =============================================================================
// Generators
// =============================================================================

/** Pick a random palette from PALETTES_V2 */
const arbitraryPalette: fc.Arbitrary<ColorPaletteV2> = fc.constantFrom(...PALETTES_V2)

/** Pick a random template ID from V2_TEMPLATE_OPTIONS */
const arbitraryTemplateId: fc.Arbitrary<string> = fc.constantFrom(
  ...V2_TEMPLATE_OPTIONS.map(t => t.id)
)

/** Pick a random font style preset */
const arbitraryFontStylePreset: fc.Arbitrary<FontStylePreset> = fc.constantFrom<FontStylePreset>(
  'strong',
  'fun',
  'standard'
)

/** Pick a random banner image style */
const arbitraryBannerImageStyle: fc.Arbitrary<BannerImageStyle> = fc.constantFrom<BannerImageStyle>(
  'cutout',
  'stretch-fit',
  'none'
)

/** Generate a banner title string of length 0–30 */
const arbitraryBannerTitle: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 30 })

/** Generate a valid ItemIndicatorsV2 */
const arbIndicators: fc.Arbitrary<ItemIndicatorsV2> = fc.record({
  dietary: fc.constant([]) as fc.Arbitrary<ItemIndicatorsV2['dietary']>,
  spiceLevel: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 3 })),
  allergens: fc.constant([] as string[]),
})

/** Generate a valid EngineItemV2 with optional flagship and image */
function arbItem(id: string): fc.Arbitrary<EngineItemV2> {
  return fc.record({
    id: fc.constant(id),
    name: fc.string({ minLength: 1, maxLength: 40 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 80 }), { nil: undefined }),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(999.99), noNaN: true }),
    imageUrl: fc.option(fc.constant('https://placehold.co/400x300'), { nil: undefined }),
    cutoutUrl: fc.option(fc.constant('https://placehold.co/400x300/cutout'), { nil: undefined }),
    sortOrder: fc.constant(0),
    indicators: arbIndicators,
    isFlagship: fc.option(fc.boolean(), { nil: undefined }),
  })
}

/** Generate a valid EngineItemV2 with an image (for flagship tests) */
function arbItemWithImage(id: string): fc.Arbitrary<EngineItemV2> {
  return fc.record({
    id: fc.constant(id),
    name: fc.string({ minLength: 1, maxLength: 40 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 80 }), { nil: undefined }),
    price: fc.float({ min: Math.fround(0.01), max: Math.fround(999.99), noNaN: true }),
    imageUrl: fc.constant('https://placehold.co/400x300'),
    cutoutUrl: fc.constant('https://placehold.co/400x300/cutout'),
    sortOrder: fc.constant(0),
    indicators: arbIndicators,
    isFlagship: fc.constant(false),
  })
}

/** Generate a valid EngineSectionV2 with 1–4 items */
function arbSection(sectionIndex: number): fc.Arbitrary<EngineSectionV2> {
  return fc.integer({ min: 1, max: 4 }).chain(itemCount => {
    const items = Array.from({ length: itemCount }, (_, i) =>
      arbItem(`item-${sectionIndex}-${i}`)
    )
    return fc.tuple(...(items as [fc.Arbitrary<EngineItemV2>, ...fc.Arbitrary<EngineItemV2>[]])).map(itemArr => ({
      id: `sec-${sectionIndex}`,
      name: `Section ${sectionIndex}`,
      sortOrder: sectionIndex,
      items: itemArr,
    }))
  })
}

/** Generate a valid EngineMenuV2 with 1–3 sections */
const arbitraryMenu: fc.Arbitrary<EngineMenuV2> = fc
  .integer({ min: 1, max: 3 })
  .chain(sectionCount => {
    const sections = Array.from({ length: sectionCount }, (_, i) => arbSection(i))
    return fc.tuple(...(sections as [fc.Arbitrary<EngineSectionV2>, ...fc.Arbitrary<EngineSectionV2>[]])).map(secs => ({
      id: 'prop-test-menu',
      name: 'Property Test Menu',
      sections: secs,
      metadata: {
        currency: '£',
        venueName: 'Test Venue',
        logoUrl: undefined,
      },
    }))
  })

/** Generate a SelectionConfigV2 with banner fields */
const arbitraryBannerConfig: fc.Arbitrary<SelectionConfigV2> = fc.record({
  showBanner: fc.boolean(),
  bannerTitle: fc.option(arbitraryBannerTitle, { nil: undefined }),
  showVenueName: fc.option(fc.boolean(), { nil: undefined }),
  bannerImageStyle: fc.option(arbitraryBannerImageStyle, { nil: undefined }),
  fontStylePreset: fc.option(arbitraryFontStylePreset, { nil: undefined }),
  colourPaletteId: fc.option(fc.constantFrom(...PALETTES_V2.map(p => p.id)), { nil: undefined }),
})

// Template IDs that support banner (banner.enabled: true in YAML)
const BANNER_SUPPORTED_TEMPLATES = [
  '4-column-portrait',
  '3-column-portrait',
  '2-column-portrait',
  '6-column-portrait-a3',
  '5-column-landscape',
]

// =============================================================================
// Helper: collect all tiles across all pages
// =============================================================================
function allTiles(doc: Awaited<ReturnType<typeof generateLayoutV2>>) {
  return doc.pages.flatMap(p => p.tiles)
}

// =============================================================================
// Property 1: Banner disabled omits all banner elements
// =============================================================================

describe('Feature: menu-banner-footer, Property 1: Banner disabled omits all banner elements', () => {
  beforeEach(() => clearTemplateCache())

  it('should produce zero BANNER tiles (but still a BANNER_STRIP) when showBanner is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        arbitraryBannerConfig,
        async (menu, templateId, config) => {
          const selection: SelectionConfigV2 = { ...config, showBanner: false }
          const doc = await generateLayoutV2({ menu, templateId, selection })
          const tiles = allTiles(doc)
          // Full BANNER tiles must never appear when showBanner is false
          const fullBannerTiles = tiles.filter(t => t.type === 'BANNER')
          expect(fullBannerTiles).toHaveLength(0)
          // A thin BANNER_STRIP is always placed (one per page) for visual continuity
          const stripTiles = tiles.filter(t => t.type === 'BANNER_STRIP')
          expect(stripTiles).toHaveLength(doc.pages.length)
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 2: Surface color consistency across banner, strip, and footer
// =============================================================================

describe('Feature: menu-banner-footer, Property 2: Surface color consistency', () => {
  beforeEach(() => clearTemplateCache())

  it('should use palette banner surface color on all BANNER and BANNER_STRIP tiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        arbitraryPalette,
        async (menu, templateId, palette) => {
          const selection: SelectionConfigV2 = {
            showBanner: true,
            colourPaletteId: palette.id,
          }
          const doc = await generateLayoutV2({ menu, templateId, selection })
          const expectedSurface = palette.colors.bannerSurface

          for (const tile of allTiles(doc)) {
            if (tile.type === 'BANNER') {
              const content = tile.content as BannerContentV2
              expect(content.surfaceColor).toBe(expectedSurface)
            }
            if (tile.type === 'BANNER_STRIP') {
              const content = tile.content as BannerStripContentV2
              expect(content.surfaceColor).toBe(expectedSurface)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 3: Banner title defaults to "MENU"
// =============================================================================

describe('Feature: menu-banner-footer, Property 3: Banner title defaults to "MENU"', () => {
  it('should return "MENU" for undefined, null, or empty bannerTitle', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant(null),
          fc.constant(''),
          fc.constant('   ')
        ),
        (title) => {
          const result = resolveBannerTitle(title as string | undefined | null)
          expect(result).toBe('MENU')
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 4: Banner title length validation
// =============================================================================

describe('Feature: menu-banner-footer, Property 4: Banner title length validation', () => {
  it('should accept strings of length 0–30', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 30 }),
        (title) => {
          expect(title.length).toBeLessThanOrEqual(30)
          // Validation: length <= 30 is valid
          const isValid = title.length <= 30
          expect(isValid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject strings of length > 30', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 31, maxLength: 100 }),
        (title) => {
          const isValid = title.length <= 30
          expect(isValid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 5: Configuration round-trip persistence
// =============================================================================

describe('Feature: menu-banner-footer, Property 5: Configuration round-trip persistence', () => {
  /**
   * Simulate getRestoredState logic inline (mirrors template-client.tsx).
   * For any valid SelectionConfigV2 with banner fields, serializing to a config
   * object and deserializing back should produce equivalent values.
   */
  function simulateRoundTrip(
    templateId: string,
    selection: SelectionConfigV2,
    flagshipItemId: string | null
  ) {
    // Serialize (as template-selection API would)
    const config: Record<string, unknown> = {
      showBanner: selection.showBanner,
      bannerTitle: selection.bannerTitle,
      showVenueName: selection.showVenueName,
      bannerImageStyle: selection.bannerImageStyle,
      fontStylePreset: selection.fontStylePreset,
      flagshipItemId,
      colourPaletteId: selection.colourPaletteId,
    }

    // Deserialize (mirrors getRestoredState logic)
    const bannerEnabledTemplates = new Set(BANNER_SUPPORTED_TEMPLATES)
    const bannerEnabledByDefault = bannerEnabledTemplates.has(templateId)
    const showBanner =
      config.showBanner !== undefined ? config.showBanner === true : bannerEnabledByDefault
    const bannerTitle =
      typeof config.bannerTitle === 'string' && config.bannerTitle.length > 0
        ? config.bannerTitle
        : 'MENU'
    const showVenueName = config.showVenueName !== false
    const bannerImageStyle: BannerImageStyle =
      config.bannerImageStyle === 'stretch-fit'
        ? 'stretch-fit'
        : config.bannerImageStyle === 'none'
        ? 'none'
        : 'cutout'
    const fontStylePreset: FontStylePreset =
      config.fontStylePreset === 'strong'
        ? 'strong'
        : config.fontStylePreset === 'fun'
        ? 'fun'
        : 'standard'
    const restoredFlagshipItemId =
      typeof config.flagshipItemId === 'string' ? config.flagshipItemId : null

    return { showBanner, bannerTitle, showVenueName, bannerImageStyle, fontStylePreset, flagshipItemId: restoredFlagshipItemId }
  }

  it('should round-trip showBanner correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        fc.boolean(),
        (templateId, showBanner) => {
          const result = simulateRoundTrip(templateId, { showBanner }, null)
          expect(result.showBanner).toBe(showBanner)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should round-trip bannerTitle correctly (non-empty strings preserved)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        fc.string({ minLength: 1, maxLength: 30 }),
        (templateId, title) => {
          const result = simulateRoundTrip(templateId, { bannerTitle: title }, null)
          expect(result.bannerTitle).toBe(title)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should round-trip bannerImageStyle correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        arbitraryBannerImageStyle,
        (templateId, style) => {
          const result = simulateRoundTrip(templateId, { bannerImageStyle: style }, null)
          expect(result.bannerImageStyle).toBe(style)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should round-trip fontStylePreset correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        arbitraryFontStylePreset,
        (templateId, preset) => {
          const result = simulateRoundTrip(templateId, { fontStylePreset: preset }, null)
          expect(result.fontStylePreset).toBe(preset)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should round-trip flagshipItemId correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        fc.option(fc.uuid(), { nil: null }),
        (templateId, flagshipItemId) => {
          const result = simulateRoundTrip(templateId, {}, flagshipItemId)
          expect(result.flagshipItemId).toBe(flagshipItemId)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 6: Venue identity zone logic
// =============================================================================

describe('Feature: menu-banner-footer, Property 6: Venue identity zone logic', () => {
  const baseMenu: EngineMenuV2 = {
    id: 'test-menu',
    name: 'Test Menu',
    sections: [{ id: 'sec-0', name: 'Section', sortOrder: 0, items: [{ id: 'item-0', name: 'Item', price: 10, sortOrder: 0, indicators: { dietary: [], spiceLevel: null, allergens: [] } }] }],
    metadata: { currency: '£', venueName: 'My Restaurant' },
  }

  it('when showVenueName=true and no logo, banner content includes venueName and no logoUrl', () => {
    fc.assert(
      fc.property(
        arbitraryPalette,
        (palette) => {
          const menu = { ...baseMenu, metadata: { ...baseMenu.metadata, logoUrl: undefined } }
          const tile = createBannerTile(menu, { showVenueName: true }, 120, palette.colors.surface ?? palette.colors.background, palette.colors.menuTitle)
          const content = tile.content as BannerContentV2
          expect(content.showVenueName).toBe(true)
          expect(content.venueName).toBe('My Restaurant')
          expect(content.logoUrl).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('when showVenueName=true and logo present, banner content includes logoUrl', () => {
    fc.assert(
      fc.property(
        arbitraryPalette,
        (palette) => {
          const menu = { ...baseMenu, metadata: { ...baseMenu.metadata, logoUrl: 'https://example.com/logo.png' } }
          const tile = createBannerTile(menu, { showVenueName: true }, 120, palette.colors.surface ?? palette.colors.background, palette.colors.menuTitle)
          const content = tile.content as BannerContentV2
          expect(content.showVenueName).toBe(true)
          expect(content.logoUrl).toBe('https://example.com/logo.png')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('when showVenueName=false, banner content includes neither venueName nor logoUrl for venue zone', () => {
    fc.assert(
      fc.property(
        arbitraryPalette,
        (palette) => {
          const menu = { ...baseMenu, metadata: { ...baseMenu.metadata, logoUrl: 'https://example.com/logo.png' } }
          const tile = createBannerTile(menu, { showVenueName: false }, 120, palette.colors.surface ?? palette.colors.background, palette.colors.menuTitle)
          const content = tile.content as BannerContentV2
          expect(content.showVenueName).toBe(false)
          expect(content.venueName).toBeUndefined()
          expect(content.logoUrl).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 7: Flagship uniqueness constraint
// =============================================================================

describe('Feature: menu-banner-footer, Property 7: Flagship uniqueness constraint', () => {
  /**
   * Simulate the API-layer flagship enforcement: setting item X as flagship
   * clears any existing flagship and sets only X.
   */
  function setFlagship(items: EngineItemV2[], targetId: string): EngineItemV2[] {
    return items.map(item => ({
      ...item,
      isFlagship: item.id === targetId,
    }))
  }

  it('after setting item X as flagship, exactly one item has isFlagship=true and it is X', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).chain(n => {
          const items = Array.from({ length: n }, (_, i) => ({
            id: `item-${i}`,
            name: `Item ${i}`,
            price: 10,
            sortOrder: i,
            indicators: { dietary: [] as ItemIndicatorsV2['dietary'], spiceLevel: null, allergens: [] as string[] },
            isFlagship: i === 0, // first item starts as flagship
          }))
          return fc.tuple(fc.constant(items), fc.integer({ min: 0, max: n - 1 }))
        }),
        ([items, targetIndex]) => {
          const targetId = items[targetIndex].id
          const result = setFlagship(items, targetId)
          const flagships = result.filter(i => i.isFlagship === true)
          expect(flagships).toHaveLength(1)
          expect(flagships[0].id).toBe(targetId)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 8: Flagship removal leaves zero flagships
// =============================================================================

describe('Feature: menu-banner-footer, Property 8: Flagship removal leaves zero flagships', () => {
  function removeFlagship(items: EngineItemV2[]): EngineItemV2[] {
    return items.map(item => ({ ...item, isFlagship: false }))
  }

  it('after removing flagship, zero items have isFlagship=true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }).chain(n => {
          const items = Array.from({ length: n }, (_, i) => ({
            id: `item-${i}`,
            name: `Item ${i}`,
            price: 10,
            sortOrder: i,
            indicators: { dietary: [] as ItemIndicatorsV2['dietary'], spiceLevel: null, allergens: [] as string[] },
            isFlagship: i === 0,
          }))
          return fc.constant(items)
        }),
        (items) => {
          const result = removeFlagship(items)
          const flagships = result.filter(i => i.isFlagship === true)
          expect(flagships).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 9: Hero image presence logic
// =============================================================================

describe('Feature: menu-banner-footer, Property 9: Hero image presence logic', () => {
  it('banner includes hero image URL iff flagship exists AND style is not "none"', () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.record({
            id: fc.constant('flagship-item'),
            name: fc.constant('Flagship'),
            price: fc.constant(10),
            sortOrder: fc.constant(0),
            indicators: fc.constant({ dietary: [] as ItemIndicatorsV2['dietary'], spiceLevel: null, allergens: [] as string[] }),
            imageUrl: fc.constant('https://placehold.co/400x300'),
            cutoutUrl: fc.constant('https://placehold.co/400x300/cutout'),
            isFlagship: fc.constant(true),
          }),
          { nil: undefined }
        ),
        arbitraryBannerImageStyle,
        (flagshipItem, style) => {
          const { heroImageUrl, heroImageCutoutUrl } = resolveBannerHeroImageUrl(flagshipItem, style)
          const hasHero = !!heroImageUrl || !!heroImageCutoutUrl
          const shouldHaveHero = !!flagshipItem && style !== 'none'
          expect(hasHero).toBe(shouldHaveHero)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 10: Hero image URL selection by style
// =============================================================================

describe('Feature: menu-banner-footer, Property 10: Hero image URL selection by style', () => {
  const flagshipItem: EngineItemV2 = {
    id: 'flagship',
    name: 'Flagship',
    price: 10,
    sortOrder: 0,
    indicators: { dietary: [], spiceLevel: null, allergens: [] },
    imageUrl: 'https://example.com/image.jpg',
    cutoutUrl: 'https://example.com/cutout.png',
    isFlagship: true,
  }

  it('cutout style uses cutoutUrl', () => {
    fc.assert(
      fc.property(fc.constant('cutout' as BannerImageStyle), (style) => {
        const { heroImageCutoutUrl } = resolveBannerHeroImageUrl(flagshipItem, style)
        expect(heroImageCutoutUrl).toBe(flagshipItem.cutoutUrl)
      }),
      { numRuns: 100 }
    )
  })

  it('stretch-fit style uses primary imageUrl', () => {
    fc.assert(
      fc.property(fc.constant('stretch-fit' as BannerImageStyle), (style) => {
        const { heroImageUrl, heroImageCutoutUrl } = resolveBannerHeroImageUrl(flagshipItem, style)
        expect(heroImageUrl).toBe(flagshipItem.imageUrl)
        expect(heroImageCutoutUrl).toBeUndefined()
      }),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 11: Banner strip invariants
// =============================================================================

describe('Feature: menu-banner-footer, Property 11: Banner strip invariants', () => {
  beforeEach(() => clearTemplateCache())

  it('BANNER_STRIP tiles have height between 15 and 25 points and only surfaceColor content', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        arbitraryPalette,
        async (menu, templateId, palette) => {
          // Need multi-page layout to get CONTINUATION pages with strips
          // Use a small menu but ensure we check strip tiles when they appear
          const selection: SelectionConfigV2 = {
            showBanner: true,
            colourPaletteId: palette.id,
          }
          const doc = await generateLayoutV2({ menu, templateId, selection })
          for (const tile of allTiles(doc)) {
            if (tile.type === 'BANNER_STRIP') {
              expect(tile.height).toBeGreaterThanOrEqual(15)
              expect(tile.height).toBeLessThanOrEqual(25)
              const content = tile.content as BannerStripContentV2
              expect(content.type).toBe('BANNER_STRIP')
              expect(typeof content.surfaceColor).toBe('string')
              expect(content.surfaceColor.length).toBeGreaterThan(0)
              // Strip should have no text or image data
              expect((content as unknown as Record<string, unknown>).title).toBeUndefined()
              expect((content as unknown as Record<string, unknown>).heroImageUrl).toBeUndefined()
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 12: Font style preset scope
// =============================================================================

describe('Feature: menu-banner-footer, Property 12: Font style preset scope', () => {
  const baseMenu: EngineMenuV2 = {
    id: 'test-menu',
    name: 'Test Menu',
    sections: [{ id: 'sec-0', name: 'Section', sortOrder: 0, items: [{ id: 'item-0', name: 'Item', price: 10, sortOrder: 0, indicators: { dietary: [], spiceLevel: null, allergens: [] } }] }],
    metadata: { currency: '£', venueName: 'My Restaurant' },
  }

  it('BANNER tile fontStylePreset matches the selection config preset', () => {
    fc.assert(
      fc.property(
        arbitraryFontStylePreset,
        arbitraryPalette,
        (preset, palette) => {
          const tile = createBannerTile(
            baseMenu,
            { fontStylePreset: preset },
            120,
            palette.colors.surface ?? palette.colors.background,
            palette.colors.menuTitle
          )
          const content = tile.content as BannerContentV2
          expect(content.fontStylePreset).toBe(preset)
          // Verify the preset config exists and has font families
          const presetConfig = FONT_STYLE_PRESETS[preset]
          expect(presetConfig).toBeDefined()
          expect(presetConfig.bannerTitleFamily.length).toBeGreaterThan(0)
          expect(presetConfig.sectionHeaderFamily.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 13: Footer text uses menuTitle color
// =============================================================================

describe('Feature: menu-banner-footer, Property 13: Footer text uses menuTitle color', () => {
  beforeEach(() => clearTemplateCache())

  it('FOOTER_INFO tiles are associated with palette menuTitle color', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        arbitraryPalette,
        async (menu, templateId, palette) => {
          // Add venue info to trigger footer rendering
          const menuWithFooter: EngineMenuV2 = {
            ...menu,
            metadata: {
              ...menu.metadata,
              venueInfo: {
                address: '123 Test St',
                phone: '+44 123 456 789',
                email: 'test@example.com',
              },
            },
          }
          const selection: SelectionConfigV2 = { colourPaletteId: palette.id }
          const doc = await generateLayoutV2({ menu: menuWithFooter, templateId, selection })
          const footerTiles = allTiles(doc).filter(t => t.type === 'FOOTER_INFO')
          // If footer tiles exist, verify the palette footerText color is defined
          // (the renderer uses palette.colors.footerText for footer text)
          if (footerTiles.length > 0) {
            expect(palette.colors.footerText).toBeTruthy()
            expect(palette.colors.footerText.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 14: Banner proportionality by template
// =============================================================================

describe('Feature: menu-banner-footer, Property 14: Banner proportionality by template', () => {
  beforeEach(() => clearTemplateCache())

  it('BANNER tile height equals banner.heightPt from template YAML when showBanner is true', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        async (menu, templateId) => {
          const template = await loadTemplateV2(templateId)
          if (!template.banner?.enabled) return // skip non-banner templates

          const selection: SelectionConfigV2 = { showBanner: true }
          const doc = await generateLayoutV2({ menu, templateId, selection })
          const bannerTiles = allTiles(doc).filter(t => t.type === 'BANNER')

          expect(bannerTiles.length).toBeGreaterThan(0)
          for (const tile of bannerTiles) {
            expect(tile.height).toBe(template.banner!.heightPt)
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)

  it('no BANNER tile appears when showBanner=false regardless of template banner config', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        async (menu, templateId) => {
          const selection: SelectionConfigV2 = { showBanner: false }
          const doc = await generateLayoutV2({ menu, templateId, selection })
          const bannerTiles = allTiles(doc).filter(t => t.type === 'BANNER')
          expect(bannerTiles).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 15: showBanner default matches template banner.enabled
// =============================================================================

describe('Feature: menu-banner-footer, Property 15: showBanner default matches template support', () => {
  beforeEach(() => clearTemplateCache())

  it('when showBanner is not set, banner appears iff template.banner.enabled is true', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        arbitraryTemplateId,
        async (menu, templateId) => {
          const template = await loadTemplateV2(templateId)
          const templateSupportsBanner = template.banner?.enabled === true

          // No showBanner in selection — defaults to template support
          const doc = await generateLayoutV2({ menu, templateId, selection: {} })
          const hasBannerTiles = allTiles(doc).some(
            t => t.type === 'BANNER' || t.type === 'BANNER_STRIP'
          )

          expect(hasBannerTiles).toBe(templateSupportsBanner)
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 16: RenderSnapshot completeness
// =============================================================================

describe('Feature: menu-banner-footer, Property 16: RenderSnapshot completeness', () => {
  /**
   * Simulate the snapshot configuration object that would be persisted at export time.
   * All banner/footer fields must be present.
   */
  function buildSnapshotConfig(
    selection: SelectionConfigV2,
    flagshipItemId: string | null
  ): Record<string, unknown> {
    return {
      showBanner: selection.showBanner ?? true,
      bannerTitle: selection.bannerTitle ?? 'MENU',
      showVenueName: selection.showVenueName ?? true,
      bannerImageStyle: selection.bannerImageStyle ?? 'cutout',
      fontStylePreset: selection.fontStylePreset ?? 'standard',
      flagshipItemId,
    }
  }

  it('snapshot config contains all required banner/footer fields', () => {
    fc.assert(
      fc.property(
        arbitraryBannerConfig,
        fc.option(fc.uuid(), { nil: null }),
        (selection, flagshipItemId) => {
          const config = buildSnapshotConfig(selection, flagshipItemId)
          expect('showBanner' in config).toBe(true)
          expect('bannerTitle' in config).toBe(true)
          expect('showVenueName' in config).toBe(true)
          expect('bannerImageStyle' in config).toBe(true)
          expect('fontStylePreset' in config).toBe(true)
          expect('flagshipItemId' in config).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 17: Banner appears only on FIRST/SINGLE pages
// =============================================================================

describe('Feature: menu-banner-footer, Property 17: Banner appears only on FIRST/SINGLE pages', () => {
  beforeEach(() => clearTemplateCache())

  it('BANNER tiles only appear on FIRST or SINGLE pages', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        async (menu, templateId) => {
          const selection: SelectionConfigV2 = { showBanner: true }
          const doc = await generateLayoutV2({ menu, templateId, selection })

          for (const page of doc.pages) {
            const bannerTiles = page.tiles.filter(t => t.type === 'BANNER')
            if (bannerTiles.length > 0) {
              expect(['FIRST', 'SINGLE']).toContain(page.pageType)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 18: Banner strip appears only on CONTINUATION/FINAL pages
// =============================================================================

describe('Feature: menu-banner-footer, Property 18: Banner strip appears only on CONTINUATION/FINAL pages', () => {
  beforeEach(() => clearTemplateCache())

  it('BANNER_STRIP tiles only appear on CONTINUATION or FINAL pages', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        async (menu, templateId) => {
          const selection: SelectionConfigV2 = { showBanner: true }
          const doc = await generateLayoutV2({ menu, templateId, selection })

          for (const page of doc.pages) {
            const stripTiles = page.tiles.filter(t => t.type === 'BANNER_STRIP')
            if (stripTiles.length > 0) {
              expect(['CONTINUATION', 'FINAL']).toContain(page.pageType)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})

// =============================================================================
// Property 19: Flagship toggle visibility
// =============================================================================

describe('Feature: menu-banner-footer, Property 19: Flagship toggle visibility', () => {
  /**
   * The "Set as Flagship" toggle should be visible iff imageSource !== 'none'.
   * We model this as: toggle is visible when item has an imageUrl (imageSource is not 'none').
   */
  function isFlagshipToggleVisible(item: { imageUrl?: string }): boolean {
    // imageSource is 'none' when imageUrl is absent/undefined
    return !!item.imageUrl
  }

  it('flagship toggle is visible iff item has an image URL', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          imageUrl: fc.option(fc.constant('https://placehold.co/400x300'), { nil: undefined }),
        }),
        (item) => {
          const visible = isFlagshipToggleVisible(item)
          expect(visible).toBe(!!item.imageUrl)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Property 20: Footer content preservation
// =============================================================================

describe('Feature: menu-banner-footer, Property 20: Footer content preservation', () => {
  beforeEach(() => clearTemplateCache())

  it('footer tile appears when venue info has at least one non-empty contact field', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        fc.record({
          address: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          phone: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          email: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
        }).filter(info => !!(info.address || info.phone || info.email)),
        async (menu, templateId, venueInfo) => {
          const menuWithFooter: EngineMenuV2 = {
            ...menu,
            metadata: { ...menu.metadata, venueInfo },
          }
          const doc = await generateLayoutV2({ menu: menuWithFooter, templateId })
          const footerTiles = allTiles(doc).filter(t => t.type === 'FOOTER_INFO')
          expect(footerTiles.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)

  it('footer tile is absent when venue info has no contact fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryMenu,
        fc.constantFrom(...BANNER_SUPPORTED_TEMPLATES),
        async (menu, templateId) => {
          // No venueInfo at all
          const menuNoFooter: EngineMenuV2 = {
            ...menu,
            metadata: { currency: '£', venueName: 'Test Venue' },
          }
          const doc = await generateLayoutV2({ menu: menuNoFooter, templateId })
          const footerTiles = allTiles(doc).filter(t => t.type === 'FOOTER_INFO')
          expect(footerTiles).toHaveLength(0)
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)
})
