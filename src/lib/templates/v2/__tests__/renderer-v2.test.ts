/**
 * V2 Renderer Tests
 * 
 * Basic tests to verify the renderer components work correctly.
 * These tests validate the core rendering functionality without requiring
 * a full layout engine setup.
 */

import { 
  renderTileContent, 
  getDefaultScale,
  getFeaturedStarBadgeMetrics,
  getPopularBadgeMetrics,
  TYPOGRAPHY_TOKENS_V2,
  COLOR_TOKENS_V2,
  SPACING_V2,
  TEXTURE_REGISTRY,
  FILLER_PATTERN_REGISTRY,
  FILLER_PATTERN_IDS,
  SPACER_BLANK_ID,
  PALETTES_V2,
  DEFAULT_PALETTE_V2,
  BG_IMAGE_TEXT,
  FONT_STYLE_PRESETS,
  lightenHexForDarkBackground,
  type RenderOptionsV2 
} from '../renderer-v2'
import type { 
  TileInstanceV2, 
  LogoContentV2, 
  TitleContentV2, 
  ItemContentV2,
  SectionHeaderContentV2,
  FooterInfoContentV2,
  FeatureCardContentV2,
  FlagshipCardContentV2,
  FillerContentV2,
  TileStyleV2
} from '../engine-types-v2'

