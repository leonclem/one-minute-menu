/**
 * Unit Tests: Menu Banner & Footer
 * Feature: menu-banner-footer
 *
 * Covers:
 *  14.1 Banner tile creation with various config combinations
 *  14.2 getRestoredState mapping of new banner/footer fields with fallback defaults
 *  14.3 Template YAML banner config parsing for each of the 6 templates
 *  14.4 Footer background color derivation from palette
 *  14.5 Flagship uniqueness enforcement logic
 *  14.6 Banner title advisory note threshold (16+ characters)
 *  14.7 Font style preset Google Fonts URL generation
 *  14.8 RenderSnapshot includes all new banner/footer fields
 */

import {
  createBannerTile,
  createBannerStripTile,
  resolveBannerTitle,
  resolveBannerHeroImageUrl,
} from '../tile-placer'
import {
  FONT_STYLE_PRESETS,
  getFontStylePresetGoogleFontsUrl,
  renderTileContent,
  type ColorPaletteV2,
} from '../renderer-v2'
import { loadTemplateV2, clearTemplateCache } from '../template-loader-v2'
import type {
  EngineMenuV2,
  EngineItemV2,
  SelectionConfigV2,
  BannerContentV2,
  BannerStripContentV2,
  TileInstanceV2,
} from '../engine-types-v2'
import type { RenderSnapshot } from '@/types'

// =============================================================================
// Shared fixtures
// =============================================================================

const mockMenu: EngineMenuV2 = {
  id: 'menu-1',
  name: 'Test Menu',
  sections: [],
  metadata: {
    currency: '£',
    venueName: 'The Grand Bistro',
    logoUrl: 'https://example.com/logo.png',
  },
}

const mockMenuNoLogo: EngineMenuV2 = {
  ...mockMenu,
  metadata: { ...mockMenu.metadata, logoUrl: undefined },
}

const mockFlagshipItem: EngineItemV2 = {
  id: 'item-flagship',
  name: 'Signature Dish',
  price: 24.99,
  imageUrl: 'https://example.com/dish.jpg',
  cutoutUrl: 'https://example.com/dish-cutout.png',
  sortOrder: 0,
  indicators: { dietary: [], spiceLevel: null, allergens: [] },
}

const mockFlagshipItemNoCutout: EngineItemV2 = {
  ...mockFlagshipItem,
  cutoutUrl: undefined,
}

const baseSelection: SelectionConfigV2 = {
  showBanner: true,
  bannerTitle: 'BRUNCH',
  showVenueName: true,
  bannerImageStyle: 'cutout',
  fontStylePreset: 'standard',
}

// =============================================================================
// 14.1 Banner tile creation
// =============================================================================

