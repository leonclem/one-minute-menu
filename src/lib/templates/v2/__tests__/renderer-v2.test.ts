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
      expect(imageElement?.width).toBeLessThanOrEqual(tile.width - 16) // Account for padding
      expect(imageElement?.style.borderRadius).toBe(8)
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
      expect(bgElements[0].height).toBe(45)

      // Second should be top border (1pt height)
      expect(bgElements[1].y).toBe(0)
      expect(bgElements[1].height).toBe(1)

      // Should have text elements for address and phone
      const textElements = result.elements.filter(e => e.type === 'text')
      expect(textElements.length).toBeGreaterThanOrEqual(2)

      // Footer text should use xs font size by default
      textElements.forEach(el => {
        expect(el.style.fontSize).toBe(TYPOGRAPHY_TOKENS_V2.fontSize.xs)
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
  })

  describe('Spacing Constants', () => {
    it('should have SPACING_V2 with expected values (GridMenu guide)', () => {
      expect(SPACING_V2.nameToDesc).toBe(8)
      expect(SPACING_V2.descToPrice).toBe(12)
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
      const expected = ['diagonal-pinstripe', 'bauhaus-check', 'overlapping-rings', 'windowpane', 'matte-paper-grain']
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
      const paletteColors = [
        palette.colors.surface ?? palette.colors.border.light,
        palette.colors.border.light,
        palette.colors.border.medium
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