describe('V2 Renderer', () => {
  const defaultOptions: RenderOptionsV2 = {
    scale: 1.0,
    showGridOverlay: false,
    showRegionBounds: false,
    showTileIds: false
  }

  describe('renderTileContent', () => {
    it('should render logo tile content', () => {
      const tile: TileInstanceV2 = {
        id: 'logo-1',
        type: 'LOGO',
        regionId: 'header',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'LOGO',
          imageUrl: 'https://example.com/logo.png',
          venueName: 'Test Restaurant'
        } as LogoContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      
      expect(result.elements).toHaveLength(1)
      expect(result.elements[0].type).toBe('image')
      expect(result.elements[0].content).toBe('https://example.com/logo.png')
    })

    it('should render title tile content', () => {
      const tile: TileInstanceV2 = {
        id: 'title-1',
        type: 'TITLE',
        regionId: 'title',
        x: 0,
        y: 0,
        width: 400,
        height: 40,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'TITLE',
          menuName: 'Dinner Menu'
        } as TitleContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      
      expect(result.elements).toHaveLength(1)
      expect(result.elements[0].type).toBe('text')
      expect(result.elements[0].content).toBe('Dinner Menu')
      expect(result.elements[0].style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize['3xl'])
    })

    it('should render item tile content with indicators', () => {
      const tile: TileInstanceV2 = {
        id: 'item-1',
        type: 'ITEM_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 148,
        colSpan: 1,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-1',
          sectionId: 'section-1',
          name: 'Margherita Pizza',
          description: 'Fresh tomatoes, mozzarella, basil',
          price: 12.99,
          imageUrl: 'https://example.com/pizza.jpg',
          showImage: true,
          currency: '$',
          indicators: {
            dietary: ['vegetarian'],
            spiceLevel: null,
            allergens: ['dairy']
          }
        } as ItemContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      
      // Should have image, name, price, description, and indicators
      expect(result.elements.length).toBeGreaterThan(3)
      
      // Check for image element
      const imageElement = result.elements.find(e => e.type === 'image')
      expect(imageElement).toBeDefined()
      expect(imageElement?.content).toBe('https://example.com/pizza.jpg')
      
      // Check for text elements (name, price, description)
      const textElements = result.elements.filter(e => e.type === 'text')
      expect(textElements.length).toBeGreaterThanOrEqual(3)
      
      // Check for indicator elements
      const indicatorElements = result.elements.filter(e => e.type === 'indicator')
      expect(indicatorElements.length).toBeGreaterThan(0)
    })

    it.each(['stretch', 'cutout'] as const)(
      'preserves two description lines before extra name lines in %s item cards',
      (imageMode) => {
        const description = 'A cosmic dish with bright flavours, layered spice, and a long finish'
        const tile: TileInstanceV2 = {
          id: `compact-${imageMode}-item`,
          type: 'ITEM_CARD',
          regionId: 'body',
          x: 0,
          y: 0,
          width: 130,
          height: 134,
          colSpan: 1,
          rowSpan: 2,
          gridRow: 0,
          gridCol: 0,
          layer: 'content',
          contentBudget: {
            nameLines: 1,
            descLines: 2,
            indicatorAreaHeight: 16,
            imageBoxHeight: 60,
            paddingTop: 6,
            paddingBottom: 6,
            totalHeight: 134,
          },
          content: {
            type: 'ITEM_CARD',
            itemId: 'compact-item',
            sectionId: 'section-1',
            name: 'Galactic Mac and Cheese',
            description,
            price: 14,
            imageUrl: 'https://example.com/item.jpg',
            showImage: true,
            currency: 'USD',
            indicators: {
              dietary: [],
              spiceLevel: null,
              allergens: [],
            },
          } as ItemContentV2,
        }

        const result = renderTileContent(tile, {
          ...defaultOptions,
          imageMode,
          palette: PALETTES_V2.find(p => p.id === 'galactic-menu'),
        })

        const nameElement = result.elements.find(element => element.type === 'text' && element.content === 'Galactic Mac and Cheese')
        const descElement = result.elements.find(element => element.type === 'text' && element.content === description)

        expect(nameElement?.style.maxLines).toBe(1)
        expect(descElement?.style.maxLines).toBe(2)
      }
    )

    it('should render flagship cards as side-by-side layouts in non-background modes', () => {
      const tile: TileInstanceV2 = {
        id: 'flagship-1',
        type: 'FLAGSHIP_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 360,
        height: 148,
        colSpan: 2,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        contentBudget: {
          nameLines: 2,
          descLines: 4,
          indicatorAreaHeight: 16,
          imageBoxHeight: 84,
          paddingTop: 8,
          paddingBottom: 8,
          totalHeight: 148,
        },
        content: {
          type: 'FLAGSHIP_CARD',
          itemId: 'flagship-1',
          sectionId: 'section-1',
          name: 'Braised Lamb',
          description: 'Slow cooked shoulder with herbs and charred vegetables.',
          price: 24,
          imageUrl: 'https://example.com/special.jpg',
          showImage: true,
          currency: 'USD',
          indicators: { dietary: ['gluten-free'], spiceLevel: 1, allergens: [] },
        } as FlagshipCardContentV2,
      }

      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'stretch' })
      const imageEl = result.elements.find((element) => element.type === 'image')
      const nameEl = result.elements.find((element) => element.type === 'text' && element.content === 'Braised Lamb')
      const badgeEl = result.elements.find((element) => element.type === 'text' && element.content === 'House Special')
      const bgEls = result.elements.filter((element) => element.type === 'background')

      expect(bgEls.length).toBeGreaterThanOrEqual(2)
      expect(imageEl).toBeDefined()
      expect(nameEl).toBeDefined()
      expect(badgeEl).toBeDefined()
      expect(imageEl!.width).toBeLessThan(tile.width)
      expect(imageEl!.x).toBe(7)
      expect(imageEl!.y).toBe(7)
      expect(imageEl!.height).toBe(tile.height - 14)
      // Name should clear the badge bottom with a small visual gap.
      expect(nameEl!.y).toBeGreaterThanOrEqual((badgeEl!.y ?? 0) + (badgeEl!.height ?? 0) + 4)
      expect(nameEl!.x).toBeGreaterThan((imageEl!.x + (imageEl!.width ?? 0)))
    })

    it('should honor palette-owned flagship colors and YAML badge settings', () => {
      const tile: TileInstanceV2 = {
        id: 'flagship-custom',
        type: 'FLAGSHIP_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 360,
        height: 148,
        colSpan: 2,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        contentBudget: {
          nameLines: 2,
          descLines: 4,
          indicatorAreaHeight: 16,
          imageBoxHeight: 84,
          paddingTop: 8,
          paddingBottom: 8,
          totalHeight: 148,
        },
        style: {
          border: { width: 5 },
          badge: { label: 'Editor Choice', position: 'right', borderRadius: 9 },
        },
        content: {
          type: 'FLAGSHIP_CARD',
          itemId: 'flagship-custom',
          sectionId: 'section-1',
          name: 'Custom Flagship',
          description: 'Seasonal signature dish.',
          price: 29,
          imageUrl: 'https://example.com/custom.jpg',
          showImage: true,
          currency: 'USD',
          indicators: { dietary: [], spiceLevel: null, allergens: [] },
        } as FlagshipCardContentV2,
      }

      const result = renderTileContent(tile, {
        ...defaultOptions,
        imageMode: 'stretch',
        palette: {
          id: 'custom',
          name: 'Custom',
          colors: {
            background: '#FFFFFF',
            surface: '#F7F4EC',
            menuTitle: '#111111',
            sectionHeader: '#111111',
            itemTitle: '#111111',
            itemPrice: '#5C3D00',
            itemDescription: '#555555',
            itemIndicators: { background: '#FFFFFF' },
            border: { light: '#E5E7EB', medium: '#D1D5DB' },
            textMuted: '#888888',
            bannerSurface: '#F7F4EC',
            bannerText: '#111111',
            footerBorder: '#E5E7EB',
            footerText: '#111111',
            promoted: {
              featured: { background: '#EEE8D5', border: '#8C6A11', badgeFill: '#234F1E', badgeText: '#FFFDEA' },
              flagship: { background: '#EEF5E8', border: '#2F5E2A', badgeFill: '#234F1E', badgeText: '#FFFDEA', price: '#315B2C' },
            },
          },
        },
      })
      const frameEl = result.elements.find((element) => element.type === 'background' && element.style.backgroundColor === '#2F5E2A')
      const panelEl = result.elements.find((element) => element.type === 'background' && element.style.backgroundColor === '#EEF5E8')
      const badgeEl = result.elements.find((element) => element.type === 'text' && element.content === 'Editor Choice')

      expect(frameEl).toBeDefined()
      expect(panelEl).toBeDefined()
      expect(badgeEl?.style.backgroundColor).toBe('#234F1E')
      expect(badgeEl?.style.color).toBe('#FFFDEA')
    })

    it('should honor explicit flagship title font size from template typography', () => {
      const tile: TileInstanceV2 = {
        id: 'flagship-typed',
        type: 'FLAGSHIP_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 360,
        height: 148,
        colSpan: 2,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        style: {
          typography: {
            name: {
              fontSet: 'system-sans',
              fontSize: 'smd',
              fontWeight: 'bold',
              textTransform: 'capitalize',
            },
          },
        },
        contentBudget: {
          nameLines: 2,
          descLines: 4,
          indicatorAreaHeight: 16,
          imageBoxHeight: 84,
          paddingTop: 8,
          paddingBottom: 8,
          totalHeight: 148,
        },
        content: {
          type: 'FLAGSHIP_CARD',
          itemId: 'flagship-typed',
          sectionId: 'section-1',
          name: 'Custom Flagship',
          description: 'Seasonal signature dish.',
          price: 29,
          imageUrl: 'https://example.com/custom.jpg',
          showImage: true,
          currency: 'USD',
          indicators: { dietary: [], spiceLevel: null, allergens: [] },
        } as FlagshipCardContentV2,
      }

      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'stretch' })
      const nameEl = result.elements.find((element) => element.type === 'text' && element.content === 'Custom Flagship')

      expect(nameEl?.style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.smd)
    })

    it('should render flagship cards with full-bleed background treatment in background mode', () => {
      const tile: TileInstanceV2 = {
        id: 'flagship-bg',
        type: 'FLAGSHIP_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 360,
        height: 148,
        colSpan: 2,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        contentBudget: {
          nameLines: 2,
          descLines: 4,
          indicatorAreaHeight: 16,
          imageBoxHeight: 84,
          paddingTop: 8,
          paddingBottom: 8,
          totalHeight: 148,
        },
        content: {
          type: 'FLAGSHIP_CARD',
          itemId: 'flagship-bg',
          sectionId: 'section-1',
          name: 'Smoked Brisket',
          description: 'Oak smoked brisket with pickled onions.',
          price: 28,
          imageUrl: 'https://example.com/brisket.jpg',
          showImage: true,
          currency: 'USD',
          indicators: { dietary: [], spiceLevel: null, allergens: [] },
        } as FlagshipCardContentV2,
      }

      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'background' })
      const imageEl = result.elements.find((element) => element.type === 'image')
      const overlayEl = result.elements.find((element) => element.type === 'background' && element.style.background)
      const nameEl = result.elements.find((element) => element.type === 'text' && element.content === 'Smoked Brisket')
      const badgeEl = result.elements.find((element) => element.type === 'text' && element.content === 'House Special')

      expect(imageEl?.width).toBe(tile.width - 14)
      expect(imageEl?.height).toBe(tile.height - 14)
      expect(overlayEl?.style.background).toContain('linear-gradient')
      expect(nameEl?.style.textShadow).toBeDefined()
      expect(badgeEl).toBeDefined()
    })

    it('should preserve flagship titles by shrinking type before truncating', () => {
      const makeTile = (name: string, description: string): TileInstanceV2 => ({
        id: `flagship-${name.length}`,
        type: 'FLAGSHIP_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 360,
        height: 148,
        colSpan: 2,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        contentBudget: {
          nameLines: 2,
          descLines: 4,
          indicatorAreaHeight: 16,
          imageBoxHeight: 84,
          paddingTop: 8,
          paddingBottom: 8,
          totalHeight: 148,
        },
        content: {
          type: 'FLAGSHIP_CARD',
          itemId: `flagship-${name.length}`,
          sectionId: 'section-1',
          name,
          description,
          price: 24,
          imageUrl: 'https://example.com/special.jpg',
          showImage: true,
          currency: 'USD',
          indicators: { dietary: ['gluten-free'], spiceLevel: 1, allergens: [] },
        } as FlagshipCardContentV2,
      })

      const shortResult = renderTileContent(
        makeTile('Braised Lamb', 'Slow cooked shoulder.'),
        { ...defaultOptions, imageMode: 'stretch' }
      )
      const longResult = renderTileContent(
        makeTile(
          'Braised Lamb With Herb Butter',
          'Slow cooked shoulder with herbs, charred vegetables, mustard glaze and a longer description that should still clamp cleanly.'
        ),
        { ...defaultOptions, imageMode: 'stretch' }
      )

      const shortName = shortResult.elements.find((element) => element.type === 'text' && element.content === 'Braised Lamb')
      const longName = longResult.elements.find((element) => element.type === 'text' && element.content === 'Braised Lamb With Herb Butter')
      const shortDesc = shortResult.elements.find((element) => element.type === 'text' && element.content === 'Slow cooked shoulder.')
      const longDesc = longResult.elements.find((element) => element.type === 'text' && element.content.includes('mustard glaze'))

      expect(shortName?.style.maxLines).toBe(2)
      expect(longName?.style.maxLines).toBeGreaterThanOrEqual(2)
      expect(Number(longName?.style.fontSize)).toBeLessThanOrEqual(Number(shortName?.style.fontSize))
      expect(shortDesc?.style.maxLines).toBe(longDesc?.style.maxLines)
    })

    it('should render body logo tiles with an inset surface treatment', () => {
      const tile: TileInstanceV2 = {
        id: 'logo-body',
        type: 'LOGO',
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
          type: 'LOGO',
          imageUrl: 'https://example.com/logo.png',
          venueName: 'Test Restaurant'
        } as LogoContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const bgEl = result.elements.find((element) => element.type === 'background')
      const imageEl = result.elements.find((element) => element.type === 'image')

      expect(bgEl).toBeDefined()
      expect(imageEl?.x).toBeGreaterThan(0)
      expect(imageEl?.width).toBeLessThan(tile.width)
    })

    it('should render inverse chrome for body logo title tiles', () => {
      const tile: TileInstanceV2 = {
        id: 'logo-body-inverse',
        type: 'LOGO',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'LOGO',
          venueName: 'Afternoon Menu'
        } as LogoContentV2
      }

      const result = renderTileContent(tile, {
        ...defaultOptions,
        palette: {
          id: 'custom-inverse',
          name: 'Custom Inverse',
          colors: {
            background: '#FFFFFF',
            surface: '#F7F4EC',
            menuTitle: '#111111',
            sectionHeader: '#111111',
            itemTitle: '#111111',
            itemPrice: '#5C3D00',
            itemDescription: '#555555',
            itemIndicators: { background: '#FFFFFF' },
            border: { light: '#E5E7EB', medium: '#D1D5DB' },
            textMuted: '#888888',
            bannerSurface: '#F7F4EC',
            bannerText: '#111111',
            footerBorder: '#E5E7EB',
            footerText: '#111111',
            inverseTiles: {
              logoTitle: { background: '#5C3D00', text: '#FFF6D7', border: '#3F2A00' },
              sectionHeader: { background: '#FFD86A', text: '#5C3D00', border: '#C98F00' },
            },
            promoted: {
              featured: { background: '#F7F1D9', border: '#8C6A11', badgeFill: '#234F1E', badgeText: '#FFFDEA' },
              flagship: { background: '#EEF5E8', border: '#2F5E2A', badgeFill: '#234F1E', badgeText: '#FFFDEA', price: '#315B2C' },
            },
          },
        },
      })

      const bgEl = result.elements.find((element) => element.type === 'background' && element.style.backgroundColor === '#5C3D00')
      const borderEls = result.elements.filter((element) => element.type === 'background' && element.style.backgroundColor === '#3F2A00')
      const textEl = result.elements.find((element) => element.type === 'text' && element.content === 'Afternoon Menu')

      expect(bgEl).toBeDefined()
      expect(borderEls).toHaveLength(4)
      expect(textEl?.style.color).toBe('#FFF6D7')
    })

    it('should apply the active font style preset to fallback logo text', () => {
      const tile: TileInstanceV2 = {
        id: 'logo-fallback',
        type: 'LOGO',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'LOGO',
          venueName: 'Test Restaurant'
        } as LogoContentV2
      }

      const result = renderTileContent(tile, { ...defaultOptions, fontStylePreset: 'fun' })
      const textEl = result.elements.find((element) => element.type === 'text' && element.content === 'Test Restaurant')

      expect(textEl?.style.fontFamily).toBe(FONT_STYLE_PRESETS.fun.bannerTitleFamily)
      expect(textEl?.style.fontWeight).toBe(FONT_STYLE_PRESETS.fun.bannerTitleWeight)
    })

    it('should render inverse chrome for compact section header tiles', () => {
      const tile: TileInstanceV2 = {
        id: 'header-inverse',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 160,
        height: 50,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Sandwiches',
          isContinuation: false,
          isCompactTile: true,
        } as SectionHeaderContentV2
      }

      const result = renderTileContent(tile, {
        ...defaultOptions,
        palette: {
          id: 'custom-inverse',
          name: 'Custom Inverse',
          colors: {
            background: '#FFFFFF',
            surface: '#F7F4EC',
            menuTitle: '#111111',
            sectionHeader: '#111111',
            itemTitle: '#111111',
            itemPrice: '#5C3D00',
            itemDescription: '#555555',
            itemIndicators: { background: '#FFFFFF' },
            border: { light: '#E5E7EB', medium: '#D1D5DB' },
            textMuted: '#888888',
            bannerSurface: '#F7F4EC',
            bannerText: '#111111',
            footerBorder: '#E5E7EB',
            footerText: '#111111',
            inverseTiles: {
              logoTitle: { background: '#5C3D00', text: '#FFF6D7', border: '#3F2A00' },
              sectionHeader: { background: '#FFD86A', text: '#5C3D00', border: '#C98F00' },
            },
            promoted: {
              featured: { background: '#F7F1D9', border: '#8C6A11', badgeFill: '#234F1E', badgeText: '#FFFDEA' },
              flagship: { background: '#EEF5E8', border: '#2F5E2A', badgeFill: '#234F1E', badgeText: '#FFFDEA', price: '#315B2C' },
            },
          },
        },
      })

      const bgEl = result.elements.find((element) => element.type === 'background' && element.style.backgroundColor === '#FFD86A')
      const borderEls = result.elements.filter((element) => element.type === 'background' && element.style.backgroundColor === '#C98F00')
      const labelEl = result.elements.find((element) => element.type === 'text' && element.content === 'Sandwiches')

      expect(bgEl).toBeDefined()
      expect(borderEls).toHaveLength(4)
      expect(labelEl?.style.color).toBe('#5C3D00')
    })

    it('should shrink compact section header text for narrow tiles', () => {
      const tile: TileInstanceV2 = {
        id: 'header-compact-fit',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 92,
        height: 70,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Lunch Entrees',
          isContinuation: false,
          isCompactTile: true,
        } as SectionHeaderContentV2,
        style: {
          typography: {
            fontSet: 'system-sans-bold',
            fontSize: '5xl',
            fontWeight: 'bold',
            textAlign: 'center',
            lineHeight: 'normal',
            letterSpacing: 0.8,
            textTransform: 'capitalize',
            decoration: 'none'
          }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const labelEl = result.elements.find((element) => element.type === 'text' && element.content === 'Lunch Entrees')

      expect(labelEl?.style.fontSize).toBeLessThan(TYPOGRAPHY_TOKENS_V2.fontSize['5xl'])
      expect(labelEl?.style.fontSize).toBeGreaterThanOrEqual(11)
      expect(labelEl?.style.letterSpacing).toBeLessThanOrEqual(0.4)
    })
  })

  describe('Typography and Color Tokens', () => {
    it('should have consistent typography tokens', () => {
      expect(TYPOGRAPHY_TOKENS_V2.fontSize.base).toBe(14)
      expect(TYPOGRAPHY_TOKENS_V2.fontSize['3xl']).toBe(24)
      expect(TYPOGRAPHY_TOKENS_V2.fontSize['5xl']).toBe(30)
      expect(TYPOGRAPHY_TOKENS_V2.fontWeight.bold).toBe(700)
      expect(TYPOGRAPHY_TOKENS_V2.lineHeight.normal).toBe(1.4)
    })

    it('should have consistent color tokens', () => {
      expect(COLOR_TOKENS_V2.text.primary).toBe('#111827')
      expect(COLOR_TOKENS_V2.background.white).toBe('#FFFFFF')
      expect(COLOR_TOKENS_V2.indicator.vegetarian).toBe('#10B981')
    })
  })

  describe('Scale Factor', () => {
    it('should provide deterministic default scale', () => {
      const scale1 = getDefaultScale()
      const scale2 = getDefaultScale()
      
      expect(scale1).toBe(scale2)
      expect(scale1).toBe(1.0) // 1 point = 1 pixel
    })
  })

  describe('Featured badges', () => {
    it('should size star badge smaller than Popular sticker for the same tile width', () => {
      const tileW = 180
      const star = getFeaturedStarBadgeMetrics(tileW)
      const pop = getPopularBadgeMetrics(tileW)
      expect(star.size).toBeLessThan(pop.badgeW)
      expect(star.size).toBeLessThan(pop.badgeH)
    })

    it('should honor palette-owned featured colors and YAML badge settings', () => {
      const tile: TileInstanceV2 = {
        id: 'item-featured-custom',
        type: 'ITEM_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 148,
        colSpan: 1,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        style: {
          border: { width: 3 },
          badge: { label: 'Chef Pick', position: 'left', borderRadius: 8 },
        },
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-featured-custom',
          sectionId: 'section-1',
          name: 'Featured Salad',
          description: 'Seasonal greens and citrus.',
          price: 14,
          imageUrl: 'https://example.com/featured.jpg',
          showImage: true,
          currency: 'USD',
          indicators: { dietary: [], spiceLevel: null, allergens: [] },
          isFeatured: true,
        } as ItemContentV2,
      }

      const result = renderTileContent(tile, {
        ...defaultOptions,
        imageMode: 'stretch',
        palette: {
          id: 'custom',
          name: 'Custom',
          colors: {
            background: '#FFFFFF',
            surface: '#F7F4EC',
            menuTitle: '#111111',
            sectionHeader: '#111111',
            itemTitle: '#111111',
            itemPrice: '#5C3D00',
            itemDescription: '#555555',
            itemIndicators: { background: '#FFFFFF' },
            border: { light: '#E5E7EB', medium: '#D1D5DB' },
            textMuted: '#888888',
            bannerSurface: '#F7F4EC',
            bannerText: '#111111',
            footerBorder: '#E5E7EB',
            footerText: '#111111',
            promoted: {
              featured: { background: '#F7F1D9', border: '#8C6A11', badgeFill: '#234F1E', badgeText: '#FFFDEA' },
              flagship: { background: '#EEF5E8', border: '#2F5E2A', badgeFill: '#234F1E', badgeText: '#FFFDEA', price: '#315B2C' },
            },
          },
        },
      })
      const panelEl = result.elements.find(e => e.type === 'background' && e.style.backgroundColor === '#F7F1D9')
      const badgeEl = result.elements.find(e => e.type === 'text' && e.content === 'Chef Pick')

      expect(panelEl).toBeDefined()
      expect(badgeEl?.style.backgroundColor).toBe('#234F1E')
      expect(badgeEl?.style.color).toBe('#FFFDEA')
    })
  })

  describe('Image Modes', () => {
    const createItemTile = (imageMode?: string): TileInstanceV2 => ({
      id: 'item-1',
      type: 'ITEM_CARD',
      regionId: 'body',
      x: 0,
      y: 0,
      width: 180,
      height: 240, // Enough for SPACING_V2 (nameToDesc 8, descToPrice 12, afterImage 16)
      colSpan: 1,
      rowSpan: 2,
      gridRow: 0,
      gridCol: 0,
      layer: 'content',
      content: {
        type: 'ITEM_CARD',
        itemId: 'item-1',
        sectionId: 'section-1',
        name: 'Test Item',
        description: 'Test description',
        price: 10.99,
        imageUrl: 'https://example.com/image.jpg',
        showImage: true,
        currency: '$'
      } as ItemContentV2
    })

    it('should render stretch mode (default) with full-width image', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'stretch'
      }

      const result = renderTileContent(tile, options)
      const imageElement = result.elements.find(e => e.type === 'image')
      
      expect(imageElement).toBeDefined()
      expect(imageElement?.width).toBeGreaterThanOrEqual(tile.width - 2) // Stretch is edge-to-edge (1px inset each side)
      expect(imageElement?.style.borderRadius).toBe(0) // No border radius in stretch/full-bleed mode
    })

    it('should omit image slot when imageMode is none (text-only layout)', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'none'
      }

      const result = renderTileContent(tile, options)
      expect(result.elements.find(e => e.type === 'image')).toBeUndefined()
      expect(result.elements.filter(e => e.type === 'text').length).toBeGreaterThanOrEqual(2)
    })

    it('should still render indicators below text when imageMode is none', () => {
      const tile: TileInstanceV2 = {
        ...createItemTile(),
        content: {
          ...(createItemTile().content as ItemContentV2),
          indicators: { dietary: ['vegetarian'], spiceLevel: null, allergens: [] },
        } as ItemContentV2,
      }
      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'none' })
      expect(result.elements.some(e => e.type === 'indicator')).toBe(true)
    })

    it('should use compact star badge for featured item when imageMode is none', () => {
      const padTop = 8
      const tile: TileInstanceV2 = {
        id: 'item-tr-star',
        type: 'ITEM_TEXT_ROW',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 70,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_TEXT_ROW',
          itemId: 'x',
          sectionId: 's',
          name: 'Star Featured',
          description: 'Line',
          price: 5,
          showImage: false,
          currency: 'USD',
          isFeatured: true,
        } as ItemContentV2,
        contentBudget: {
          nameLines: 2,
          descLines: 2,
          indicatorAreaHeight: 16,
          imageBoxHeight: 0,
          paddingTop: padTop,
          paddingBottom: 8,
          totalHeight: 70,
        },
      }
      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'none' })
      const star = result.elements.find(e => e.type === 'text' && e.content === '\u2605')
      expect(star).toBeDefined()
      expect(result.elements.some(e => e.type === 'text' && e.content === 'Popular')).toBe(false)
      expect((star?.width ?? 0) > 0 && (star?.width ?? 0) < 40).toBe(true)
    })

    it('should keep featured ITEM_TEXT_ROW text in-bounds even if imageMode is stretch (preview parity)', () => {
      const padTop = 8
      const tileHeight = 70
      const tile: TileInstanceV2 = {
        id: 'item-tr-featured',
        type: 'ITEM_TEXT_ROW',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: tileHeight,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_TEXT_ROW',
          itemId: 'x',
          sectionId: 's',
          name: 'Featured Snack',
          description: 'Short desc line',
          price: 9.99,
          showImage: false,
          currency: 'USD',
          isFeatured: true,
        } as ItemContentV2,
        contentBudget: {
          nameLines: 2,
          descLines: 2,
          indicatorAreaHeight: 16,
          imageBoxHeight: 0,
          paddingTop: padTop,
          paddingBottom: 8,
          totalHeight: tileHeight,
        },
      }
      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'stretch' })
      const texts = result.elements.filter(
        e => e.type === 'text' && e.content !== 'Popular' && e.content !== '\u2605'
      )
      expect(texts[0]?.y).toBe(padTop)
      const lastText = texts[texts.length - 1]
      expect((lastText?.y ?? 0) + (lastText?.height ?? 0)).toBeLessThanOrEqual(tileHeight)
    })

    it('should render compact-rect mode with smaller centered image', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'compact-rect'
      }

      const result = renderTileContent(tile, options)
      const imageElement = result.elements.find(e => e.type === 'image')
      
      expect(imageElement).toBeDefined()
      // Image should be smaller (60% of tile width)
      expect(imageElement?.width).toBeLessThan(tile.width * 0.7)
      // Should be centered (x position should center the image)
      const expectedX = (tile.width - (imageElement?.width || 0)) / 2
      expect(Math.abs((imageElement?.x || 0) - expectedX)).toBeLessThan(1)
      // Height should maintain 4:3 aspect
      const expectedHeight = (imageElement?.width || 0) * 0.75
      expect(Math.abs((imageElement?.height || 0) - expectedHeight)).toBeLessThan(1)
    })

    it('should render compact-circle mode with circular image', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'compact-circle'
      }

      const result = renderTileContent(tile, options)
      const imageElement = result.elements.find(e => e.type === 'image')
      
      expect(imageElement).toBeDefined()
      // Should be square (width === height)
      expect(imageElement?.width).toBe(imageElement?.height)
      // BorderRadius should be 50% for circle
      const expectedRadius = (imageElement?.width || 0) / 2
      expect(imageElement?.style.borderRadius).toBe(expectedRadius)
      // Should be centered
      const expectedX = (tile.width - (imageElement?.width || 0)) / 2
      expect(Math.abs((imageElement?.x || 0) - expectedX)).toBeLessThan(1)
    })

    it('should render background mode with full-tile image and gradient overlay', () => {
      const tile = createItemTile()
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        imageMode: 'background'
      }

      const result = renderTileContent(tile, options)
      
      // Should have background image at full tile size
      const bgImage = result.elements.find(e => e.type === 'image' && e.width === tile.width && e.height === tile.height)
      expect(bgImage).toBeDefined()
      expect(bgImage?.x).toBe(0)
      expect(bgImage?.y).toBe(0)
      
      // Should have gradient overlay
      const gradientOverlay = result.elements.find(e => 
        e.type === 'background' && 
        e.width === tile.width && 
        e.height === tile.height &&
        e.style.background?.includes('linear-gradient')
      )
      expect(gradientOverlay).toBeDefined()
      
      // In background mode, name and price use lightened palette colours for contrast on dark overlay
      const palette = DEFAULT_PALETTE_V2
      const textElements = result.elements.filter(e => e.type === 'text')
      const [nameEl, descEl, priceEl] = textElements
      const expectedNameColor = lightenHexForDarkBackground(palette.colors.itemTitle, BG_IMAGE_TEXT.lightenBlendName)
      const expectedPriceColor = lightenHexForDarkBackground(palette.colors.itemPrice, BG_IMAGE_TEXT.lightenBlendPrice)
      expect(nameEl?.style.color).toBe(expectedNameColor)
      expect(priceEl?.style.color).toBe(expectedPriceColor)
      if (descEl) {
        expect(descEl.style.color).toBe(BG_IMAGE_TEXT.descColor)
      }
      // Name and price use larger font in background mode
      const baseNameSize = TYPOGRAPHY_TOKENS_V2.fontSize.xsm
      expect(nameEl?.style.fontSize).toBeGreaterThanOrEqual(baseNameSize)
      const basePriceSize = TYPOGRAPHY_TOKENS_V2.fontSize.xxxs
      expect(priceEl?.style.fontSize).toBeGreaterThanOrEqual(basePriceSize)

      // All text should have text-shadow for legibility
      textElements.forEach(textEl => {
        expect(textEl.style.textShadow).toBeDefined()
      })
    })

    it('should ensure no elements exceed tile bounds', () => {
      const modes: Array<'stretch' | 'compact-rect' | 'compact-circle' | 'background'> = 
        ['stretch', 'compact-rect', 'compact-circle', 'background']
      
      modes.forEach(mode => {
        const tile = createItemTile()
        const options: RenderOptionsV2 = {
          ...defaultOptions,
          imageMode: mode
        }

        const result = renderTileContent(tile, options)
        
        result.elements.forEach(element => {
          // Check that element doesn't exceed tile bounds
          expect(element.x).toBeGreaterThanOrEqual(0)
          expect(element.y).toBeGreaterThanOrEqual(0)
          expect((element.x || 0) + (element.width || 0)).toBeLessThanOrEqual(tile.width)
          expect((element.y || 0) + (element.height || 0)).toBeLessThanOrEqual(tile.height)
        })
      })
    })
  })

  describe('Sub-Element Typography', () => {
    it('should apply sub-element typography from tile style overrides', () => {
      const tile: TileInstanceV2 = {
        id: 'item-styled-1',
        type: 'ITEM_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 148,
        colSpan: 1,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-1',
          sectionId: 'section-1',
          name: 'Styled Item',
          description: 'With custom fonts',
          price: 15.00,
          showImage: false,
          currency: '$',
          indicators: { dietary: [], spiceLevel: null, allergens: [] }
        } as ItemContentV2,
        style: {
          typography: {
            name: { fontSet: 'elegant-serif', fontSize: 'sm', fontWeight: 'bold' },
            description: { fontSet: 'modern-sans', fontSize: 'xs', fontWeight: 'normal' },
            price: { fontSet: 'modern-sans', fontSize: 'sm', fontWeight: 'extrabold' },
          }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const textElements = result.elements.filter(e => e.type === 'text')

      // Name element should use sm (12pt)
      const nameEl = textElements.find(e => e.content === 'Styled Item')
      expect(nameEl?.style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.sm)
      expect(nameEl?.style.fontWeight).toBe(TYPOGRAPHY_TOKENS_V2.fontWeight.bold)
      expect(nameEl?.style.fontFamily).toContain('Playfair Display')

      // Description element should use xs (10pt)
      const descEl = textElements.find(e => e.content === 'With custom fonts')
      expect(descEl?.style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.xs)

      // Price element should use sm (12pt) extrabold (800)
      const priceEl = textElements.find(e => e.content?.includes('15'))
      expect(priceEl?.style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.sm)
      expect(priceEl?.style.fontWeight).toBe(TYPOGRAPHY_TOKENS_V2.fontWeight.extrabold)
    })

    it('should fall back to defaults when sub-element typography is not set', () => {
      const tile: TileInstanceV2 = {
        id: 'item-unstyled-1',
        type: 'ITEM_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 148,
        colSpan: 1,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-1',
          sectionId: 'section-1',
          name: 'Default Item',
          description: 'Default fonts',
          price: 10.00,
          showImage: false,
          currency: '$',
          indicators: { dietary: [], spiceLevel: null, allergens: [] }
        } as ItemContentV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const textElements = result.elements.filter(e => e.type === 'text')

      const nameEl = textElements.find(e => e.content === 'Default Item')
      expect(nameEl?.style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.xsm)
      expect(nameEl?.style.fontWeight).toBe(TYPOGRAPHY_TOKENS_V2.fontWeight.semibold)
    })
  })

  describe('Image Shadow', () => {
    it('should apply boxShadow to non-circular images', () => {
      const tile: TileInstanceV2 = {
        id: 'item-img-1',
        type: 'ITEM_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 200,
        colSpan: 1,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-1',
          sectionId: 'section-1',
          name: 'Shadow Item',
          price: 12.00,
          imageUrl: 'https://example.com/image.jpg',
          showImage: true,
          currency: '$',
          indicators: { dietary: [], spiceLevel: null, allergens: [] }
        } as ItemContentV2
      }

      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'stretch' })
      const imageEl = result.elements.find(e => e.type === 'image')
      expect(imageEl?.style.boxShadow).toBe('0 2px 8px rgba(0,0,0,0.1)')
    })

    it('should not apply boxShadow to circular images', () => {
      const tile: TileInstanceV2 = {
        id: 'item-circle-1',
        type: 'ITEM_CARD',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 180,
        height: 200,
        colSpan: 1,
        rowSpan: 2,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'ITEM_CARD',
          itemId: 'item-1',
          sectionId: 'section-1',
          name: 'Circle Item',
          price: 12.00,
          imageUrl: 'https://example.com/image.jpg',
          showImage: true,
          currency: '$',
          indicators: { dietary: [], spiceLevel: null, allergens: [] }
        } as ItemContentV2
      }

      const result = renderTileContent(tile, { ...defaultOptions, imageMode: 'compact-circle' })
      const imageEl = result.elements.find(e => e.type === 'image')
      expect(imageEl?.style.boxShadow).toBeUndefined()
    })
  })

  describe('Footer Treatment', () => {
    it('should render footer with background and top border', () => {
      const tile: TileInstanceV2 = {
        id: 'footer-1',
        type: 'FOOTER_INFO',
        regionId: 'footer',
        x: 0,
        y: 0,
        width: 500,
        height: 45,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'FOOTER_INFO',
          address: '123 Main St',
          phone: '+1 555-0123'
        } as FooterInfoContentV2
      }

      const result = renderTileContent(tile, defaultOptions)

      // Should have background elements (bg block + border)
      const bgElements = result.elements.filter(e => e.type === 'background')
      expect(bgElements.length).toBeGreaterThanOrEqual(2)

      // First should be full-width background
      expect(bgElements[0].width).toBe(500)
      expect(bgElements[0].height).toBe(45 * 3)

      // Second should be top border (1pt height)
      expect(bgElements[1].y).toBe(0)
      expect(bgElements[1].height).toBe(1)

      // Should have text elements for address and phone
      const textElements = result.elements.filter(e => e.type === 'text')
      expect(textElements.length).toBeGreaterThanOrEqual(2)

      // Footer text should use xss font size by default (compact microcopy)
      textElements.forEach(el => {
        expect(el.style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.xss)
      })
    })

    it('should apply custom footer style from tile', () => {
      const tile: TileInstanceV2 = {
        id: 'footer-styled-1',
        type: 'FOOTER_INFO',
        regionId: 'footer',
        x: 0,
        y: 0,
        width: 500,
        height: 45,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'FOOTER_INFO',
          address: '456 Oak Ave'
        } as FooterInfoContentV2,
        style: {
          typography: {
            color: '#C4A882',
            contact: { fontSet: 'elegant-serif', fontSize: 'xsm', fontWeight: 'normal' }
          },
          border: { width: 2, color: '#5C1A1A', style: 'solid', sides: ['top'] }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const textElements = result.elements.filter(e => e.type === 'text')
      
      expect(textElements[0].style.color).toBe('#C4A882')
      expect(textElements[0].style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.xsm)
      expect(textElements[0].style.fontFamily).toContain('Playfair Display')

      // Border should use custom width
      const bgElements = result.elements.filter(e => e.type === 'background')
      const borderEl = bgElements.find(e => e.height === 2)
      expect(borderEl).toBeDefined()
      expect(borderEl?.style.backgroundColor).toBe('#5C1A1A')
    })
  })

  describe('Section Header textTransform', () => {
    it('should apply textTransform from tile style', () => {
      const tile: TileInstanceV2 = {
        id: 'header-1',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 500,
        height: 30,
        colSpan: 4,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Appetizers',
          isContinuation: false
        } as SectionHeaderContentV2,
        style: {
          typography: {
            fontSet: 'elegant-serif',
            fontSize: '2xl',
            fontWeight: 'semibold',
            textTransform: 'uppercase'
          }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const textEl = result.elements.find(e => e.type === 'text' && e.content === 'Appetizers')

      expect(textEl?.style.textTransform).toBe('uppercase')
      expect(textEl?.style.letterSpacing).toBe(1.5)
    })

    it('should not apply letterSpacing when textTransform is not uppercase', () => {
      const tile: TileInstanceV2 = {
        id: 'header-2',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 500,
        height: 30,
        colSpan: 4,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Main Courses',
          isContinuation: false
        } as SectionHeaderContentV2,
        style: {
          typography: {
            textTransform: 'capitalize'
          }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      // 'capitalize' is now applied in JS as true title case, so CSS textTransform is undefined
      const textEl = result.elements.find(e => e.type === 'text' && e.content === 'Main Courses')

      expect(textEl?.style.textTransform).toBeUndefined()
      expect(textEl?.style.letterSpacing).toBeUndefined()
    })

    it('should use textAlign from tile style (e.g. left)', () => {
      const tile: TileInstanceV2 = {
        id: 'header-3',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 500,
        height: 30,
        colSpan: 4,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Insalate',
          isContinuation: false
        } as SectionHeaderContentV2,
        style: {
          typography: { textAlign: 'left' },
          spacing: { paddingLeft: 8, paddingTop: 24 }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const labelEl = result.elements.find(e => e.type === 'text' && e.content === 'Insalate')
      expect(labelEl?.style.textAlign).toBe('left')
    })

    it('should apply letterSpacing override from tile style', () => {
      const tile: TileInstanceV2 = {
        id: 'header-4',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 500,
        height: 30,
        colSpan: 4,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Desserts',
          isContinuation: false
        } as SectionHeaderContentV2,
        style: {
          typography: { letterSpacing: 0.8, textTransform: 'none' }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const labelEl = result.elements.find(e => e.type === 'text' && e.content === 'Desserts')
      expect(labelEl?.style.letterSpacing).toBe(0.8)
    })

    it('should render decoration (bullet) before label when set', () => {
      const tile: TileInstanceV2 = {
        id: 'header-5',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 500,
        height: 30,
        colSpan: 4,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Salads',
          isContinuation: false
        } as SectionHeaderContentV2,
        style: {
          typography: { decoration: 'bullet' },
          spacing: { paddingLeft: 8 }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const decorationEl = result.elements.find(e => e.type === 'text' && e.content === '•')
      const labelEl = result.elements.find(e => e.type === 'text' && e.content === 'Salads')
      expect(decorationEl).toBeDefined()
      expect(labelEl).toBeDefined()
      expect(labelEl?.style.fontSize).toBeDefined()
    })

    it('should approximately center section header with decoration when textAlign is center', () => {
      const tile: TileInstanceV2 = {
        id: 'header-6',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 500,
        height: 40,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Antojitos',
          isContinuation: false
        } as SectionHeaderContentV2,
        style: {
          typography: {
            fontSize: '2xl',
            textAlign: 'center',
            decoration: 'bullet'
          },
          spacing: { paddingLeft: 8, paddingTop: 24 }
        } as TileStyleV2
      }

      const result = renderTileContent(tile, defaultOptions)
      const decorationEl = result.elements.find(e => e.type === 'text' && e.content === '•')
      const labelEl = result.elements.find(e => e.type === 'text' && e.content === 'Antojitos')

      expect(decorationEl).toBeDefined()
      expect(labelEl).toBeDefined()

      // Bullet should sit to the left of the label
      expect((decorationEl as any).x).toBeLessThan((labelEl as any).x)

      // The combined group (bullet + label) should be approximately centered
      const resolvedFontSize = TYPOGRAPHY_TOKENS_V2.fontSize['2xl']
      const approxCharWidth = resolvedFontSize * 0.55
      const approxLabelWidth = 'Antojitos'.length * approxCharWidth
      const decorationWidth = 14
      const decorationGap = 4
      const groupLeft = (decorationEl as any).x
      const groupRight = groupLeft + decorationWidth + decorationGap + approxLabelWidth
      const groupCenter = (groupLeft + groupRight) / 2

      expect(Math.abs(groupCenter - tile.width / 2)).toBeLessThan(10)
    })

    it('should add a tinted surface for compact 1x1 section header tiles', () => {
      const tile: TileInstanceV2 = {
        id: 'header-compact',
        type: 'SECTION_HEADER',
        regionId: 'body',
        x: 0,
        y: 0,
        width: 110,
        height: 70,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: {
          type: 'SECTION_HEADER',
          sectionId: 'sec-1',
          label: 'Mains',
          isContinuation: false,
          isCompactTile: true,
        } as SectionHeaderContentV2,
      }

      const result = renderTileContent(tile, defaultOptions)
      const bgEl = result.elements.find((element) => element.type === 'background')
      const labelEl = result.elements.find((element) => element.type === 'text' && element.content === 'Mains')

      expect(bgEl?.style.backgroundColor).toBeDefined()
      expect(labelEl?.style.color).not.toBe(DEFAULT_PALETTE_V2.colors.sectionHeader)
    })
  })

  describe('Spacing Constants', () => {
    it('should have SPACING_V2 with expected values (GridMenu guide)', () => {
      expect(SPACING_V2.nameToDesc).toBe(8)
      expect(SPACING_V2.descToPrice).toBe(6)
      expect(SPACING_V2.afterImage).toBe(16)
      expect(SPACING_V2.tilePadding).toBe(8)
    })
  })

  describe('extrabold Font Weight', () => {
    it('should have extrabold weight token at 800', () => {
      expect(TYPOGRAPHY_TOKENS_V2.fontWeight.extrabold).toBe(800)
    })
  })

  describe('Texture Patterns', () => {
    it('should have all expected texture patterns registered', () => {
      const expectedPatterns = [
        'dark-paper', 'paper-grain', 'subtle-noise', 'stripes-horizontal', 'stripes-vertical', 'stripes-diagonal',
        'waves', 'linen', 'subtle-dots'
      ]
      expectedPatterns.forEach(patternId => {
        const config = TEXTURE_REGISTRY.get(patternId)
        expect(config).toBeDefined()
        expect(config?.label).toBeTruthy()
      })
    })

    it('should use SVG data-URI textures for SVG patterns', () => {
      const config = TEXTURE_REGISTRY.get('paper-grain')
      const css = config?.webCss('')
      expect(css?.backgroundImage).toContain('data:image/svg+xml')
    })

    it('should use file-based texture for dark-paper', () => {
      const config = TEXTURE_REGISTRY.get('dark-paper')
      expect(config?.pdfTextureFile).toBeTruthy()
    })
  })

  describe('Filler (spacer) pattern registry', () => {
    it('should have expected filler pattern IDs registered', () => {
      const expected = [
        'diagonal-pinstripe',
        'bauhaus-check',
        'overlapping-rings',
        'windowpane',
        'matte-paper-grain',
        'warp-speed',
        'targeting-grid',
        'single-flower',
      ]
      expect(FILLER_PATTERN_IDS).toEqual(expected)
      expected.forEach(id => {
        const config = FILLER_PATTERN_REGISTRY.get(id)
        expect(config).toBeDefined()
        expect(config?.label).toBeTruthy()
        expect(typeof config?.getSvgDataUri).toBe('function')
      })
    })

    it('should return palette-adaptive SVG data URI for each pattern', () => {
      const palette = PALETTES_V2[0] ?? DEFAULT_PALETTE_V2
      // Include bannerSurface since some patterns (e.g. single-flower) use it as their tile fill
      const paletteColors = [
        palette.colors.surface ?? palette.colors.border.light,
        palette.colors.border.light,
        palette.colors.border.medium,
        palette.colors.bannerSurface,
      ].filter(Boolean)
      for (const id of FILLER_PATTERN_IDS) {
        const config = FILLER_PATTERN_REGISTRY.get(id)
        const dataUri = config?.getSvgDataUri(palette)
        expect(dataUri).toMatch(/^data:image\/svg\+xml,/)
        const usesPalette = paletteColors.some(c => dataUri.includes(encodeURIComponent(c)))
        expect(usesPalette).toBe(true)
      }
    })
  })

  describe('Filler tile rendering', () => {
    const baseFillerTile: TileInstanceV2 = {
      id: 'filler-0-0-0',
      type: 'FILLER',
      regionId: 'body',
      x: 0,
      y: 0,
      width: 120,
      height: 148,
      colSpan: 1,
      rowSpan: 2,
      gridRow: 0,
      gridCol: 0,
      layer: 'content',
      content: {
        type: 'FILLER',
        style: 'color',
        content: ''
      } as FillerContentV2
    }

    it('should render filler with pattern overlay when spacerTilePatternId is set', () => {
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        palette: DEFAULT_PALETTE_V2,
        spacerTilePatternId: 'diagonal-pinstripe'
      }
      const result = renderTileContent(baseFillerTile, options)
      expect(result.elements.length).toBeGreaterThanOrEqual(2)
      const baseBg = result.elements[0]
      expect(baseBg.type).toBe('background')
      expect(baseBg.style.backgroundColor).toBeDefined()
      const patternBg = result.elements.find(e => e.type === 'background' && e.style?.background)
      expect(patternBg).toBeDefined()
      expect(patternBg?.style?.background).toContain('url("data:image/svg+xml')
      expect(patternBg?.style?.background).toContain('repeat')
    })

    it('should set pattern background position from tile position for seamless tessellation', () => {
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        palette: DEFAULT_PALETTE_V2,
        spacerTilePatternId: 'windowpane'
      }
      const tileAtOffset = { ...baseFillerTile, x: 140, y: 200 }
      const result = renderTileContent(tileAtOffset, options)
      const patternBg = result.elements.find(e => e.type === 'background' && e.style?.background)
      expect(patternBg).toBeDefined()
      expect(patternBg?.style?.backgroundPositionX).toBe(-140)
      expect(patternBg?.style?.backgroundPositionY).toBe(-200)
    })

    it('should render filler without pattern when spacerTilePatternId is unset', () => {
      const result = renderTileContent(baseFillerTile, defaultOptions)
      const withPattern = result.elements.filter(e => e.type === 'background' && e.style?.background)
      expect(withPattern).toHaveLength(0)
      expect(result.elements.some(e => e.type === 'background')).toBe(true)
    })

    it('should render blank filler as single background when spacerTilePatternId is "blank"', () => {
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        palette: DEFAULT_PALETTE_V2,
        spacerTilePatternId: SPACER_BLANK_ID
      }
      const result = renderTileContent(baseFillerTile, options)
      expect(result.elements.length).toBe(1)
      expect(result.elements[0].type).toBe('background')
      expect(result.elements[0].style?.backgroundColor).toBeDefined()
      expect(result.elements[0].style?.background).toBeUndefined()
    })

    it('should alternate blank filler colours by fillerIndex when spacerTilePatternId is "blank"', () => {
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        palette: DEFAULT_PALETTE_V2,
        spacerTilePatternId: SPACER_BLANK_ID
      }
      const result0 = renderTileContent(
        { ...baseFillerTile, content: { ...baseFillerTile.content, fillerIndex: 0 } as FillerContentV2 },
        options
      )
      const result1 = renderTileContent(
        { ...baseFillerTile, content: { ...baseFillerTile.content, fillerIndex: 1 } as FillerContentV2 },
        options
      )
      const bg0 = result0.elements[0]?.style?.backgroundColor
      const bg1 = result1.elements[0]?.style?.backgroundColor
      expect(bg0).toBeDefined()
      expect(bg1).toBeDefined()
      expect(bg0).not.toBe(bg1)
    })

    it('should rotate patterns when spacerTilePatternId is "mix" by fillerIndex', () => {
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        palette: DEFAULT_PALETTE_V2,
        spacerTilePatternId: 'mix'
      }
      const results = [0, 1, 2].map(fillerIndex =>
        renderTileContent(
          { ...baseFillerTile, content: { ...baseFillerTile.content, fillerIndex } as FillerContentV2 },
          options
        )
      )
      const getPatternBg = (r: { elements: any[] }) => r.elements.find((e: any) => e.type === 'background' && e.style?.background)?.style?.background
      expect(getPatternBg(results[0])).toBeDefined()
      expect(getPatternBg(results[1])).toBeDefined()
      expect(getPatternBg(results[2])).toBeDefined()
      // Different indices should produce different pattern SVGs (rotates through all 4 patterns)
      expect(getPatternBg(results[0])).not.toBe(getPatternBg(results[1]))
      expect(getPatternBg(results[1])).not.toBe(getPatternBg(results[2]))
      expect(getPatternBg(results[0])).not.toBe(getPatternBg(results[2]))
    })
  })

  describe('Vignette Option', () => {
    it('should include showVignette in render options', () => {
      const options: RenderOptionsV2 = {
        ...defaultOptions,
        showVignette: true
      }
      expect(options.showVignette).toBe(true)
    })

    it('should default showVignette to undefined', () => {
      expect(defaultOptions.showVignette).toBeUndefined()
    })
  })
})