describe('14.1 Banner tile creation', () => {
  const surfaceColor = '#F5F0E8'
  const textColor = '#1A1A1A'

  describe('resolveBannerTitle', () => {
    it('returns "MENU" for undefined', () => {
      expect(resolveBannerTitle(undefined)).toBe('MENU')
    })

    it('returns "MENU" for null', () => {
      expect(resolveBannerTitle(null)).toBe('MENU')
    })

    it('returns "MENU" for empty string', () => {
      expect(resolveBannerTitle('')).toBe('MENU')
    })

    it('returns "MENU" for whitespace-only string', () => {
      expect(resolveBannerTitle('   ')).toBe('MENU')
    })

    it('returns the provided title when non-empty', () => {
      expect(resolveBannerTitle('BRUNCH')).toBe('BRUNCH')
    })
  })

  describe('resolveBannerHeroImageUrl', () => {
    it('returns empty object when no flagship item', () => {
      const result = resolveBannerHeroImageUrl(undefined, 'cutout')
      expect(result).toEqual({})
    })

    it('returns empty object when bannerImageStyle is "none"', () => {
      const result = resolveBannerHeroImageUrl(mockFlagshipItem, 'none')
      expect(result).toEqual({})
    })

    it('returns both imageUrl and cutoutUrl for "cutout" style', () => {
      const result = resolveBannerHeroImageUrl(mockFlagshipItem, 'cutout')
      expect(result.heroImageUrl).toBe(mockFlagshipItem.imageUrl)
      expect(result.heroImageCutoutUrl).toBe(mockFlagshipItem.cutoutUrl)
    })

    it('returns only imageUrl for "stretch-fit" style', () => {
      const result = resolveBannerHeroImageUrl(mockFlagshipItem, 'stretch-fit')
      expect(result.heroImageUrl).toBe(mockFlagshipItem.imageUrl)
      expect(result.heroImageCutoutUrl).toBeUndefined()
    })

    it('handles flagship item with no cutoutUrl in "cutout" mode', () => {
      const result = resolveBannerHeroImageUrl(mockFlagshipItemNoCutout, 'cutout')
      expect(result.heroImageUrl).toBe(mockFlagshipItem.imageUrl)
      expect(result.heroImageCutoutUrl).toBeUndefined()
    })
  })

  describe('createBannerTile', () => {
    it('creates banner tile with correct type and region', () => {
      const tile = createBannerTile(mockMenu, baseSelection, 120, surfaceColor, textColor)
      expect(tile.type).toBe('BANNER')
      expect(tile.regionId).toBe('banner')
      expect(tile.height).toBe(120)
    })

    it('sets surfaceColor and textColor on content', () => {
      const tile = createBannerTile(mockMenu, baseSelection, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.surfaceColor).toBe(surfaceColor)
      expect(content.textColor).toBe(textColor)
    })

    it('uses resolved banner title', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, bannerTitle: 'DINNER' }, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.title).toBe('DINNER')
    })

    it('defaults banner title to "MENU" when not provided', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, bannerTitle: undefined }, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.title).toBe('MENU')
    })

    it('includes venueName when showVenueName is true and no logo', () => {
      const tile = createBannerTile(mockMenuNoLogo, { ...baseSelection, showVenueName: true }, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.showVenueName).toBe(true)
      expect(content.venueName).toBe('The Grand Bistro')
      expect(content.logoUrl).toBeUndefined()
    })

    it('includes logoUrl when showVenueName is true and logo is present', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, showVenueName: true }, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.showVenueName).toBe(true)
      expect(content.logoUrl).toBe('https://example.com/logo.png')
    })

    it('omits venueName and logoUrl when showVenueName is false', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, showVenueName: false }, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.showVenueName).toBe(false)
      expect(content.venueName).toBeUndefined()
      expect(content.logoUrl).toBeUndefined()
    })

    it('includes hero image for cutout style with flagship', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, bannerImageStyle: 'cutout' }, 120, surfaceColor, textColor, mockFlagshipItem)
      const content = tile.content as BannerContentV2
      expect(content.heroImageUrl).toBe(mockFlagshipItem.imageUrl)
      expect(content.heroImageCutoutUrl).toBe(mockFlagshipItem.cutoutUrl)
    })

    it('includes hero image for stretch-fit style with flagship', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, bannerImageStyle: 'stretch-fit' }, 120, surfaceColor, textColor, mockFlagshipItem)
      const content = tile.content as BannerContentV2
      expect(content.heroImageUrl).toBe(mockFlagshipItem.imageUrl)
      expect(content.heroImageCutoutUrl).toBeUndefined()
    })

    it('omits hero image when bannerImageStyle is "none"', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, bannerImageStyle: 'none' }, 120, surfaceColor, textColor, mockFlagshipItem)
      const content = tile.content as BannerContentV2
      expect(content.heroImageUrl).toBeUndefined()
      expect(content.heroImageCutoutUrl).toBeUndefined()
    })

    it('omits hero image when no flagship item', () => {
      const tile = createBannerTile(mockMenu, baseSelection, 120, surfaceColor, textColor, undefined)
      const content = tile.content as BannerContentV2
      expect(content.heroImageUrl).toBeUndefined()
      expect(content.heroImageCutoutUrl).toBeUndefined()
    })

    it('applies fontStylePreset from selection', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, fontStylePreset: 'fun' }, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.fontStylePreset).toBe('fun')
    })

    it('defaults fontStylePreset to "standard" when not provided', () => {
      const tile = createBannerTile(mockMenu, { ...baseSelection, fontStylePreset: undefined }, 120, surfaceColor, textColor)
      const content = tile.content as BannerContentV2
      expect(content.fontStylePreset).toBe('standard')
    })
  })

  describe('createBannerStripTile', () => {
    it('creates strip tile with correct type and region', () => {
      const tile = createBannerStripTile(mockMenu, 18, surfaceColor)
      expect(tile.type).toBe('BANNER_STRIP')
      expect(tile.regionId).toBe('banner')
      expect(tile.height).toBe(18)
    })

    it('sets surfaceColor on strip content', () => {
      const tile = createBannerStripTile(mockMenu, 18, surfaceColor)
      const content = tile.content as BannerStripContentV2
      expect(content.surfaceColor).toBe(surfaceColor)
    })

    it('strip content has no text or image fields', () => {
      const tile = createBannerStripTile(mockMenu, 18, surfaceColor)
      const content = tile.content as BannerStripContentV2
      expect(content.type).toBe('BANNER_STRIP')
      // Only surfaceColor — no title, venueName, heroImageUrl
      expect((content as any).title).toBeUndefined()
      expect((content as any).venueName).toBeUndefined()
      expect((content as any).heroImageUrl).toBeUndefined()
    })
  })
})

// =============================================================================
// 14.2 getRestoredState mapping
// =============================================================================

/**
 * getRestoredState is a pure function in template-client.tsx.
 * We replicate its logic here to unit-test the mapping without importing
 * the full Next.js client component.
 */

const BANNER_ENABLED_TEMPLATES = new Set([
  '4-column-portrait',
  '3-column-portrait',
  '2-column-portrait',
  '6-column-portrait-a3',
  '5-column-landscape',
  '1-column-tall',
])

function getRestoredState(savedTemplateId: string, config: Record<string, unknown>) {
  const mappedTemplateId =
    savedTemplateId === 'classic-grid-cards' || savedTemplateId === 'simple-rows' || savedTemplateId === 'classic-cards-v2' ? '4-column-portrait' :
    savedTemplateId === 'two-column-text' || savedTemplateId === 'italian-v2' ? '2-column-portrait' :
    savedTemplateId === 'three-column-modern-v2' ? '3-column-portrait' :
    savedTemplateId === 'half-a4-tall-v2' ? '1-column-tall' :
    savedTemplateId === 'classic-cards-v2-landscape' ? '5-column-landscape' :
    savedTemplateId || '4-column-portrait'

  const bannerEnabledByDefault = BANNER_ENABLED_TEMPLATES.has(mappedTemplateId)
  const showBanner = config.showBanner !== undefined ? config.showBanner === true : bannerEnabledByDefault
  const bannerTitle = typeof config.bannerTitle === 'string' && config.bannerTitle.length > 0
    ? config.bannerTitle
    : 'MENU'
  const showVenueName = config.showVenueName !== false
  const bannerImageStyle: 'cutout' | 'stretch-fit' | 'none' =
    config.bannerImageStyle === 'stretch-fit' ? 'stretch-fit' :
    config.bannerImageStyle === 'none' ? 'none' :
    'cutout'
  const fontStylePreset: 'strong' | 'fun' | 'standard' =
    config.fontStylePreset === 'strong' ? 'strong' :
    config.fontStylePreset === 'fun' ? 'fun' :
    'standard'
  const flagshipItemId = typeof config.flagshipItemId === 'string' ? config.flagshipItemId : null
  const showLogoTile = config.showLogoTile === true
  const showCategoryHeaderTiles = config.showCategoryHeaderTiles === true
  const showFlagshipTile = config.showFlagshipTile === true

  return {
    mappedTemplateId,
    showBanner,
    bannerTitle,
    showVenueName,
    bannerImageStyle,
    fontStylePreset,
    flagshipItemId,
    showLogoTile,
    showCategoryHeaderTiles,
    showFlagshipTile,
  }
}

describe('14.2 getRestoredState banner/footer field mapping', () => {
  describe('showBanner', () => {
    it('defaults to true for banner-enabled templates when not in config', () => {
      const r = getRestoredState('4-column-portrait', {})
      expect(r.showBanner).toBe(true)
    })

    it('defaults to true for 1-column-tall (banner now enabled)', () => {
      const r = getRestoredState('1-column-tall', {})
      expect(r.showBanner).toBe(true)
    })

    it('respects explicit showBanner: false in config', () => {
      const r = getRestoredState('4-column-portrait', { showBanner: false })
      expect(r.showBanner).toBe(false)
    })

    it('respects explicit showBanner: false in config for 1-column-tall', () => {
      const r = getRestoredState('1-column-tall', { showBanner: false })
      expect(r.showBanner).toBe(false)
    })
  })

  describe('bannerTitle', () => {
    it('defaults to "MENU" when not in config', () => {
      const r = getRestoredState('4-column-portrait', {})
      expect(r.bannerTitle).toBe('MENU')
    })

    it('defaults to "MENU" for empty string', () => {
      const r = getRestoredState('4-column-portrait', { bannerTitle: '' })
      expect(r.bannerTitle).toBe('MENU')
    })

    it('uses provided bannerTitle', () => {
      const r = getRestoredState('4-column-portrait', { bannerTitle: 'LUNCH' })
      expect(r.bannerTitle).toBe('LUNCH')
    })
  })

  describe('showVenueName', () => {
    it('defaults to true when not in config', () => {
      const r = getRestoredState('4-column-portrait', {})
      expect(r.showVenueName).toBe(true)
    })

    it('is false when explicitly set to false', () => {
      const r = getRestoredState('4-column-portrait', { showVenueName: false })
      expect(r.showVenueName).toBe(false)
    })
  })

  describe('bannerImageStyle', () => {
    it('defaults to "cutout" when not in config', () => {
      const r = getRestoredState('4-column-portrait', {})
      expect(r.bannerImageStyle).toBe('cutout')
    })

    it('maps "stretch-fit" correctly', () => {
      const r = getRestoredState('4-column-portrait', { bannerImageStyle: 'stretch-fit' })
      expect(r.bannerImageStyle).toBe('stretch-fit')
    })

    it('maps "none" correctly', () => {
      const r = getRestoredState('4-column-portrait', { bannerImageStyle: 'none' })
      expect(r.bannerImageStyle).toBe('none')
    })

    it('falls back to "cutout" for invalid value', () => {
      const r = getRestoredState('4-column-portrait', { bannerImageStyle: 'invalid-value' })
      expect(r.bannerImageStyle).toBe('cutout')
    })
  })

  describe('fontStylePreset', () => {
    it('defaults to "standard" when not in config', () => {
      const r = getRestoredState('4-column-portrait', {})
      expect(r.fontStylePreset).toBe('standard')
    })

    it('maps "strong" correctly', () => {
      const r = getRestoredState('4-column-portrait', { fontStylePreset: 'strong' })
      expect(r.fontStylePreset).toBe('strong')
    })

    it('maps "fun" correctly', () => {
      const r = getRestoredState('4-column-portrait', { fontStylePreset: 'fun' })
      expect(r.fontStylePreset).toBe('fun')
    })

    it('falls back to "standard" for invalid value', () => {
      const r = getRestoredState('4-column-portrait', { fontStylePreset: 'comic-sans' })
      expect(r.fontStylePreset).toBe('standard')
    })
  })

  describe('flagshipItemId', () => {
    it('returns null when not in config', () => {
      const r = getRestoredState('4-column-portrait', {})
      expect(r.flagshipItemId).toBeNull()
    })

    it('returns the string ID when present', () => {
      const r = getRestoredState('4-column-portrait', { flagshipItemId: 'item-abc-123' })
      expect(r.flagshipItemId).toBe('item-abc-123')
    })

    it('returns null for non-string values', () => {
      const r = getRestoredState('4-column-portrait', { flagshipItemId: 42 })
      expect(r.flagshipItemId).toBeNull()
    })
  })

  describe('feature tile toggles', () => {
    it('default to false when not in config', () => {
      const r = getRestoredState('4-column-portrait', {})
      expect(r.showLogoTile).toBe(false)
      expect(r.showCategoryHeaderTiles).toBe(false)
      expect(r.showFlagshipTile).toBe(false)
    })

    it('restore explicit true values', () => {
      const r = getRestoredState('4-column-portrait', {
        showLogoTile: true,
        showCategoryHeaderTiles: true,
        showFlagshipTile: true,
      })
      expect(r.showLogoTile).toBe(true)
      expect(r.showCategoryHeaderTiles).toBe(true)
      expect(r.showFlagshipTile).toBe(true)
    })
  })

  describe('legacy template ID mapping', () => {
    it('maps classic-cards-v2 to 4-column-portrait', () => {
      const r = getRestoredState('classic-cards-v2', {})
      expect(r.mappedTemplateId).toBe('4-column-portrait')
      expect(r.showBanner).toBe(true)
    })

    it('maps half-a4-tall-v2 to 1-column-tall', () => {
      const r = getRestoredState('half-a4-tall-v2', {})
      expect(r.mappedTemplateId).toBe('1-column-tall')
      expect(r.showBanner).toBe(true)
    })
  })
})

// =============================================================================
// 14.3 Template YAML banner config parsing
// =============================================================================

describe('14.3 Template YAML banner config parsing', () => {
  beforeEach(() => clearTemplateCache())

  it('4-column-portrait: enabled=true, heightPt=120, stripHeightPt=18', async () => {
    const t = await loadTemplateV2('4-column-portrait')
    expect(t.banner).toBeDefined()
    expect(t.banner!.enabled).toBe(true)
    expect(t.banner!.heightPt).toBe(120)
    expect(t.banner!.stripHeightPt).toBe(18)
  })

  it('3-column-portrait: enabled=true, heightPt=120, stripHeightPt=18', async () => {
    const t = await loadTemplateV2('3-column-portrait')
    expect(t.banner).toBeDefined()
    expect(t.banner!.enabled).toBe(true)
    expect(t.banner!.heightPt).toBe(120)
    expect(t.banner!.stripHeightPt).toBe(18)
  })

  it('2-column-portrait: enabled=true, heightPt=90, stripHeightPt=16', async () => {
    const t = await loadTemplateV2('2-column-portrait')
    expect(t.banner).toBeDefined()
    expect(t.banner!.enabled).toBe(true)
    expect(t.banner!.heightPt).toBe(90)
    expect(t.banner!.stripHeightPt).toBe(16)
  })

  it('6-column-portrait-a3: enabled=true, heightPt=200, stripHeightPt=20', async () => {
    const t = await loadTemplateV2('6-column-portrait-a3')
    expect(t.banner).toBeDefined()
    expect(t.banner!.enabled).toBe(true)
    expect(t.banner!.heightPt).toBe(200)
    expect(t.banner!.stripHeightPt).toBe(20)
  })

  it('5-column-landscape: enabled=true, heightPt=65, stripHeightPt=15', async () => {
    const t = await loadTemplateV2('5-column-landscape')
    expect(t.banner).toBeDefined()
    expect(t.banner!.enabled).toBe(true)
    expect(t.banner!.heightPt).toBe(65)
    expect(t.banner!.stripHeightPt).toBe(15)
  })

  it('1-column-tall: enabled=true, heightPt=55, stripHeightPt=12', async () => {
    const t = await loadTemplateV2('1-column-tall')
    expect(t.banner).toBeDefined()
    expect(t.banner!.enabled).toBe(true)
    expect(t.banner!.heightPt).toBe(55)
    expect(t.banner!.stripHeightPt).toBe(12)
  })
})

// =============================================================================
// 14.4 Footer background color derivation from palette
// =============================================================================

describe('14.4 Footer background color derivation from palette', () => {
  /**
   * renderFooterInfoContent uses:
   *   bgColor = tileStyle?.background?.color || palette.colors.surface || palette.colors.background
   * We test the fallback chain by inspecting the background element in the rendered output.
   */

  const baseTile = {
    id: 'footer-1',
    type: 'FOOTER_INFO' as const,
    regionId: 'footer' as const,
    x: 0,
    y: 0,
    width: 400,
    height: 50,
    colSpan: 1,
    rowSpan: 1,
    gridRow: 0,
    gridCol: 0,
    layer: 'content' as const,
    content: {
      type: 'FOOTER_INFO' as const,
      address: '123 Main St',
      phone: '555-1234',
    },
  } satisfies TileInstanceV2

  const paletteWithSurface: ColorPaletteV2 = {
    id: 'test-surface',
    name: 'Test Surface',
    colors: {
      background: '#FFFFFF',
      surface: '#F0EAD6',
      menuTitle: '#1A1A1A',
      sectionHeader: '#333333',
      itemTitle: '#444444',
      itemDescription: '#666666',
      itemPrice: '#222222',
      accent: '#C0392B',
      itemIndicators: { background: '#FFFFFF' },
      border: { light: '#E0E0E0', medium: '#BDBDBD' },
      textMuted: '#777777',
      bannerSurface: '#F0EAD6',
      bannerText: '#1A1A1A',
      footerBorder: '#E0E0E0',
      footerText: '#1A1A1A',
      promoted: {
        featured: { background: '#F8EFD8', border: '#C0392B', badgeFill: '#C0392B', badgeText: '#FFFFFF' },
        flagship: { background: '#EEE2C6', border: '#8F3A20', badgeFill: '#7A3019', badgeText: '#FFF9E8', price: '#6C2B18' },
      },
    },
  }

  const paletteWithoutSurface: ColorPaletteV2 = {
    id: 'test-no-surface',
    name: 'Test No Surface',
    colors: {
      background: '#FAFAFA',
      surface: undefined as any,
      menuTitle: '#1A1A1A',
      sectionHeader: '#333333',
      itemTitle: '#444444',
      itemDescription: '#666666',
      itemPrice: '#222222',
      accent: '#C0392B',
      itemIndicators: { background: '#FAFAFA' },
      border: { light: '#E0E0E0', medium: '#BDBDBD' },
      textMuted: '#777777',
      bannerSurface: '#FAFAFA',
      bannerText: '#1A1A1A',
      footerBorder: '#E0E0E0',
      footerText: '#1A1A1A',
      promoted: {
        featured: { background: '#F2EBE1', border: '#C0392B', badgeFill: '#C0392B', badgeText: '#FFFFFF' },
        flagship: { background: '#E7DDD1', border: '#8F3A20', badgeFill: '#7A3019', badgeText: '#FFF9E8', price: '#6C2B18' },
      },
    },
  }

  it('uses palette.colors.surface as footer background when present', () => {
    const result = renderTileContent(baseTile, { palette: paletteWithSurface })
    const bgElement = result.elements.find(
      el => el.type === 'background' && el.width === baseTile.width && el.height === baseTile.height * 3
    )
    expect(bgElement).toBeDefined()
    expect(bgElement!.style?.backgroundColor).toBe('#F0EAD6')
  })

  it('falls back to palette.colors.background when surface is absent', () => {
    const result = renderTileContent(baseTile, { palette: paletteWithoutSurface })
    const bgElement = result.elements.find(
      el => el.type === 'background' && el.width === baseTile.width && el.height === baseTile.height * 3
    )
    expect(bgElement).toBeDefined()
    expect(bgElement!.style?.backgroundColor).toBe('#FAFAFA')
  })

  it('footer background opacity is 1.0', () => {
    const result = renderTileContent(baseTile, { palette: paletteWithSurface })
    const bgElement = result.elements.find(
      el => el.type === 'background' && el.width === baseTile.width && el.height === baseTile.height * 3
    )
    expect(bgElement!.style?.opacity).toBe(1)
  })

  it('footer text uses palette.colors.footerText color', () => {
    const result = renderTileContent(baseTile, { palette: paletteWithSurface })
    const textElements = result.elements.filter(el => el.type === 'text')
    expect(textElements.length).toBeGreaterThan(0)
    textElements.forEach(el => {
      expect(el.style?.color).toBe('#1A1A1A')
    })
  })

  it('palette.colors.bannerSurface takes priority over content.surfaceColor', () => {
    const tileWithSurfaceColor = {
      ...baseTile,
      content: { ...baseTile.content, surfaceColor: '#A0522D' },
    } satisfies TileInstanceV2
    const result = renderTileContent(tileWithSurfaceColor, { palette: paletteWithSurface })
    const bgElement = result.elements.find(
      el => el.type === 'background' && el.width === baseTile.width && el.height === baseTile.height * 3
    )
    expect(bgElement).toBeDefined()
    // The live palette bannerSurface should win so palette changes are reflected instantly
    expect(bgElement!.style?.backgroundColor).toBe(paletteWithSurface.colors.bannerSurface)
  })

  it('falls back to content.surfaceColor when no palette is provided', () => {
    const tileWithSurfaceColor = {
      ...baseTile,
      content: { ...baseTile.content, surfaceColor: '#A0522D' },
    } satisfies TileInstanceV2
    const result = renderTileContent(tileWithSurfaceColor, {})
    const bgElement = result.elements.find(
      el => el.type === 'background' && el.width === baseTile.width && el.height === baseTile.height * 3
    )
    expect(bgElement).toBeDefined()
    expect(bgElement!.style?.backgroundColor).toBe('#A0522D')
  })
})

// =============================================================================
// 14.5 Flagship uniqueness enforcement
// =============================================================================

describe('14.5 Flagship uniqueness enforcement logic', () => {
  /**
   * The API route enforces uniqueness via two Supabase calls:
   *   1. Clear is_flagship on all items in the menu except the new flagship
   *   2. Set is_flagship on the new flagship item
   *
   * We test the logic by simulating the in-memory state transitions that
   * the API route produces, without hitting the database.
   */

  interface MockMenuItem {
    id: string
    menu_id: string
    is_flagship: boolean
  }

  function simulateSetFlagship(items: MockMenuItem[], menuId: string, targetItemId: string): MockMenuItem[] {
    // Mirrors the API route logic:
    // 1. Clear existing flagship for this menu (all items except target)
    // 2. Set flagship on target item
    return items.map(item => {
      if (item.menu_id !== menuId) return item
      if (item.id === targetItemId) return { ...item, is_flagship: true }
      return { ...item, is_flagship: false }
    })
  }

  function simulateClearFlagship(items: MockMenuItem[], menuId: string, targetItemId: string): MockMenuItem[] {
    return items.map(item => {
      if (item.menu_id === menuId && item.id === targetItemId) {
        return { ...item, is_flagship: false }
      }
      return item
    })
  }

  const menuId = 'menu-1'
  const initialItems: MockMenuItem[] = [
    { id: 'item-a', menu_id: menuId, is_flagship: false },
    { id: 'item-b', menu_id: menuId, is_flagship: false },
    { id: 'item-c', menu_id: menuId, is_flagship: false },
  ]

  it('setting a flagship results in exactly one flagship item', () => {
    const result = simulateSetFlagship(initialItems, menuId, 'item-b')
    const flagships = result.filter(i => i.is_flagship)
    expect(flagships).toHaveLength(1)
    expect(flagships[0].id).toBe('item-b')
  })

  it('setting a new flagship clears the previous one', () => {
    const afterFirst = simulateSetFlagship(initialItems, menuId, 'item-a')
    const afterSecond = simulateSetFlagship(afterFirst, menuId, 'item-c')

    const flagships = afterSecond.filter(i => i.is_flagship)
    expect(flagships).toHaveLength(1)
    expect(flagships[0].id).toBe('item-c')
    expect(afterSecond.find(i => i.id === 'item-a')!.is_flagship).toBe(false)
  })

  it('removing flagship leaves zero flagship items', () => {
    const withFlagship = simulateSetFlagship(initialItems, menuId, 'item-b')
    const afterRemoval = simulateClearFlagship(withFlagship, menuId, 'item-b')

    const flagships = afterRemoval.filter(i => i.is_flagship)
    expect(flagships).toHaveLength(0)
  })

  it('does not affect items from other menus', () => {
    const otherMenuItems: MockMenuItem[] = [
      { id: 'item-x', menu_id: 'menu-2', is_flagship: true },
    ]
    const allItems = [...initialItems, ...otherMenuItems]
    const result = simulateSetFlagship(allItems, menuId, 'item-a')

    // Other menu's flagship should be untouched
    expect(result.find(i => i.id === 'item-x')!.is_flagship).toBe(true)
  })
})

// =============================================================================
// 14.6 Banner title advisory note threshold
// =============================================================================

describe('14.6 Banner title advisory note threshold', () => {
  /**
   * The template page shows an advisory note when bannerTitle.length >= 16.
   * We test the threshold logic directly.
   */
  function shouldShowAdvisoryNote(title: string): boolean {
    return title.length >= 16
  }

  it('does not show advisory note for title of 15 characters', () => {
    expect(shouldShowAdvisoryNote('A'.repeat(15))).toBe(false)
  })

  it('shows advisory note at exactly 16 characters', () => {
    expect(shouldShowAdvisoryNote('A'.repeat(16))).toBe(true)
  })

  it('shows advisory note for title longer than 16 characters', () => {
    expect(shouldShowAdvisoryNote('SUNDAY BRUNCH SPECIAL')).toBe(true)
  })

  it('does not show advisory note for short titles', () => {
    expect(shouldShowAdvisoryNote('MENU')).toBe(false)
    expect(shouldShowAdvisoryNote('BRUNCH')).toBe(false)
    expect(shouldShowAdvisoryNote('DINNER MENU')).toBe(false)
  })

  it('does not show advisory note for empty string', () => {
    expect(shouldShowAdvisoryNote('')).toBe(false)
  })

  it('shows advisory note at max length (30 characters)', () => {
    expect(shouldShowAdvisoryNote('A'.repeat(30))).toBe(true)
  })
})

// =============================================================================
// 14.7 Font style preset Google Fonts URL generation
// =============================================================================

describe('14.7 Font style preset Google Fonts URL generation', () => {
  it('"strong" preset returns a valid Google Fonts URL for Anton', () => {
    const url = getFontStylePresetGoogleFontsUrl('strong')
    expect(url).toContain('https://fonts.googleapis.com/css2?family=')
    expect(url).toContain('Anton')
    expect(url).toContain('display=swap')
  })

  it('"fun" preset returns a valid Google Fonts URL for Caveat', () => {
    const url = getFontStylePresetGoogleFontsUrl('fun')
    expect(url).toContain('https://fonts.googleapis.com/css2?family=')
    expect(url).toContain('Caveat')
    expect(url).toContain('display=swap')
  })

  it('"standard" preset returns a valid Google Fonts URL for Oswald', () => {
    const url = getFontStylePresetGoogleFontsUrl('standard')
    expect(url).toContain('https://fonts.googleapis.com/css2?family=')
    expect(url).toContain('Oswald')
    expect(url).toContain('display=swap')
  })

  it('FONT_STYLE_PRESETS registry has all three presets', () => {
    expect(FONT_STYLE_PRESETS.strong).toBeDefined()
    expect(FONT_STYLE_PRESETS.fun).toBeDefined()
    expect(FONT_STYLE_PRESETS.standard).toBeDefined()
  })

  it('each preset has non-empty bannerTitleFamily and sectionHeaderFamily', () => {
    for (const preset of ['strong', 'fun', 'standard'] as const) {
      expect(FONT_STYLE_PRESETS[preset].bannerTitleFamily.length).toBeGreaterThan(0)
      expect(FONT_STYLE_PRESETS[preset].sectionHeaderFamily.length).toBeGreaterThan(0)
    }
  })

  it('"fun" preset googleFonts param includes weight variants', () => {
    expect(FONT_STYLE_PRESETS.fun.googleFonts).toContain('wght@')
  })

  it('"standard" preset googleFonts param includes weight variants', () => {
    expect(FONT_STYLE_PRESETS.standard.googleFonts).toContain('wght@')
  })
})

// =============================================================================
// 14.8 RenderSnapshot includes all new banner/footer fields
// =============================================================================

describe('14.8 RenderSnapshot includes all new banner/footer fields', () => {
  /**
   * Verify that the RenderSnapshot.configuration type accepts all banner/footer
   * fields and that a fully-populated snapshot object satisfies the interface.
   */

  it('RenderSnapshot.configuration accepts banner/footer and feature-tile fields', () => {
    const snapshot: RenderSnapshot = {
      template_id: 'tmpl-uuid-123',
      template_version: '2.0.0',
      template_name: '4 column (portrait)',
      configuration: {
        palette: { id: 'warm-earth' },
        typography: null,
        layout: null,
        textures: null,
        features: null,
        showBanner: true,
        bannerTitle: 'BRUNCH',
        showVenueName: true,
        bannerImageStyle: 'cutout',
        fontStylePreset: 'standard',
        flagshipItemId: 'item-abc-123',
        showLogoTile: true,
        showCategoryHeaderTiles: true,
        showFlagshipTile: true,
      },
      menu_data: {
        id: 'menu-1',
        name: 'Test Menu',
        items: [],
      },
      export_options: { format: 'A4', orientation: 'portrait' },
      snapshot_created_at: new Date().toISOString(),
      snapshot_version: '1.0',
    }

    expect(snapshot.configuration?.showBanner).toBe(true)
    expect(snapshot.configuration?.bannerTitle).toBe('BRUNCH')
    expect(snapshot.configuration?.showVenueName).toBe(true)
    expect(snapshot.configuration?.bannerImageStyle).toBe('cutout')
    expect(snapshot.configuration?.fontStylePreset).toBe('standard')
    expect(snapshot.configuration?.flagshipItemId).toBe('item-abc-123')
    expect(snapshot.configuration?.showLogoTile).toBe(true)
    expect(snapshot.configuration?.showCategoryHeaderTiles).toBe(true)
    expect(snapshot.configuration?.showFlagshipTile).toBe(true)
  })

  it('RenderSnapshot.configuration allows flagshipItemId to be null', () => {
    const snapshot: RenderSnapshot = {
      template_id: 'tmpl-uuid-123',
      template_version: '2.0.0',
      template_name: '4 column (portrait)',
      configuration: {
        showBanner: false,
        bannerTitle: 'MENU',
        showVenueName: false,
        bannerImageStyle: 'none',
        fontStylePreset: 'strong',
        flagshipItemId: null,
      },
      menu_data: { id: 'menu-1', name: 'Test Menu', items: [] },
      export_options: {},
      snapshot_created_at: new Date().toISOString(),
      snapshot_version: '1.0',
    }

    expect(snapshot.configuration?.flagshipItemId).toBeNull()
  })

  it('RenderSnapshot.configuration allows banner/footer and feature-tile fields to be undefined (optional)', () => {
    const snapshot: RenderSnapshot = {
      template_id: 'tmpl-uuid-123',
      template_version: '2.0.0',
      template_name: '4 column (portrait)',
      configuration: {},
      menu_data: { id: 'menu-1', name: 'Test Menu', items: [] },
      export_options: {},
      snapshot_created_at: new Date().toISOString(),
      snapshot_version: '1.0',
    }

    expect(snapshot.configuration?.showBanner).toBeUndefined()
    expect(snapshot.configuration?.bannerTitle).toBeUndefined()
    expect(snapshot.configuration?.showVenueName).toBeUndefined()
    expect(snapshot.configuration?.bannerImageStyle).toBeUndefined()
    expect(snapshot.configuration?.fontStylePreset).toBeUndefined()
    expect(snapshot.configuration?.flagshipItemId).toBeUndefined()
  })

  it('all persisted banner/footer and feature-tile fields are present in a fully-populated configuration', () => {
    const config: RenderSnapshot['configuration'] = {
      showBanner: true,
      bannerTitle: 'DINNER',
      showVenueName: true,
      bannerImageStyle: 'stretch-fit',
      fontStylePreset: 'fun',
      flagshipItemId: 'item-xyz',
      showLogoTile: true,
      showCategoryHeaderTiles: true,
      showFlagshipTile: true,
    }

    const requiredFields = [
      'showBanner',
      'bannerTitle',
      'showVenueName',
      'bannerImageStyle',
      'fontStylePreset',
      'flagshipItemId',
      'showLogoTile',
      'showCategoryHeaderTiles',
      'showFlagshipTile',
    ]
    for (const field of requiredFields) {
      expect(config).toHaveProperty(field)
    }
  })
})
